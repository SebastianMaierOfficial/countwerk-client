import nock from "nock";
import { CountwerkError, createCountwerkClient } from "../src";

describe("countwerk-client", () => {
  const baseUrl = "https://countwerk.example";
  const apiKey = "test-key";

  const client = createCountwerkClient({ baseUrl, apiKey, maxRetries: 1 });

  afterEach(() => {
    nock.cleanAll();
  });

  it("resolveOrder: builds request and returns data", async () => {
    const scope = nock(baseUrl, {
      reqheaders: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
    })
      .post("/api/credits/resolve-order", { order_id: "ORDER_123" })
      .reply(200, {
        success: true,
        data: { order_id: "ORDER_123", account_id: "acct_123" },
      });

    const res = await client.resolveOrder("ORDER_123");
    expect(res.account_id).toBe("acct_123");
    scope.done();
  });

  it("purchaseLinks: returns options", async () => {
    const scope = nock(baseUrl)
      .post("/api/purchase-links", {
        ai_product_id: "ai_product_001",
        account_id: "acct_123",
      })
      .reply(200, {
        success: true,
        data: {
          ai_product_id: "ai_product_001",
          account_id: "acct_123",
          options: [
            {
              type: "topup",
              linkMode: "create_buy_url",
              effectiveAtPolicy: "immediate",
              expectedPolicy: "immediate",
              enabled: true,
              disabledReason: null,
              toProductId: "TOPUP_100",
              fromProductId: null,
              url: "https://example.com",
              label: "Topup 100",
              description: "Top up 100 credits",
            },
          ],
        },
      });

    const res = await client.purchaseLinks({
      ai_product_id: "ai_product_001",
      account_id: "acct_123",
    });

    expect(res.options[0]?.type).toBe("topup");
    scope.done();
  });

  it("balance: returns balance data", async () => {
    const scope = nock(baseUrl)
      .post("/api/credits/balance", { account_id: "acct_123" })
      .reply(200, {
        success: true,
        data: {
          balance: 1000,
          reservedBalance: 0,
          availableBalance: 1000,
          totalEarned: 1000,
          totalSpent: 0,
          nextExpiration: null,
        },
      });

    const res = await client.balance("acct_123");
    expect(res.balance).toBe(1000);
    scope.done();
  });

  it("deduct: maps error response to CountwerkError", async () => {
    const scope = nock(baseUrl)
      .post("/api/credits/deduct")
      .reply(402, { success: false, code: "INSUFFICIENT_CREDITS" });

    await expect(
      client.deduct({
        account_id: "acct_123",
        operation: "app.chat.reply",
        amount: 1,
        usage_event_id: "turn-2026-01-20-001",
      })
    ).rejects.toEqual(
      expect.objectContaining({
        name: "CountwerkError",
        code: "INSUFFICIENT_CREDITS",
        status: 402,
      })
    );

    scope.done();
  });
});
