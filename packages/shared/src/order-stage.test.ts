import { describe, expect, it } from "vitest";
import {
  ORDER_DISPLAY_STEPS,
  ORDER_PIPELINE,
  orderStageIndex,
  orderStageLabel,
  orderDisplayStepIndex,
  orderProgress,
  isTerminalStatus,
  isPostPaymentStage,
  orderDetailSchema,
} from "./index.js";

const progress = (statusSf: string, overrides = {}) =>
  orderProgress({
    statusSf,
    fullyPaidAt: null,
    initialContactAt: null,
    completedAt: null,
    ...overrides,
  });

describe("order pipeline", () => {
  it("models only the 5 statuses the WSC record type can actually hold", () => {
    // The global describe returns 16 values, but a WSC order can never be
    // "Verified - Shipped" etc. — those belong to other brands' record types.
    expect(ORDER_PIPELINE).toHaveLength(5);
    expect(ORDER_PIPELINE[0]?.sfValue).toBe("To Verify Payment");
    expect(ORDER_PIPELINE.at(-1)?.sfValue).toBe("Verified - Complete");
    expect(ORDER_PIPELINE.map((stage) => stage.sfValue)).not.toContain("Verified - Shipped");
  });

  it("derives progress index and friendly labels from raw SF values", () => {
    expect(orderStageIndex("Verified - Work Started")).toBe(3);
    expect(orderStageLabel("Verified - Work Started")).toBe("Work Started");
    expect(orderStageIndex("Cancelled - Refunded")).toBe(-1);
  });

  it("flags terminal states outside the progress bar", () => {
    expect(isTerminalStatus("ON HOLD - Other Reasons")).toBe(true);
    expect(isTerminalStatus("Verified - Work Started")).toBe(false);
  });

  it("matches ON HOLD on the API value, which carries an apostrophe the UI label drops", () => {
    // Screen shows "ON HOLD - Client Unresponsive"; the stored value is "Client's".
    expect(isTerminalStatus("ON HOLD - Client's Unresponsive")).toBe(true);
  });

  it("flags post-payment stages for the staff hand-off rule (Sales Advisor -> Implementation Manager)", () => {
    expect(isPostPaymentStage("To Verify Payment")).toBe(false);
    expect(isPostPaymentStage("Pending Balance")).toBe(false);
    expect(isPostPaymentStage("Verified - Initial Contact")).toBe(true);
    expect(isPostPaymentStage("Verified - Complete")).toBe(true);
  });
});

describe("client-facing display map", () => {
  it("groups the 5 real statuses into the 4 steps the stakeholder asked for", () => {
    expect(ORDER_DISPLAY_STEPS).toHaveLength(4);
    expect(orderDisplayStepIndex("To Verify Payment")).toBe(0);
    expect(orderDisplayStepIndex("Pending Balance")).toBe(0);
    expect(orderDisplayStepIndex("Verified - Initial Contact")).toBe(1);
    expect(orderDisplayStepIndex("Verified - Work Started")).toBe(2);
    expect(orderDisplayStepIndex("Verified - Complete")).toBe(3);
  });

  it("covers every progressive status — a stage with no step would render a dead bar", () => {
    for (const stage of ORDER_PIPELINE) {
      expect(orderDisplayStepIndex(stage.sfValue)).toBeGreaterThanOrEqual(0);
    }
  });

  it("maps no cancelled status onto a step", () => {
    expect(orderDisplayStepIndex("Cancelled - Refunded")).toBe(-1);
    expect(progress("Cancelled - Refunded")).toEqual({ state: "cancelled", stepIndex: -1 });
  });
});

describe("orderProgress", () => {
  it("tracks an active order by its status", () => {
    expect(progress("Verified - Work Started")).toEqual({ state: "active", stepIndex: 2 });
  });

  it("re-derives a paused order's progress from timestamps, since ON HOLD overwrote the stage", () => {
    expect(progress("ON HOLD - Other Reasons", { initialContactAt: "2026-05-19" })).toEqual({
      state: "on-hold",
      stepIndex: 1,
    });
    expect(progress("ON HOLD - Other Reasons", { completedAt: "2026-06-01" })).toEqual({
      state: "on-hold",
      stepIndex: 3,
    });
  });

  it("falls back to the first step for a paused order with nothing stamped yet", () => {
    expect(progress("ON HOLD - Client's Unresponsive")).toEqual({
      state: "on-hold",
      stepIndex: 0,
    });
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
        statusUpdatedAt: "2026-05-19T12:36:00.000Z",
        onHoldReason: null,
        placedAt: "2026-05-02",
        fullyPaidAt: null,
        initialContactAt: "2026-05-19",
        completedAt: null,
        advisor: {
          role: "advisor",
          name: "Scott Benon",
          email: "scott@wsc.com",
          phone: "+1 (720) 534-2065",
          whatsAppNumber: "+1 (720) 534-2065",
        },
        supportManager: null,
        backEndSupport: null,
        paymentMethod: "Wire Transfer",
        paymentFrequency: "One-Time",
        ein: "88-1234567",
        shelfCorp: {
          id: "s1",
          name: "2016 Wyoming LLC",
          entityType: "LLC",
          stateOfFormation: "Wyoming",
          incorporationDate: "2016-03-15",
          agedYears: 8,
          price: 8750,
          duns: "07-891-2345",
          creditReadyFeatures: [],
          corpNumber: "SCC415386",
          registrationNumber: null,
          lastAnnualReportDate: "2026-01-15",
          nextRenewalDate: "2027-01-15",
          registeredAgentStatus: "Active - Initial Free Period",
        },
        clientId: "a01",
      },
      payments: [],
    };
    expect(orderDetailSchema.safeParse(payload).success).toBe(true);

    const bad = { ...payload, client: { ...payload.client, email: "not-an-email" } };
    expect(orderDetailSchema.safeParse(bad).success).toBe(false);
  });
});
