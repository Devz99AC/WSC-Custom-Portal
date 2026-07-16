# Seeds ONE live WSC order so the demo can read real Salesforce data.
#
# Why this shape: Online_Order__c has 126 validation rules, but ~all are gated on LATER
# statuses. At the initial status "To Verify Payment" none of the blocking rules fire, so a
# minimal order (client + brand + email + amount) is valid — NO corp, NO payments required.
# SC_Corp__c is intentionally skipped (its Investment_Batch__c/Investment_Batch_Detail__c
# lookups are required on create and would need investor records first). The dashboard hides
# the product card when there's no corp. See docs/salesforce-data-model.md.
#
# Run from the repo root AFTER `sf org login` (alias wsc-sandbox). Reuses an existing
# FU_User (Marcus Brown) so it does not create duplicates.

$ORG = "wsc-sandbox"
$EMAIL = "m.brown@acmeholdings.com"
$WSC_RECORDTYPE = "0120g000000QEpmAAG"          # Online_Order__c "WSC" record type
$CLIENT = "a0xVF0000028APFYA2"                   # existing FU_User (Marcus Brown)

$o = sf data create record --sobject Online_Order__c --values "RecordTypeId=$WSC_RECORDTYPE Brand__c='WSC' Client__c=$CLIENT E_Mail__c='$EMAIL' Status__c='To Verify Payment' Amount__c=8750 Order_Date__c=2026-05-02 Payment_Method__c='Wire Transfer' SR_Name__c='Rinkie S.' Name__c='Marcus Brown' Company_Name__c='Acme Holdings LLC'" --target-org $ORG --json | ConvertFrom-Json

if ($o.result.id) {
  Write-Host "OK  Online_Order__c -> $($o.result.id)"
  Write-Host "Demo login email: $EMAIL"
} else {
  Write-Host "FAILED:"
  Write-Host $o.message
}
