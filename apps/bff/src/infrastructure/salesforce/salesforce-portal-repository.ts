import {
  VERIFIED_PAYMENT_STATUSES,
  type Client,
  type Order,
  type OrderDashboard,
  type Payment,
  type PaymentMethod,
  type ShelfCorp,
} from "@wsc/shared";
import type { PortalRepository } from "../../application/ports/portal-repository.js";
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

/**
 * Live Salesforce adapter for the portal read model. Maps the fat SF objects
 * (Online_Order__c / Online_Payment__c / FU_User__c / SC_Corp__c) into the thin portal
 * DTOs — raw SF field names never leak upward (CLAUDE.md §2). Scoped to Brand__c='WSC'
 * and to the caller's own client record (row-level authz — docs/salesforce-data-model.md).
 */
export class SalesforcePortalRepository implements PortalRepository {
  constructor(private readonly query: SalesforceQuery) {}

  async getDashboardByEmail(email: string): Promise<OrderDashboard | null> {
    const safeEmail = soqlEscape(email);
    const orders = await this.query(
      `SELECT Id, Name, Amount__c, Total_Payments__c, Status__c, Order_Date__c, SR_Name__c,
              Payment_Method__c, Paid_Features_Selected__c, Client__c, Corp__c, Corp_Name__c,
              Client__r.Name, Client__r.E_Mail__c, Client__r.Phone__c, Client__r.Cell_Phone__c,
              Client__r.Legal_Name_of_Business__c, Client__r.Trade_Name__c,
              Corp__r.Name, Corp__r.Type__c, Corp__r.Jurisdiction__c, Corp__r.Incorporation_Date__c,
              Corp__r.Age__c, Corp__r.Client_Price__c, Corp__r.DUNS__c
       FROM Online_Order__c
       WHERE Brand__c = 'WSC' AND Client__r.E_Mail__c = '${safeEmail}'
       ORDER BY Order_Date__c DESC NULLS LAST
       LIMIT 1`,
    );

    const orderRecord = orders[0];
    if (!orderRecord) {
      return null;
    }

    const orderId = str(orderRecord.Id) ?? "";
    const paymentRecords = await this.query(
      `SELECT Id, Amount__c, Payment_Method__c, Status__c, Status_Date__c
       FROM Online_Payment__c
       WHERE Online_Order__c = '${soqlEscape(orderId)}'
       ORDER BY Status_Date__c DESC NULLS LAST`,
    );

    return this.toDashboard(email, orderRecord, paymentRecords);
  }

  private toDashboard(
    email: string,
    orderRecord: SalesforceRecord,
    paymentRecords: SalesforceRecord[],
  ): OrderDashboard {
    const clientRel = obj(orderRecord.Client__r);
    const corpRel = obj(orderRecord.Corp__r);

    const client: Client = {
      id: str(orderRecord.Client__c) ?? "",
      email: str(clientRel?.E_Mail__c) ?? email,
      name: str(clientRel?.Name) ?? "Client",
      phone: str(clientRel?.Phone__c) ?? str(clientRel?.Cell_Phone__c),
      businessName: str(clientRel?.Legal_Name_of_Business__c) ?? str(clientRel?.Trade_Name__c),
    };

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

    const payments: Payment[] = paymentRecords.map((record) => {
      const statusSf = str(record.Status__c) ?? "";
      return {
        id: str(record.Id) ?? "",
        orderId: str(orderRecord.Id) ?? "",
        amount: num(record.Amount__c),
        method: toMethod(record.Payment_Method__c),
        statusSf,
        isVerified: isVerified(statusSf),
        statusDate: str(record.Status_Date__c),
      };
    });

    const amount = num(orderRecord.Amount__c);
    const paidFromField = num(orderRecord.Total_Payments__c);
    const paidFromPayments = payments
      .filter((payment) => payment.isVerified)
      .reduce((total, payment) => total + payment.amount, 0);
    const paidToDate = paidFromField > 0 ? paidFromField : paidFromPayments;

    const order: Order = {
      id: str(orderRecord.Id) ?? "",
      orderNumber: str(orderRecord.Name) ?? "—",
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

    return { client, order, payments };
  }
}
