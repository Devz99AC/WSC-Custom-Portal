import {
  VERIFIED_PAYMENT_STATUSES,
  type Client,
  type Order,
  type OrderDetail,
  type OrdersList,
  type Payment,
  type PaymentMethod,
  type PaymentsList,
  type ShelfCorp,
} from "@wsc/shared";
import type { ClientIdentity, PortalRepository } from "../../application/ports/portal-repository.js";
import type { SalesforceQuery, SalesforceRecord } from "./salesforce-query.js";

const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const num = (value: unknown): number => (typeof value === "number" ? value : 0);
const obj = (value: unknown): SalesforceRecord | null =>
  value !== null && typeof value === "object" ? (value as SalesforceRecord) : null;

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "Credit Card",
  "Wire Transfer",
  "ACH",
  "PayPal",
  "BTC",
  "Other",
];
const toMethod = (value: unknown): PaymentMethod => {
  const raw = str(value);
  return raw && (PAYMENT_METHODS as readonly string[]).includes(raw)
    ? (raw as PaymentMethod)
    : "Other";
};

const isVerified = (statusSf: string | null): boolean =>
  statusSf !== null && (VERIFIED_PAYMENT_STATUSES as readonly string[]).includes(statusSf);

const soqlEscape = (value: string): string => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const ORDER_SELECT = `Id, Name, Amount__c, Total_Payments__c, Status__c, Order_Date__c, SR_Name__c,
              Payment_Method__c, Paid_Features_Selected__c, Client__c, Corp__c, Corp_Name__c,
              Client__r.Name, Client__r.E_Mail__c, Client__r.Phone__c, Client__r.Cell_Phone__c,
              Client__r.Legal_Name_of_Business__c, Client__r.Trade_Name__c,
              Corp__r.Name, Corp__r.Type__c, Corp__r.Jurisdiction__c, Corp__r.Incorporation_Date__c,
              Corp__r.Age__c, Corp__r.Client_Price__c, Corp__r.DUNS__c`;

// List queries stay bounded per CLAUDE.md §1 — a client with more orders/payments than
// these only sees the most recent MAX_* in the relevant list.
const MAX_ORDERS = 50;
const MAX_PAYMENTS = 100;

/**
 * Live Salesforce adapter for the portal read model. Maps the fat SF objects
 * (Online_Order__c / Online_Payment__c / FU_User__c / SC_Corp__c) into the thin portal
 * DTOs — raw SF field names never leak upward (CLAUDE.md §2). Scoped to Brand__c='WSC'
 * and to the caller's own client record (row-level authz — docs/salesforce-data-model.md).
 */
export class SalesforcePortalRepository implements PortalRepository {
  constructor(private readonly query: SalesforceQuery) {}

  async listOrdersByEmail(email: string): Promise<OrdersList | null> {
    const safeEmail = soqlEscape(email);
    const orderRecords = await this.query(
      `SELECT ${ORDER_SELECT}
       FROM Online_Order__c
       WHERE Brand__c = 'WSC' AND Client__r.E_Mail__c = '${safeEmail}'
       ORDER BY Order_Date__c DESC NULLS LAST
       LIMIT ${MAX_ORDERS}`,
    );

    const firstOrder = orderRecords[0];
    if (firstOrder) {
      return {
        client: this.mapClient(email, obj(firstOrder.Client__r), firstOrder),
        orders: orderRecords.map((record) => this.mapOrder(record, [])),
      };
    }

    // No orders yet — still resolve the client so the list page can render an honest
    // empty state instead of a hard 404 for a client with zero orders.
    const client = await this.findClientByEmail(email);
    return client ? { client: { ...client, phone: null, businessName: null }, orders: [] } : null;
  }

  async getOrderByEmailAndId(email: string, orderId: string): Promise<OrderDetail | null> {
    const safeEmail = soqlEscape(email);
    const safeOrderId = soqlEscape(orderId);
    const orders = await this.query(
      `SELECT ${ORDER_SELECT}
       FROM Online_Order__c
       WHERE Brand__c = 'WSC' AND Client__r.E_Mail__c = '${safeEmail}' AND Id = '${safeOrderId}'
       LIMIT 1`,
    );

    const orderRecord = orders[0];
    if (!orderRecord) {
      return null;
    }

    const paymentRecords = await this.paymentsFor(orderRecord);
    return this.toOrderDetail(email, orderRecord, paymentRecords);
  }

  async listPaymentsByEmail(email: string): Promise<PaymentsList | null> {
    const safeEmail = soqlEscape(email);
    const records = await this.query(
      `SELECT Id, Amount__c, Payment_Method__c, Status__c, Status_Date__c,
              Online_Order__c, Online_Order__r.Name, Online_Order__r.Corp_Name__c,
              Online_Order__r.Corp__r.Name
       FROM Online_Payment__c
       WHERE Online_Order__r.Brand__c = 'WSC' AND Online_Order__r.Client__r.E_Mail__c = '${safeEmail}'
       ORDER BY Status_Date__c DESC NULLS LAST
       LIMIT ${MAX_PAYMENTS}`,
    );

    if (records.length === 0) {
      // Zero payments could mean "client with no verified payments yet" (honest empty
      // state) or "no such client" — only the latter should look like an error.
      const client = await this.findClientByEmail(email);
      return client ? { payments: [] } : null;
    }

    const payments = records.map((record) => {
      const orderRel = obj(record.Online_Order__r);
      const corpRel = obj(orderRel?.Corp__r);
      const productName = str(corpRel?.Name) ?? str(orderRel?.Corp_Name__c);
      return this.mapPayment(str(record.Online_Order__c) ?? "", str(orderRel?.Name) ?? "—", productName, record);
    });
    return { payments };
  }

