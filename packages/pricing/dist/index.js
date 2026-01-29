"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingError = exports.ENGINE_VERSION = void 0;
exports.loadProfileVersion = loadProfileVersion;
exports.price = price;
exports.buildAuditPayload = buildAuditPayload;
const crypto_1 = __importDefault(require("crypto"));
exports.ENGINE_VERSION = "runtime-v1";
class PricingError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = "PricingError";
        this.code = code;
        this.unmatchedDimensions = details?.unmatchedDimensions;
        this.attributes = details?.attributes;
    }
}
exports.PricingError = PricingError;
function parseProfileVersion(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") {
        throw new Error("ProfileVersion must be an object.");
    }
    if (!data.id) {
        throw new Error("ProfileVersion.id is required.");
    }
    if (!data.ruleset || typeof data.ruleset !== "object") {
        throw new Error("ProfileVersion.ruleset is required.");
    }
    const ruleset = data.ruleset;
    if (!Number.isFinite(ruleset.cuPerCredit) || (ruleset.cuPerCredit ?? 0) <= 0) {
        throw new Error("Ruleset.cuPerCredit must be a positive number.");
    }
    const rules = data.ruleset.rateRules;
    if (!Array.isArray(rules)) {
        throw new Error("Ruleset.rateRules must be an array.");
    }
    data.ruleset.rateRules = data.ruleset.rateRules.map((rule) => {
        const normalized = {
            ...rule,
            dimensionKey: rule.dimensionKey,
            rate: rule.rate,
            attributesMatch: rule.attributesMatch,
            status: rule.status ?? "active",
            rateType: rule.rateType ?? "cu_per_unit",
        };
        if (!normalized.id) {
            throw new Error("Rule.id is required.");
        }
        if (!normalized.dimensionKey) {
            throw new Error(`Rule.dimensionKey is required (rule ${normalized.id}).`);
        }
        if (!Number.isFinite(normalized.rate)) {
            throw new Error(`Rule.rate must be a number (rule ${normalized.id}).`);
        }
        if (normalized.rateType !== "cu_per_unit") {
            throw new Error(`Rule.rateType must be 'cu_per_unit' (rule ${normalized.id}).`);
        }
        return normalized;
    });
    return data;
}
function normalizeAttributes(attributes) {
    if (!attributes)
        return undefined;
    const normalized = {};
    const keys = Object.keys(attributes).sort();
    for (const key of keys) {
        const value = attributes[key];
        if (Array.isArray(value)) {
            normalized[key] = [...value].sort();
        }
        else {
            normalized[key] = value;
        }
    }
    return normalized;
}
function normalizedRuleForHash(rule) {
    return {
        attributesMatch: normalizeAttributes(rule.attributesMatch) ?? {},
        dimensionKey: rule.dimensionKey,
        id: rule.id,
        priority: rule.priority ?? 0,
        rate: rule.rate,
        rateType: rule.rateType ?? "cu_per_unit",
        status: rule.status ?? "active",
    };
}
function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    if (value && typeof value === "object") {
        const record = value;
        const keys = Object.keys(record).sort();
        return `{${keys.map((key) => JSON.stringify(key) + ":" + stableStringify(record[key])).join(",")}}`;
    }
    return JSON.stringify(value);
}
function rulesetHash(rules) {
    const activeRules = rules.filter((rule) => rule.status !== "disabled");
    const normalized = activeRules
        .map(normalizedRuleForHash)
        .sort((a, b) => {
        const dimensionDelta = a.dimensionKey.localeCompare(b.dimensionKey);
        if (dimensionDelta !== 0)
            return dimensionDelta;
        return a.id.localeCompare(b.id);
    });
    const json = stableStringify(normalized);
    return crypto_1.default.createHash("sha256").update(json).digest("hex");
}
function attributesMatch(ruleAttributes, inputAttributes) {
    if (!ruleAttributes)
        return true;
    if (!inputAttributes)
        return false;
    for (const [key, expected] of Object.entries(ruleAttributes)) {
        const actual = inputAttributes[key];
        if (actual === undefined)
            return false;
        if (Array.isArray(expected)) {
            if (!expected.includes(actual))
                return false;
        }
        else if (expected !== actual) {
            return false;
        }
    }
    return true;
}
function ruleCreatedAtMs(rule) {
    const raw = rule.createdAt;
    if (!raw)
        return 0;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : 0;
}
function pickMatchingRule(rules, dimension, attributes) {
    const candidates = rules.filter((rule) => rule.status !== "disabled" &&
        rule.dimensionKey === dimension &&
        attributesMatch(rule.attributesMatch, attributes));
    if (candidates.length === 0)
        return undefined;
    return candidates.sort((a, b) => {
        const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
        if (priorityDelta !== 0)
            return priorityDelta;
        const createdDelta = ruleCreatedAtMs(b) - ruleCreatedAtMs(a);
        if (createdDelta !== 0)
            return createdDelta;
        return a.id.localeCompare(b.id);
    })[0];
}
function calculateCredits(cuTotal, cuPerCredit, minChargeCredits) {
    if (cuTotal <= 0)
        return 0;
    const credits = Math.ceil(cuTotal / cuPerCredit);
    if (minChargeCredits !== undefined && credits < minChargeCredits) {
        return minChargeCredits;
    }
    return credits;
}
function loadProfileVersion(json) {
    const profileVersion = parseProfileVersion(json);
    const activeRulesetHash = rulesetHash(profileVersion.ruleset.rateRules);
    return {
        profileVersion,
        rulesetHash: activeRulesetHash,
        engineVersion: exports.ENGINE_VERSION,
        price: (input) => price(profileVersion, input, activeRulesetHash),
        buildAuditPayload: (input, result) => buildAuditPayload(profileVersion, input, result, activeRulesetHash),
    };
}
function price(profileVersion, input, precomputedRulesetHash) {
    const { ruleset } = profileVersion;
    const attributes = input.attributes;
    const breakdown = [];
    const ruleIdsUsed = [];
    const unmatchedDimensions = [];
    let cuTotal = 0;
    for (const [dimension, qtyRaw] of Object.entries(input.dimensions)) {
        const qty = Number(qtyRaw);
        if (!Number.isFinite(qty) || qty <= 0) {
            continue;
        }
        const rule = pickMatchingRule(ruleset.rateRules, dimension, attributes);
        if (!rule) {
            unmatchedDimensions.push(dimension);
            continue;
        }
        const cuPerUnit = rule.rate;
        const rowCuTotal = qty * cuPerUnit;
        cuTotal += rowCuTotal;
        breakdown.push({
            dimensionKey: dimension,
            qty,
            rate: cuPerUnit,
            cuCost: rowCuTotal,
            ruleId: rule.id,
        });
        if (!ruleIdsUsed.includes(rule.id)) {
            ruleIdsUsed.push(rule.id);
        }
    }
    if (unmatchedDimensions.length > 0) {
        throw new PricingError("Unmatched dimension(s) in pricing input.", "UNMATCHED_DIMENSION", {
            unmatchedDimensions,
            attributes: attributes ?? {},
        });
    }
    const credits = calculateCredits(cuTotal, ruleset.cuPerCredit, ruleset.minChargeCredits);
    return {
        cuTotal,
        credits,
        breakdown,
        ruleIdsUsed,
        rulesetHash: precomputedRulesetHash ?? rulesetHash(ruleset.rateRules),
        profileVersionId: profileVersion.id,
        engineVersion: exports.ENGINE_VERSION,
    };
}
function buildAuditPayload(profileVersion, input, result, precomputedRulesetHash) {
    const rulesetHashValue = precomputedRulesetHash ?? result.rulesetHash;
    return {
        timestamp: new Date().toISOString(),
        engineVersion: exports.ENGINE_VERSION,
        profileVersionId: profileVersion.id,
        rulesetHash: rulesetHashValue,
        ruleIdsUsed: result.ruleIdsUsed,
        dimensions: input.dimensions,
        attributes: input.attributes ?? {},
        cuTotal: result.cuTotal,
        creditsDeducted: result.credits,
    };
}
