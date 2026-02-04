import crypto from "crypto";

export const ENGINE_VERSION = "runtime-v2";

export type DimensionQuantities = Record<string, number>;
export type Attributes = Record<string, string>;
export type RuleAttributeMatch = Record<string, string | string[]>;

export interface PricingRule {
  id: string;
  dimensionKey: string;
  creditsPerUnit: number;
  costPerUnitEur?: number;
  attributesMatch?: RuleAttributeMatch;
  priority?: number;
  status?: string;
  createdAt?: string;
}

export interface ProfileVersion {
  profileVersionId: string;
  eurPerCredit: number;
  rateRules: PricingRule[];
  rulesetHash?: string;
  engineVersion?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PricingInput {
  dimensions: DimensionQuantities;
  attributes?: Attributes;
  mode?: "STRICT" | "RUNTIME";
}

export interface PricingOptions {
  includeRounded?: boolean;
  roundingMode?: "ceil";
}

export interface BreakdownRow {
  dimensionKey: string;
  qty: number;
  creditsPerUnit: number;
  credits: number;
  costPerUnitEur?: number;
  costEur?: number;
  ruleId: string;
}

export interface PriceResult {
  totalCredits: number;
  totalCreditsToDeduct?: number;
  breakdown: BreakdownRow[];
  ruleIdsUsed: string[];
  rulesetHash: string;
  profileVersionId: string;
  profileEngineVersion: string;
  runtimeEngineVersion: string;
  unmatchedDimensions?: string[];
  quarantineReason?: string;
}

export interface PricingEngine {
  profileVersion: ProfileVersion;
  rulesetHash: string;
  engineVersion: string;
  price: (input: PricingInput, options?: PricingOptions) => PriceResult;
  buildAuditPayload: (input: PricingInput, result: PriceResult) => Record<string, unknown>;
}

export class PricingError extends Error {
  code: string;
  unmatchedDimensions?: string[];
  attributes?: Attributes;
  rulesetHash?: string;
  computedRulesetHash?: string;

  constructor(
    message: string,
    code: string,
    details?: {
      unmatchedDimensions?: string[];
      attributes?: Attributes;
      rulesetHash?: string;
      computedRulesetHash?: string;
    }
  ) {
    super(message);
    this.name = "PricingError";
    this.code = code;
    this.unmatchedDimensions = details?.unmatchedDimensions;
    this.attributes = details?.attributes;
    this.rulesetHash = details?.rulesetHash;
    this.computedRulesetHash = details?.computedRulesetHash;
  }
}

function parseProfileVersion(json: string | ProfileVersion): ProfileVersion {
  const data = typeof json === "string" ? (JSON.parse(json) as ProfileVersion) : json;

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
    creditsPerUnit: rule.creditsPerUnit,
    costPerUnitEur: rule.costPerUnitEur ?? null,
    id: rule.id,
    priority: rule.priority ?? 0,
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
  if (Object.keys(ruleAttributes).length === 0) return true;
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

export function loadProfileVersion(json: string | ProfileVersion): PricingEngine {
  const profileVersion = parseProfileVersion(json);
  const activeRulesetHash = profileVersion.rulesetHash ?? rulesetHash(profileVersion.rateRules);

  return {
    profileVersion,
    rulesetHash: activeRulesetHash,
    engineVersion: ENGINE_VERSION,
    price: (input: PricingInput, options?: PricingOptions) =>
      price(profileVersion, input, activeRulesetHash, options),
    buildAuditPayload: (input: PricingInput, result: PriceResult) =>
      buildAuditPayload(profileVersion, input, result, activeRulesetHash),
  };
}

export function price(
  profileVersion: ProfileVersion,
  input: PricingInput,
  precomputedRulesetHash?: string,
  options?: PricingOptions
): PriceResult {
  const attributes = input.attributes;
  const mode = input.mode ?? "STRICT";
  const breakdown: BreakdownRow[] = [];
  const ruleIdsUsed: string[] = [];
  const unmatchedDimensions: string[] = [];
  const computedRulesetHash = rulesetHash(profileVersion.rateRules);
  const rulesetHashProvided = profileVersion.rulesetHash !== undefined;
  const rulesetHashMatches =
    !rulesetHashProvided || profileVersion.rulesetHash === computedRulesetHash;
  let totalCredits = 0;
  let quarantineReason: string | undefined;

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
    const rowCostEur =
      rule.costPerUnitEur !== undefined ? qty * rule.costPerUnitEur : undefined;

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
  const totalCreditsToDeduct =
    includeRounded && totalCredits > 0
      ? roundingMode === "ceil"
        ? Math.ceil(totalCredits)
        : Math.ceil(totalCredits)
      : undefined;
  const profileEngineVersion = profileVersion.engineVersion ?? "unknown";
  const runtimeEngineVersion = ENGINE_VERSION;

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

export function buildAuditPayload(
  profileVersion: ProfileVersion,
  input: PricingInput,
  result: PriceResult,
  precomputedRulesetHash?: string
): Record<string, unknown> {
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
