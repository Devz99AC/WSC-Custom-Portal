/**
 * Badge tone for a credit-ready feature's Salesforce status. Presentation only — the status
 * string itself is data from Salesforce (`WSC_Feature_Order__c.Status__c`), so the label is
 * never hardcoded here (CLAUDE.md §1); this maps a status to one of the shared badge classes
 * (theme.css). An unknown status falls back to the neutral "in progress" tone rather than
 * throwing, so a new picklist value added in Salesforce degrades instead of breaking the page.
 */
export function featureStatusBadgeClass(status: string): string {
  switch (status) {
    case "Complete":
      return "b-ok";
    case "Waiting on Client":
    case "Waiting on Supplier":
      return "b-hold";
    case "Unpaid":
      return "b-dang";
    case "Working":
    default:
      return "b-warn";
  }
}
