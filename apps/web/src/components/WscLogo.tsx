interface WscLogoProps {
  /** Which wordmark sits under the letters. "full" is the .com lockup on the login card,
   *  "short" the compressed sidebar version, "none" the letters on their own. */
  wordmark: "full" | "short" | "none";
}

/**
 * The WSC lockup — navy "WS", red "C", over the WHOLESALESHELFCORPORATIONS.COM wordmark.
 *
 * Set in type rather than placed as an image because the repo carries no brand asset (the
 * prototype drew it the same way). If a real logo file is added under apps/web/public,
 * this component is the only file that has to change.
 */
export function WscLogo({ wordmark }: WscLogoProps) {
  return (
    <>
      <div className="wsc-logo">
        WS<span className="c">C</span>
      </div>
      {wordmark === "full" && (
        <div className="wmark">
          <b>W</b>HOLESALE<b>S</b>HELF<b>C</b>ORPORATIONS.COM
        </div>
      )}
      {wordmark === "short" && (
        <div className="sl-sub">
          <b>W</b>HOLESALE<b>S</b>HELF<b>C</b>ORP
        </div>
      )}
    </>
  );
}
