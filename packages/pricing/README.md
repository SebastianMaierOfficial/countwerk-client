# Countwerk Pricing Runtime v2

Helper for the PriceCalc Runtime Contract (Dimensions -> Credits).

## Install

```bash
npm i @sebastianmaierofficial/countwerk-pricing
```

## Quickstart

```ts
import { loadProfileVersion } from "@sebastianmaierofficial/countwerk-pricing";

const engine = loadProfileVersion(profileVersionJson);

const input = {
  dimensions: {
    active_user_day: 1
  },
  attributes: {
    plan: "pro"
  }
};

const result = engine.price(input);

const auditPayload = engine.buildAuditPayload(input, result);

console.log(result.totalCredits, result.totalCreditsToDeduct);
```

## API

- `loadProfileVersion(json)` -> PricingEngine
- `price(profileVersion, input)` -> PriceResult
- `buildAuditPayload(profileVersion, input, result)` -> object
- `PricingError` (thrown in STRICT mode when unmatched dimensions are detected)

## Notes

- Rule matching: AND across keys; array values are OR within a key; missing attribute means no match.
- Tie-breaker: priority DESC -> createdAt DESC -> ruleId ASC.
- `rulesetHash`: SHA-256 of normalized active rules (deterministically sorted).
- Quarantine: `mode: "STRICT"` throws `PricingError` with `code = "UNMATCHED_DIMENSION"`. `mode: "RUNTIME"` returns `unmatchedDimensions` in the result.
- `rulesetHash` is validated against the computed hash when provided in the profile JSON.
 - `mode: "STRICT"` throws `PricingError` with `code = "RULESET_HASH_MISMATCH"`.
 - `mode: "RUNTIME"` returns `quarantineReason = "RULESET_HASH_MISMATCH"`.

## Canonical v1 Schema (short)

ProfileVersion:
- `profileVersionId`, `eurPerCredit`, `rateRules`, `rulesetHash`, `engineVersion`

Rule:
- `id`, `dimensionKey`, `creditsPerUnit`, `costPerUnitEur?`, `attributesMatch?`, `priority?`, `status?`, `createdAt?`

Input:
- `dimensions`, `attributes`, `mode?`

Output:
- `totalCredits`, `totalCreditsToDeduct`, `ruleIdsUsed`, `rulesetHash`, `profileVersionId`,
  `profileEngineVersion`, `runtimeEngineVersion`, `unmatchedDimensions?`, `quarantineReason?`, `breakdown?`
 - `breakdown` entries: `{ dimensionKey, qty, creditsPerUnit, credits, costPerUnitEur?, costEur?, ruleId }`

## Examples

### CoachWunder: active_user_day (credits-only)

```ts
const profileVersionJson = {
  profileVersionId: "pv_2026_01_31",
  engineVersion: "pricecalc-v2",
  eurPerCredit: 0.01,
  rateRules: [
    {
      id: "rule_active_user_day_default",
      dimensionKey: "active_user_day",
      creditsPerUnit: 3,
      status: "active"
    }
  ]
};

const engine = loadProfileVersion(profileVersionJson);
const result = engine.price({
  dimensions: { active_user_day: 1 }
});

console.log(result.totalCredits, result.totalCreditsToDeduct); // 3, 3
```

### Petra: token pricing (credits per token)

```ts
const profileVersionJson = {
  profileVersionId: "pv_petra_2026_01_31",
  engineVersion: "pricecalc-v2",
  eurPerCredit: 0.01,
  rateRules: [
    {
      id: "rule_input_tokens",
      dimensionKey: "llm_input_tokens",
      creditsPerUnit: 0.0002,
      costPerUnitEur: 0.0000003,
      attributesMatch: { model: "gpt-4o-mini" },
      priority: 10,
      status: "active"
    },
    {
      id: "rule_output_tokens",
      dimensionKey: "llm_output_tokens",
      creditsPerUnit: 0.0006,
      costPerUnitEur: 0.0000012,
      attributesMatch: { model: "gpt-4o-mini" },
      priority: 10,
      status: "active"
    }
  ]
};

const engine = loadProfileVersion(profileVersionJson);
const result = engine.price({
  dimensions: { llm_input_tokens: 1200, llm_output_tokens: 350 },
  attributes: { model: "gpt-4o-mini" }
});

console.log(result.totalCredits, result.totalCreditsToDeduct);
```
