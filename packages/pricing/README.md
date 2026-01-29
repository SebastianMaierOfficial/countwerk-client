# Countwerk Pricing Runtime v1

Helper for the canonical Runtime Contract v1 (Dimensions -> CU -> Credits).

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
    llm_input_tokens: 1200,
    llm_output_tokens: 350
  },
  attributes: {
    model: "gpt-4o-mini"
  }
};

const result = engine.price(input);

const auditPayload = engine.buildAuditPayload(input, result);

console.log(result.credits, result.cuTotal);
```

## API

- `loadProfileVersion(json)` -> PricingEngine
- `price(profileVersion, input)` -> PriceResult
- `buildAuditPayload(profileVersion, input, result)` -> object
 - `PricingError` (thrown when unmatched dimensions are detected)

## Notes

- Rule matching: AND across keys; array values are OR within a key; missing attribute means no match.
- Tie-breaker: priority DESC -> createdAt DESC -> ruleId ASC.
- `rulesetHash`: SHA-256 of normalized active rules (deterministically sorted).
- Unmatched dimensions throw `PricingError` with `code = "UNMATCHED_DIMENSION"`.

## Canonical v1 Schema (short)

Rule:
- `id`, `dimensionKey`, `rateType: "cu_per_unit"`, `rate`, `attributesMatch?`, `priority?`, `status?`, `createdAt?`

Input:
- `dimensions`, `attributes`, `rateRules`, `cuPerCredit`, `minChargeCredits?`

Output:
- `cuTotal`, `credits`, `ruleIdsUsed`, `rulesetHash`, `breakdown?`
 - `breakdown` entries: `{ dimensionKey, qty, rate, cuCost, ruleId }`