  /** email → FU_User__c (ADR-0005). Brand-scoped isn't needed here: FU_User__c isn't
   *  brand-specific, unlike Online_Order__c — the row-level scoping happens at the
   *  order/payment read above, keyed off this resolved client id. */
  async findClientByEmail(email: string): Promise<ClientIdentity | null> {
    const safeEmail = soqlEscape(email);
    const clients = await this.query(
      `SELECT Id, Name, E_Mail__c FROM FU_User__c WHERE E_Mail__c = '${safeEmail}' LIMIT 1`,
    );
    const record = clients[0];
    if (!record) {
      return null;
    }
    return {
      id: str(record.Id) ?? "",
      email: str(record.E_Mail__c) ?? email,
      name: str(record.Name) ?? "Client",
    };
  }

  private async paymentsFor(orderRecord: SalesforceRecord): Promise<SalesforceRecord[]> {
    const orderId = str(orderRecord.Id) ?? "";
    return this.query(
      `SELECT Id, Amount__c, Payment_Method__c, Status__c, Status_Date__c
       FROM Online_Payment__c
       WHERE Online_Order__c = '${soqlEscape(orderId)}'
       ORDER BY Status_Date__c DESC NULLS LAST`,
    );
  }

  private mapClient(email: string, clientRel: SalesforceRecord | null, orderRecord: SalesforceRecord): Client {
    return {
      id: str(orderRecord.Client__c) ?? "",
      email: str(clientRel?.E_Mail__c) ?? email,
      name: str(clientRel?.Name) ?? "Client",
      phone: str(clientRel?.Phone__c) ?? str(clientRel?.Cell_Phone__c),
      businessName: str(clientRel?.Legal_Name_of_Business__c) ?? str(clientRel?.Trade_Name__c),
    };
  }

  /** Maps one order record. `paymentRecords` is optional — the list endpoint omits it
   *  (never one SOQL call per row, CLAUDE.md §1) and relies on the `Total_Payments__c`
   *  rollup instead; the detail endpoint passes the real payments for a same-transaction
   *  reconciliation of `paidToDate`. */
  private mapOrder(orderRecord: SalesforceRecord, paymentRecords: SalesforceRecord[]): Order {
    const corpRel = obj(orderRecord.Corp__r);

    const features = (str(orderRecord.Paid_Features_Selected__c) ?? "")
      .split(/[\n,]/)
      .map((feature) => feature.trim())
      .filter((feature) => feature.length > 0);

    const shelfCorp: ShelfCorp | null = corpRel
      ? {
          id: str(orderRecord.Corp__c) ?? "",
          name: str(corpRel.Name) ?? str(orderRecord.Corp_Name__c) ?? "Shelf Corporation",
          entityType: str(corpRel.Type__c) ?? "—",
          stateOfFormation: str(corpRel.Jurisdiction__c) ?? "—",
          incorporationDate: str(corpRel.Incorporation_Date__c),
          agedYears: num(corpRel.Age__c),
          price: typeof corpRel.Client_Price__c === "number" ? corpRel.Client_Price__c : null,
          duns: str(corpRel.DUNS__c),
          creditReadyFeatures: features,
        }
      : null;

    const orderId = str(orderRecord.Id) ?? "";
    const orderNumber = str(orderRecord.Name) ?? "—";
    const productName = shelfCorp?.name ?? null;
    const payments = paymentRecords.map((record) => this.mapPayment(orderId, orderNumber, productName, record));

    const amount = num(orderRecord.Amount__c);
    const paidFromField = num(orderRecord.Total_Payments__c);
    const paidFromPayments = payments
      .filter((payment) => payment.isVerified)
      .reduce((total, payment) => total + payment.amount, 0);
    const paidToDate = paidFromField > 0 ? paidFromField : paidFromPayments;

    return {
      id: orderId,
      orderNumber,
      amount,
      paidToDate,
      balanceDue: Math.max(amount - paidToDate, 0),
      statusSf: str(orderRecord.Status__c) ?? "",
      placedAt: str(orderRecord.Order_Date__c),
      advisorName: str(orderRecord.SR_Name__c),
      paymentMethod: str(orderRecord.Payment_Method__c) ? toMethod(orderRecord.Payment_Method__c) : null,
      shelfCorp,
      clientId: str(orderRecord.Client__c) ?? "",
    };
  }

  private mapPayment(
    orderId: string,
    orderNumber: string,
    productName: string | null,
    record: SalesforceRecord,
  ): Payment {
    const statusSf = str(record.Status__c) ?? "";
    return {
      id: str(record.Id) ?? "",
      orderId,
      orderNumber,
      productName,
      amount: num(record.Amount__c),
      method: toMethod(record.Payment_Method__c),
      statusSf,
      isVerified: isVerified(statusSf),
      statusDate: str(record.Status_Date__c),
    };
  }

  private toOrderDetail(
    email: string,
    orderRecord: SalesforceRecord,
    paymentRecords: SalesforceRecord[],
  ): OrderDetail {
    const client = this.mapClient(email, obj(orderRecord.Client__r), orderRecord);
    const order = this.mapOrder(orderRecord, paymentRecords);
    const orderId = str(orderRecord.Id) ?? "";
    const orderNumber = str(orderRecord.Name) ?? "—";
    const productName = order.shelfCorp?.name ?? null;
    const payments = paymentRecords.map((record) => this.mapPayment(orderId, orderNumber, productName, record));
    return { client, order, payments };
  }
}
