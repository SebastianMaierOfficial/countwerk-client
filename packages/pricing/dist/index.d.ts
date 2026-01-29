export declare const ENGINE_VERSION = "runtime-v1";
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
export declare class PricingError extends Error {
    code: string;
    unmatchedDimensions?: string[];
    attributes?: Attributes;
    constructor(message: string, code: string, details?: {
        unmatchedDimensions?: string[];
        attributes?: Attributes;
    });
}
export declare function loadProfileVersion(json: string | ProfileVersion): PricingEngine;
export declare function price(profileVersion: ProfileVersion, input: PricingInput, precomputedRulesetHash?: string): PriceResult;
export declare function buildAuditPayload(profileVersion: ProfileVersion, input: PricingInput, result: PriceResult, precomputedRulesetHash?: string): Record<string, unknown>;
