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
exports.ENGINE_VERSION = "runtime-v2";
class PricingError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = "PricingError";
        this.code = code;
        this.unmatchedDimensions = details?.unmatchedDimensions;
        this.attributes = details?.attributes;
        this.rulesetHash = details?.rulesetHash;
        this.computedRulesetHash = details?.computedRulesetHash;
    }
}
exports.PricingError = PricingError;
function parseProfileVersion(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") {
        throw new Error("ProfileVersion must be an object.");
    }
    if (!data.profileVersionId) {
        throw new Error("ProfileVersion.profileVersionId is required.");
    }
    if (!Number.isFinite(data.eurPerCredit) || (data.eurPerCredit ?? 0) <= 0) {
        throw new Error("ProfileVersion.eurPerCredit must be a positive number.");
    }
    const rules = data.rateRules;
    if (!Array.isArray(rules)) {
        throw new Error("ProfileVersion.rateRules must be an array.");
    }
    data.rateRules = data.rateRules.map((rule) => {
        const normalized = {
            ...rule,
            dimensionKey: rule.dimensionKey,
            creditsPerUnit: rule.creditsPerUnit,
            costPerUnitEur: rule.costPerUnitEur,
            attributesMatch: rule.attributesMatch,
            status: rule.status ?? "active",
        };
        if (!normalized.id) {
            throw new Error("Rule.id is required.");
        }
        if (!normalized.dimensionKey) {
            throw new Error(`Rule.dimensionKey is required (rule ${normalized.id}).`);
        }
        if (!Number.isFinite(normalized.creditsPerUnit)) {
            throw new Error(`Rule.creditsPerUnit must be a number (rule ${normalized.id}).`);
        }
        if (normalized.costPerUnitEur !== undefined && !Number.isFinite(normalized.costPerUnitEur)) {
            throw new Error(`Rule.costPerUnitEur must be a number (rule ${normalized.id}).`);
        }
        return normalized;
    });
    const computedRulesetHash = rulesetHash(data.rateRules);
    data.rulesetHash = data.rulesetHash ?? computedRulesetHash;
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
        creditsPerUnit: rule.creditsPerUnit,
        costPerUnitEur: rule.costPerUnitEur ?? null,
        id: rule.id,
        priority: rule.priority ?? 0,
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
    if (Object.keys(ruleAttributes).length === 0)
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
function loadProfileVersion(json) {
    const profileVersion = parseProfileVersion(json);
    const activeRulesetHash = profileVersion.rulesetHash ?? rulesetHash(profileVersion.rateRules);
    return {
        profileVersion,
        rulesetHash: activeRulesetHash,
        engineVersion: exports.ENGINE_VERSION,
        price: (input, options) => price(profileVersion, input, activeRulesetHash, options),
        buildAuditPayload: (input, result) => buildAuditPayload(profileVersion, input, result, activeRulesetHash),
    };
}
function price(profileVersion, input, precomputedRulesetHash, options) {
    const attributes = input.attributes;
    const mode = input.mode ?? "STRICT";
    const breakdown = [];
    const ruleIdsUsed = [];
    const unmatchedDimensions = [];
    const computedRulesetHash = rulesetHash(profileVersion.rateRules);
    const rulesetHashProvided = profileVersion.rulesetHash !== undefined;
    const rulesetHashMatches = !rulesetHashProvided || profileVersion.rulesetHash === computedRulesetHash;
    let totalCredits = 0;
    let quarantineReason;
    if (!rulesetHashMatches) {
        if (mode === "STRICT") {
            throw new PricingError("Ruleset hash mismatch.", "RULESET_HASH_MISMATCH", {
                rulesetHash: profileVersion.rulesetHash,
                computedRulesetHash,
            });
        }
        quarantineReason = "RULESET_HASH_MISMATCH";
    }
    for (const [dimension, qtyRaw] of Object.entries(input.dimensions)) {
        const qty = Number(qtyRaw);
        if (!Number.isFinite(qty) || qty <= 0) {
            continue;
        }
        const rule = pickMatchingRule(profileVersion.rateRules, dimension, attributes);
        if (!rule) {
            unmatchedDimensions.push(dimension);
            continue;
        }
        const rowCredits = qty * rule.creditsPerUnit;
        totalCredits += rowCredits;
        const rowCostEur = rule.costPerUnitEur !== undefined ? qty * rule.costPerUnitEur : undefined;
        breakdown.push({
            dimensionKey: dimension,
            qty,
            creditsPerUnit: rule.creditsPerUnit,
            credits: rowCredits,
            costPerUnitEur: rule.costPerUnitEur,
            costEur: rowCostEur,
            ruleId: rule.id,
        });
        if (!ruleIdsUsed.includes(rule.id)) {
            ruleIdsUsed.push(rule.id);
        }
    }
    if (unmatchedDimensions.length > 0 && mode === "STRICT") {
        throw new PricingError("Unmatched dimension(s) in pricing input.", "UNMATCHED_DIMENSION", {
            unmatchedDimensions,
            attributes: attributes ?? {},
        });
    }
    if (unmatchedDimensions.length > 0 && mode === "RUNTIME") {
        quarantineReason = quarantineReason ?? "UNMATCHED_DIMENSION";
    }
    const includeRounded = options?.includeRounded ?? false;
    const roundingMode = options?.roundingMode ?? "ceil";
    const totalCreditsToDeduct = includeRounded && totalCredits > 0
        ? roundingMode === "ceil"
            ? Math.ceil(totalCredits)
            : Math.ceil(totalCredits)
        : undefined;
    const profileEngineVersion = profileVersion.engineVersion ?? "unknown";
    const runtimeEngineVersion = exports.ENGINE_VERSION;
    return {
        totalCredits,
        ...(totalCreditsToDeduct !== undefined ? { totalCreditsToDeduct } : {}),
        breakdown,
        ruleIdsUsed,
        rulesetHash: precomputedRulesetHash ?? profileVersion.rulesetHash ?? computedRulesetHash,
        profileVersionId: profileVersion.profileVersionId,
        profileEngineVersion,
        runtimeEngineVersion,
        ...(unmatchedDimensions.length > 0 ? { unmatchedDimensions } : {}),
        ...(quarantineReason ? { quarantineReason } : {}),
    };
}
function buildAuditPayload(profileVersion, input, result, precomputedRulesetHash) {
    const rulesetHashValue = precomputedRulesetHash ?? result.rulesetHash;
    const costTotalEur = result.breakdown.reduce((sum, row) => sum + (row.costEur ?? 0), 0);
    return {
        timestamp: new Date().toISOString(),
        profileEngineVersion: result.profileEngineVersion,
        runtimeEngineVersion: result.runtimeEngineVersion,
        profileVersionId: profileVersion.profileVersionId,
        rulesetHash: rulesetHashValue,
        ruleIdsUsed: result.ruleIdsUsed,
        dimensions: input.dimensions,
        attributes: input.attributes ?? {},
        eurPerCredit: profileVersion.eurPerCredit,
        totalCredits: result.totalCredits,
        ...(result.totalCreditsToDeduct !== undefined
            ? { totalCreditsToDeduct: result.totalCreditsToDeduct }
            : {}),
        costTotalEur,
        ...(result.unmatchedDimensions ? { unmatchedDimensions: result.unmatchedDimensions } : {}),
        ...(result.quarantineReason ? { quarantineReason: result.quarantineReason } : {}),
    };
}
