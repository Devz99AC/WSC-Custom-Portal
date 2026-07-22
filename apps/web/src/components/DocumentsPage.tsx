/**
 * "Documents" — ported from apps/web/public/prototype.html, minus its illustrative
 * fake PDFs and notes: there is no real document-vault backend yet (Phase 3, S3 +
 * DocuSign/PandaDoc). Showing invented file names to a signed-in client would be
 * misleading, so this renders an honest empty state until that adapter exists.
 */
export function DocumentsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Documents</h2>
          <p>Files and notes shared by your team</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">Attachments</div>
        <p className="statusnote">
          No documents have been shared yet — signed paperwork and receipts will appear here
          once your advisor uploads them.
        </p>
      </div>
    </>
  );
}
