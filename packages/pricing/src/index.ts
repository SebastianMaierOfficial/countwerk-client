import crypto from "crypto";

export const ENGINE_VERSION = "runtime-v1";

export type DimensionQuantities = Record<string, number>;
export type Attributes = Record<string, string>;
export type RuleAttributeMatch = Record<string, string | string[]>;

export interface PricingRule {
  id: string;
  dimensionKey: string;
  rate: number;
  rateType: "cu_per_unit";
  attributesMatch?: RuleAttributeMatch;
  priority?: number;
  status?: string;
  createdAt?: string;
}

export interface Ruleset {
  id?: string;
  cuPerCredit: number;
  minChargeCredits?: number;
  rateRules: PricingRule[];
}

export interface ProfileVersion {
  id: string;
  ruleset: Ruleset;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface PricingInput {
  dimensions: DimensionQuantities;
  attributes?: Attributes;
}

export interface BreakdownRow {
  dimensionKey: string;
  qty: number;
  rate: number;
  cuCost: number;
  ruleId: string;
}

export interface PriceResult {
  cuTotal: number;
  credits: number;
  breakdown: BreakdownRow[];
  ruleIdsUsed: string[];
  rulesetHash: string;
  profileVersionId: string;
  engineVersion: string;
}

export interface PricingEngine {
  profileVersion: ProfileVersion;
  rulesetHash: string;
  engineVersion: string;
  price: (input: PricingInput) => PriceResult;
  buildAuditPayload: (input: PricingInput, result: PriceResult) => Record<string, unknown>;
}

export class PricingError extends Error {
  code: string;
  unmatchedDimensions?: string[];
  attributes?: Attributes;

  constructor(message: string, code: string, details?: { unmatchedDimensions?: string[]; attributes?: Attributes }) {
    super(message);
    this.name = "PricingError";
    this.code = code;
    this.unmatchedDimensions = details?.unmatchedDimensions;
    this.attributes = details?.attributes;
  }
}

function parseProfileVersion(json: string | ProfileVersion): ProfileVersion {
  const data = typeof json === "string" ? (JSON.parse(json) as ProfileVersion) : json;

  if (!data || typeof data !== "object") {
    throw new Error("ProfileVersion must be an object.");
  }
  if (!data.id) {
    throw new Error("ProfileVersion.id is required.");
  }
  if (!data.ruleset || typeof data.ruleset !== "object") {
    throw new Error("ProfileVersion.ruleset is required.");
  }
  const ruleset = data.ruleset as Ruleset;
  if (!Number.isFinite(ruleset.cuPerCredit) || (ruleset.cuPerCredit ?? 0) <= 0) {
    throw new Error("Ruleset.cuPerCredit must be a positive number.");
  }
  const rules = (data.ruleset as Ruleset).rateRules;
  if (!Array.isArray(rules)) {
    throw new Error("Ruleset.rateRules must be an array.");
  }
  (data.ruleset as Ruleset).rateRules = (data.ruleset as Ruleset).rateRules.map((rule) => {
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

function normalizeAttributes(attributes?: RuleAttributeMatch): RuleAttributeMatch | undefined {
  if (!attributes) return undefined;
  const normalized: RuleAttributeMatch = {};
  const keys = Object.keys(attributes).sort();
  for (const key of keys) {
    const value = attributes[key];
    if (Array.isArray(value)) {
      normalized[key] = [...value].sort();
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizedRuleForHash(rule: PricingRule) {
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => JSON.stringify(key) + ":" + stableStringify(record[key])).join(",")}}`;
  }
  return JSON.stringify(value);
}

function rulesetHash(rules: PricingRule[]): string {
  const activeRules = rules.filter((rule) => rule.status !== "disabled");
  const normalized = activeRules
    .map(normalizedRuleForHash)
    .sort((a, b) => {
      const dimensionDelta = a.dimensionKey.localeCompare(b.dimensionKey);
      if (dimensionDelta !== 0) return dimensionDelta;
      return a.id.localeCompare(b.id);
    });
  const json = stableStringify(normalized);
  return crypto.createHash("sha256").update(json).digest("hex");
}

function attributesMatch(ruleAttributes: RuleAttributeMatch | undefined, inputAttributes: Attributes | undefined): boolean {
  if (!ruleAttributes) return true;
  if (!inputAttributes) return false;

  for (const [key, expected] of Object.entries(ruleAttributes)) {
    const actual = inputAttributes[key];
    if (actual === undefined) return false;

    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (expected !== actual) {
      return false;
    }
  }

  return true;
}

function ruleCreatedAtMs(rule: PricingRule): number {
  const raw = rule.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function pickMatchingRule(rules: PricingRule[], dimension: string, attributes: Attributes | undefined): PricingRule | undefined {
  const candidates = rules.filter(
    (rule) =>
      rule.status !== "disabled" &&
      rule.dimensionKey === dimension &&
      attributesMatch(rule.attributesMatch, attributes)
  );

  if (candidates.length === 0) return undefined;

  return candidates.sort((a, b) => {
    const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDelta !== 0) return priorityDelta;

    const createdDelta = ruleCreatedAtMs(b) - ruleCreatedAtMs(a);
    if (createdDelta !== 0) return createdDelta;

    return a.id.localeCompare(b.id);
  })[0];
}

function calculateCredits(cuTotal: number, cuPerCredit: number, minChargeCredits?: number): number {
  if (cuTotal <= 0) return 0;
  const credits = Math.ceil(cuTotal / cuPerCredit);
  if (minChargeCredits !== undefined && credits < minChargeCredits) {
    return minChargeCredits;
  }
  return credits;
}

export function loadProfileVersion(json: string | ProfileVersion): PricingEngine {
  const profileVersion = parseProfileVersion(json);
  const activeRulesetHash = rulesetHash(profileVersion.ruleset.rateRules);

  return {
    profileVersion,
    rulesetHash: activeRulesetHash,
    engineVersion: ENGINE_VERSION,
    price: (input: PricingInput) =>
      price(profileVersion, input, activeRulesetHash),
    buildAuditPayload: (input: PricingInput, result: PriceResult) =>
      buildAuditPayload(profileVersion, input, result, activeRulesetHash),
  };
}

export function price(
  profileVersion: ProfileVersion,
  input: PricingInput,
  precomputedRulesetHash?: string
): PriceResult {
  const { ruleset } = profileVersion;
  const attributes = input.attributes;
  const breakdown: BreakdownRow[] = [];
  const ruleIdsUsed: string[] = [];
  const unmatchedDimensions: string[] = [];
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
    engineVersion: ENGINE_VERSION,
  };
}

export function buildAuditPayload(
  profileVersion: ProfileVersion,
  input: PricingInput,
  result: PriceResult,
  precomputedRulesetHash?: string
): Record<string, unknown> {
  const rulesetHashValue = precomputedRulesetHash ?? result.rulesetHash;
  return {
    timestamp: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    profileVersionId: profileVersion.id,
    rulesetHash: rulesetHashValue,
    ruleIdsUsed: result.ruleIdsUsed,
    dimensions: input.dimensions,
    attributes: input.attributes ?? {},
    cuTotal: result.cuTotal,
    creditsDeducted: result.credits,
  };
}
