export declare const ENGINE_VERSION = "runtime-v2";
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
export declare class PricingError extends Error {
    code: string;
    unmatchedDimensions?: string[];
    attributes?: Attributes;
    rulesetHash?: string;
    computedRulesetHash?: string;
    constructor(message: string, code: string, details?: {
        unmatchedDimensions?: string[];
        attributes?: Attributes;
        rulesetHash?: string;
        computedRulesetHash?: string;
    });
}
export declare function loadProfileVersion(json: string | ProfileVersion): PricingEngine;
export declare function price(profileVersion: ProfileVersion, input: PricingInput, precomputedRulesetHash?: string, options?: PricingOptions): PriceResult;
export declare function buildAuditPayload(profileVersion: ProfileVersion, input: PricingInput, result: PriceResult, precomputedRulesetHash?: string): Record<string, unknown>;
