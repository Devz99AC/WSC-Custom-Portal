import {
  VERIFIED_PAYMENT_STATUSES,
  type Client,
  type CreditReadyFeature,
  type DocumentsList,
  type Order,
  type OrderDetail,
  type OrdersList,
  type Payment,
  type PaymentMethod,
  type PaymentsList,
  type PortalDocument,
  type ShelfCorp,
  type StaffContact,
  type StaffRole,
} from "@wsc/shared";
import type {
  ClientIdentity,
  DocumentDownload,
  PortalRepository,
} from "../../application/ports/portal-repository.js";
import type {
  SalesforceAttachmentBody,
  SalesforceQuery,
  SalesforceRecord,
} from "./salesforce-query.js";

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

/** The staff fields, identical for all three roles — they're the same object
 *  (`SEOX3_Team_Member__c`) reached through three different lookups. */
const staffSelect = (relationship: string): string =>
  [
    `${relationship}.Name`,
    `${relationship}.WSC_EMail__c`,
    `${relationship}.Corporate_E_Mail__c`,
    `${relationship}.Corporate_Phone__c`,
    `${relationship}.What_s_App__c`,
  ].join(", ");

const ORDER_SELECT = `Id, Name, Amount__c, Total_Payments__c, Status__c, Status_Date__c,
              On_Hold_Reason__c, TimeStamp_Verified_IC__c, TimeStamp_Verified_Complete__c,
              Order_Date__c, Fully_Paid_Date__c, SR_Name__c, Payment_Method__c,
              Payment_Frequency__c, Paid_Features_Selected__c, Client__c, Corp__c, Corp_Name__c,
              Client__r.Name, Client__r.E_Mail__c, Client__r.Phone__c, Client__r.Cell_Phone__c,
              Client__r.Legal_Name_of_Business__c, Client__r.Trade_Name__c,
              Corp__r.Name, Corp__r.Type__c, Corp__r.Jurisdiction__c, Corp__r.Incorporation_Date__c,
              Corp__r.Age__c, Corp__r.DUNS__c,
              Corp__r.Registration__c,
              Corp__r.Last_Annual_Report__c, Corp__r.Next_Annual_Report__c,
              ${staffSelect("Sales_Rep__r")}, ${staffSelect("QC_Agent__r")},
              ${staffSelect("Back_End_Worker__r")}`;

/* There is no longer a separate detail projection. It existed solely to keep `EIN__c` out
 * of the list payload; with the EIN gone from the portal entirely (2026-08-07) the list and
 * detail reads want exactly the same fields. If a detail-only field is ever added back,
 * re-split rather than widening ORDER_SELECT — the list endpoint returns every order the
 * client owns, so anything added there is multiplied across all of them. */

// List queries stay bounded per CLAUDE.md §1 — a client with more orders/payments than
// these only sees the most recent MAX_* in the relevant list.
const MAX_ORDERS = 50;
const MAX_PAYMENTS = 100;
const MAX_DOCUMENTS = 200;
const MAX_FEATURES = 200;

/**
 * Trash-data filter — stakeholder rule (2026-08-07): the portal must NEVER surface
 * **Cancelled orders** or **Inactive clients**. Nothing is deleted in Salesforce; these
 * records simply never get read. The five `Cancelled - *` order statuses all share the
 * "Cancelled" prefix, so one prefix match covers every variant; `FU_User__c.Status__c` is
 * New / Active / Inactive. Both filters deliberately keep NULL-status records IN — a null
 * status is neither "Cancelled" nor "Inactive", and a half-filled record must not vanish.
 *
 * The Cancelled filter rides on every order/payment read. The Inactive filter rides on
 * `findClientByEmail` ALONE, on purpose: that is the identity gate the magic-link sign-in
 * passes through (request-magic-link.ts), so an Inactive client never receives a link,
 * never gets a session, and therefore never reaches any data read — one choke point
 * instead of a client-status check copy-pasted onto every query.
 */
const ORDER_NOT_CANCELLED = "(NOT Status__c LIKE 'Cancelled%')";
const PAYMENT_ORDER_NOT_CANCELLED = "(NOT Online_Order__r.Status__c LIKE 'Cancelled%')";
const CLIENT_NOT_INACTIVE = "(Status__c != 'Inactive' OR Status__c = null)";

/** Renders ids as a SOQL `IN` list. Ids come from Salesforce itself (never from the
 *  caller), but they're escaped anyway so this can't become an injection point if a
 *  future caller passes one through. */
const soqlIdList = (ids: readonly string[]): string =>
  ids.map((id) => `'${soqlEscape(id)}'`).join(", ");

/**
 * Live Salesforce adapter for the portal read model. Maps the fat SF objects
 * (Online_Order__c / Online_Payment__c / FU_User__c / SC_Corp__c) into the thin portal
 * DTOs — raw SF field names never leak upward (CLAUDE.md §2). Scoped to Brand__c='WSC'
 * and to the caller's own client record (row-level authz — docs/salesforce-data-model.md).
 */
export class SalesforcePortalRepository implements PortalRepository {
  constructor(
    private readonly query: SalesforceQuery,
    private readonly attachmentBody: SalesforceAttachmentBody,
  ) {}

