import { z } from "zod";

/**
 * Runtime validation (zod) for the portal DTOs the BFF returns. Types are derived from
 * these so static types can't lie at runtime (CLAUDE.md §2). Shapes mirror the domain
 * entities mapped to the real Salesforce objects (docs/salesforce-data-model.md).
 */

export const paymentMethodSchema = z.enum([
  "Credit Card",
  "Wire Transfer",
  "ACH",
  "PayPal",
  "BTC",
  "Other",
]);

export const clientSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable(),
  businessName: z.string().nullable(),
});

export const shelfCorpSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  entityType: z.string(),
  stateOfFormation: z.string(),
  incorporationDate: z.string().nullable(),
  agedYears: z.number().nonnegative(),
  price: z.number().nullable(),
  duns: z.string().nullable(),
  creditReadyFeatures: z.array(z.string()),
});

export const paymentSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  productName: z.string().nullable(),
  amount: z.number(),
  method: paymentMethodSchema,
  statusSf: z.string(),
  isVerified: z.boolean(),
  statusDate: z.string().nullable(),
});

export const orderSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string(),
  amount: z.number().nonnegative(),
  paidToDate: z.number().nonnegative(),
  balanceDue: z.number(),
  statusSf: z.string(),
  placedAt: z.string().nullable(),
  advisorName: z.string().nullable(),
  paymentMethod: paymentMethodSchema.nullable(),
  shelfCorp: shelfCorpSchema.nullable(),
  clientId: z.string().min(1),
});

export const orderDetailSchema = z.object({
  client: clientSchema,
  order: orderSchema,
  payments: z.array(paymentSchema),
});

export type OrderDetailDto = z.infer<typeof orderDetailSchema>;

export const ordersListSchema = z.object({
  client: clientSchema,
  orders: z.array(orderSchema),
});

export type OrdersListDto = z.infer<typeof ordersListSchema>;

export const paymentsListSchema = z.object({
  payments: z.array(paymentSchema),
});

export type PaymentsListDto = z.infer<typeof paymentsListSchema>;
