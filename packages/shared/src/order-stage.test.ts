import { describe, expect, it } from "vitest";
import {
  ORDER_PIPELINE,
  orderStageIndex,
  orderStageLabel,
  isTerminalStatus,
  isPostPaymentStage,
  orderDetailSchema,
} from "./index.js";

describe("order pipeline", () => {
  it("has the 8 progressive stages in order, using real SF picklist values", () => {
    expect(ORDER_PIPELINE).toHaveLength(8);
    expect(ORDER_PIPELINE[0]?.sfValue).toBe("To Verify Payment");
    expect(ORDER_PIPELINE.at(-1)?.sfValue).toBe("Verified - Complete");
  });

  it("derives progress index and friendly labels from raw SF values", () => {
    expect(orderStageIndex("Verified - Work Started")).toBe(3);
    expect(orderStageLabel("Verified - Work Started")).toBe("Work Started");
    expect(orderStageIndex("Cancelled - Refunded")).toBe(-1);
  });

  it("flags terminal states outside the progress bar", () => {
    expect(isTerminalStatus("ON HOLD - Other Reasons")).toBe(true);
    expect(isTerminalStatus("Verified - Shipped")).toBe(false);
  });

  it("flags post-payment stages for the staff hand-off rule (Sales Advisor -> Implementation Manager)", () => {
    expect(isPostPaymentStage("To Verify Payment")).toBe(false);
    expect(isPostPaymentStage("Pending Balance")).toBe(false);
    expect(isPostPaymentStage("Verified - Initial Contact")).toBe(true);
    expect(isPostPaymentStage("Verified - Complete")).toBe(true);
  });
});

describe("orderDetailSchema", () => {
  it("accepts a well-formed order-detail payload and rejects a bad email", () => {
    const payload = {
      client: { id: "a01", email: "m.brown@acme.com", name: "Marcus", phone: null, businessName: "Acme" },
      order: {
        id: "o1",
        orderNumber: "OO-1042",
        amount: 8750,
        paidToDate: 5000,
        balanceDue: 3750,
        statusSf: "Verified - Work Started",
        placedAt: "2026-05-02",
        advisorName: "Rinkie S.",
        paymentMethod: "Wire Transfer",
        shelfCorp: null,
        clientId: "a01",
      },
      payments: [],
    };
    expect(orderDetailSchema.safeParse(payload).success).toBe(true);

    const bad = { ...payload, client: { ...payload.client, email: "not-an-email" } };
    expect(orderDetailSchema.safeParse(bad).success).toBe(false);
  });
});