  async listOrdersByEmail(email: string): Promise<OrdersList | null> {
    const safeEmail = soqlEscape(email);
    const orderRecords = await this.query(
      `SELECT ${ORDER_SELECT}
       FROM Online_Order__c
       WHERE Brand__c = 'WSC' AND Client__r.E_Mail__c = '${safeEmail}' AND ${ORDER_NOT_CANCELLED}
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
       WHERE Brand__c = 'WSC' AND Client__r.E_Mail__c = '${safeEmail}' AND ${ORDER_NOT_CANCELLED} AND Id = '${safeOrderId}'
       LIMIT 1`,
    );

    const orderRecord = orders[0];
    if (!orderRecord) {
      return null;
    }

    const paymentRecords = await this.paymentsFor(orderRecord);
    const features = await this.featuresFor(orderRecord);
    return this.toOrderDetail(email, orderRecord, paymentRecords, features);
  }

  async listPaymentsByEmail(email: string): Promise<PaymentsList | null> {
    const safeEmail = soqlEscape(email);
    const records = await this.query(
      `SELECT Id, Amount__c, Payment_Method__c, Status__c, Status_Date__c,
              Online_Order__c, Online_Order__r.Name, Online_Order__r.Corp_Name__c,
              Online_Order__r.Corp__r.Name
       FROM Online_Payment__c
       WHERE Online_Order__r.Brand__c = 'WSC' AND Online_Order__r.Client__r.E_Mail__c = '${safeEmail}' AND ${PAYMENT_ORDER_NOT_CANCELLED}
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

  /**
   * Documents for the client. **Attachments always hang off `Online_Order__c`** — never
   * off the corp (stakeholder rule, 2026-07-28) — so the parent set is exactly the
   * client's own orders, which is also what makes this row-level safe: an Attachment
   * outside that set is simply never selected. Each file is then filed under the parent
   * order's `Corp__c`, because the portal groups by the product the client recognizes
   * ("Devin LLC"), not by order number.
   */
  async listDocumentsByEmail(email: string): Promise<DocumentsList | null> {
    const orders = await this.clientOrderIndex(email);
    if (!orders) {
      return null;
    }
    if (orders.size === 0) {
      return { documents: [] };
    }

    const records = await this.query(
      `SELECT Id, Name, ContentType, BodyLength, Description, CreatedDate, ParentId
       FROM Attachment
       WHERE ParentId IN (${soqlIdList([...orders.keys()])})
       ORDER BY CreatedDate DESC
       LIMIT ${MAX_DOCUMENTS}`,
    );

    const documents = records.flatMap((record) => {
      const parent = orders.get(str(record.ParentId) ?? "");
      // Defensive: the IN clause already guarantees a hit, so a miss would mean the
      // parent set and the result drifted — drop it rather than emit a half-mapped row.
      return parent ? [this.mapDocument(record, parent)] : [];
    });
    return { documents };
  }

  async getDocumentForDownload(email: string, documentId: string): Promise<DocumentDownload | null> {
    // Authorization first: re-derive what this client is allowed to see and refuse
    // anything outside it. The id from the URL is never trusted on its own.
    const list = await this.listDocumentsByEmail(email);
    const document = list?.documents.find((candidate) => candidate.id === documentId);
    if (!document) {
      return null;
    }
    const body = await this.attachmentBody(document.id);
    return body ? { document, body } : null;
  }

  /** The client's own orders as `orderId → { orderNumber, shelfCorpId }`. Null when the
   *  email doesn't resolve to a client at all (vs. a client with no orders → empty map). */
  private async clientOrderIndex(
    email: string,
  ): Promise<Map<string, { orderNumber: string; shelfCorpId: string | null }> | null> {
    const safeEmail = soqlEscape(email);
    const records = await this.query(
      `SELECT Id, Name, Corp__c
       FROM Online_Order__c
       WHERE Brand__c = 'WSC' AND Client__r.E_Mail__c = '${safeEmail}' AND ${ORDER_NOT_CANCELLED}
       ORDER BY Order_Date__c DESC NULLS LAST
       LIMIT ${MAX_ORDERS}`,
    );

    if (records.length === 0) {
      return (await this.findClientByEmail(email)) ? new Map() : null;
    }

    const index = new Map<string, { orderNumber: string; shelfCorpId: string | null }>();
    for (const record of records) {
      const id = str(record.Id);
      if (id) {
        index.set(id, { orderNumber: str(record.Name) ?? "—", shelfCorpId: str(record.Corp__c) });
      }
    }
    return index;
  }

  private mapDocument(
    record: SalesforceRecord,
    parent: { orderNumber: string; shelfCorpId: string | null },
  ): PortalDocument {
    return {
      id: str(record.Id) ?? "",
      name: str(record.Name) ?? "Untitled",
      contentType: str(record.ContentType),
      sizeBytes: num(record.BodyLength),
      description: str(record.Description),
      sharedAt: str(record.CreatedDate),
      shelfCorpId: parent.shelfCorpId,
      orderId: str(record.ParentId) ?? "",
      orderNumber: parent.orderNumber,
    };
  }

  /** email → FU_User__c (ADR-0005). Brand-scoped isn't needed here: FU_User__c isn't
   *  brand-specific, unlike Online_Order__c — the row-level scoping happens at the
   *  order/payment read above, keyed off this resolved client id. */
  async findClientByEmail(email: string): Promise<ClientIdentity | null> {
    const safeEmail = soqlEscape(email);
    const clients = await this.query(
      `SELECT Id, Name, E_Mail__c FROM FU_User__c WHERE E_Mail__c = '${safeEmail}' AND ${CLIENT_NOT_INACTIVE} LIMIT 1`,
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

  /**
   * Credit-ready features ordered for one order — `WSC_Feature_Order__c`, one record per
   * feature, identified by its record type. Only the record-type NAME and `Status__c` leave
   * Salesforce; the object also holds credentials, PINs and prices (`Password__c`,
   * `DNB_Secret_PIN__c`, `EIN_Number__c`, `Price_Charged__c`…) that never reach the client
   * (entities.ts `CreditReadyFeature`). `Cancelled` is dropped — a cancelled item isn't part
   * of the package. Scoped by the order id alone, exactly like `paymentsFor`: the order was
   * already fetched under the caller's own email, so its children are transitively theirs.
   */
  private async featuresFor(orderRecord: SalesforceRecord): Promise<CreditReadyFeature[]> {
    const orderId = str(orderRecord.Id) ?? "";
    const records = await this.query(
      `SELECT RecordType.Name, Status__c
       FROM WSC_Feature_Order__c
       WHERE Online_Order__c = '${soqlEscape(orderId)}' AND Status__c != 'Cancelled'
       ORDER BY RecordType.Name
       LIMIT ${MAX_FEATURES}`,
    );
    return records.flatMap((record) => {
      const feature = str(obj(record.RecordType)?.Name);
      // The record type is what NAMES the feature; a missing one means its FLS is closed for
      // the integration user, not that the feature is nameless — drop it over a blank row.
      return feature ? [{ feature, status: str(record.Status__c) ?? "—" }] : [];
    });
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
          duns: str(corpRel.DUNS__c),
          creditReadyFeatures: features,
          registrationNumber: str(corpRel.Registration__c),
          lastAnnualReportDate: str(corpRel.Last_Annual_Report__c),
          nextRenewalDate: str(corpRel.Next_Annual_Report__c),
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
      statusUpdatedAt: str(orderRecord.Status_Date__c),
      onHoldReason: str(orderRecord.On_Hold_Reason__c),
      placedAt: str(orderRecord.Order_Date__c),
      fullyPaidAt: str(orderRecord.Fully_Paid_Date__c),
      initialContactAt: str(orderRecord.TimeStamp_Verified_IC__c),
      completedAt: str(orderRecord.TimeStamp_Verified_Complete__c),
      advisor: this.mapStaff("advisor", obj(orderRecord.Sales_Rep__r), str(orderRecord.SR_Name__c)),
      supportManager: this.mapStaff("support-manager", obj(orderRecord.QC_Agent__r), null),
      backEndSupport: this.mapStaff("backend-support", obj(orderRecord.Back_End_Worker__r), null),
      paymentMethod: str(orderRecord.Payment_Method__c) ? toMethod(orderRecord.Payment_Method__c) : null,
      paymentFrequency: str(orderRecord.Payment_Frequency__c),
      shelfCorp,
      clientId: str(orderRecord.Client__c) ?? "",
    };
  }

  /**
   * Maps one of the three staff lookups. `fallbackName` covers the advisor specifically:
   * `SR_Name__c` is a plain text field the sales team fills in and is populated on real
   * orders even when the `Sales_Rep__c` lookup isn't — dropping to the lookup alone would
   * make the advisor's name vanish from orders that currently show it.
   *
   * Returns null when there's no name at all, so the UI can say "not yet assigned"
   * instead of rendering an empty card.
   */
  private mapStaff(
    role: StaffRole,
    member: SalesforceRecord | null,
    fallbackName: string | null,
  ): StaffContact | null {
    const name = str(member?.Name) ?? fallbackName;
    if (!name) {
      return null;
    }
    return {
      role,
      name,
      // Brand-specific address first: this is the WSC portal, and a team member can hold
      // a different mailbox per brand.
      email: str(member?.WSC_EMail__c) ?? str(member?.Corporate_E_Mail__c),
      phone: str(member?.Corporate_Phone__c),
      whatsAppNumber: str(member?.What_s_App__c),
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
    creditReadyFeatures: CreditReadyFeature[],
  ): OrderDetail {
    const client = this.mapClient(email, obj(orderRecord.Client__r), orderRecord);
    const order = this.mapOrder(orderRecord, paymentRecords);
    const orderId = str(orderRecord.Id) ?? "";
    const orderNumber = str(orderRecord.Name) ?? "—";
    const productName = order.shelfCorp?.name ?? null;
    const payments = paymentRecords.map((record) => this.mapPayment(orderId, orderNumber, productName, record));
    return { client, order, payments, creditReadyFeatures };
  }
}
