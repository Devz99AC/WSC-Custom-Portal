import { describe, expect, it } from "vitest";
import {
  ORDER_STAGES,
  ORDER_STAGE_TO_SF_STAGE,
  orderStageIndex,
  orderSchema,
} from "./index.js";

describe("order pipeline", () => {
  it("has the 8 canonical stages, in order", () => {
    expect(ORDER_STAGES).toHaveLength(8);
    expect(ORDER_STAGES[0]).toBe("To Verify Payment");
    expect(ORDER_STAGES.at(-1)).toBe("Complete");
  });

  it("maps every stage to a Salesforce StageName", () => {
    for (const stage of ORDER_STAGES) {
      expect(ORDER_STAGE_TO_SF_STAGE[stage]).toBeTruthy();
    }
  });

  it("derives a monotonic progress index", () => {
    expect(orderStageIndex("To Verify Payment")).toBe(0);
    expect(orderStageIndex("Work Started")).toBe(3);
  });
});

describe("orderSchema", () => {
  it("accepts a well-formed order and rejects a bad order number", () => {
    const ok = orderSchema.safeParse({
      id: "006AA",
      orderNumber: "OO-1042",
      amount: 8750,
      balanceDue: 3750,
      stage: "Work Started",
      advisor: "Rinkie S.",
      shelfCorpId: "a01AA",
    });
    expect(ok.success).toBe(true);

    const bad = orderSchema.safeParse({
      id: "006AA",
      orderNumber: "1042",
      amount: 8750,
      balanceDue: 3750,
      stage: "Work Started",
      advisor: null,
      shelfCorpId: "a01AA",
    });
    expect(bad.success).toBe(false);
  });
});
