import { z } from "zod";
import { ORDER_STAGES } from "../domain/order-stage.js";

/**
 * Runtime validation (zod) for the boundary. Types are DERIVED from the schema so
 * static types cannot lie at runtime (CLAUDE.md §2, ROADMAP §5.3). More schemas are
 * added alongside the endpoints/webhooks that consume them in later phases.
 */

export const orderStageSchema = z.enum(ORDER_STAGES);

export const orderSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().regex(/^OO-\d+$/, "must look like OO-1042"),
  amount: z.number().nonnegative(),
  balanceDue: z.number().nonnegative(),
  stage: orderStageSchema,
  advisor: z.string().nullable(),
  shelfCorpId: z.string().min(1),
});

/** Inferred DTO — kept structurally in sync with `Order` in domain/entities.ts. */
export type OrderDto = z.infer<typeof orderSchema>;
