interface WscLogoProps {
  /** "full" is the complete lockup used on the login card. "short" is the sidebar mark,
   *  which sits on navy and carries its own abbreviated wordmark underneath. */
  variant: "full" | "short";
}

/**
 * The real WSC brand mark, trimmed from the artwork the stakeholder supplied. It used to
 * be set in Arial Black because the repo carried no brand asset at all, which only ever
 * approximated the actual overlapping letterforms.
 *
 * Two files rather than one: the artwork is navy and crimson, and the navy half would
 * vanish against the navy sidebar, so that placement uses a knockout copy with the navy
 * recoloured white. The crimson C is untouched in both. Intrinsic `width`/`height` are the
 * files' real pixel sizes so the browser reserves the right box before the image loads;
 * the rendered size comes from CSS.
 */
export function WscLogo({ variant }: WscLogoProps) {
  if (variant === "short") {
    return (
      <>
        <img
          className="wsc-logo"
          src="/wsc-logo-letters-light.png"
          alt="Wholesale Shelf Corporations"
          width={821}
          height={299}
        />
        {/* Says the same words as the alt text above, so it is decoration to a screen
            reader rather than a second announcement. */}
        <div className="sl-sub" aria-hidden="true">
          <b>W</b>HOLESALE<b>S</b>HELF<b>C</b>ORP
        </div>
      </>
    );
  }

  return (
    <img
      className="wsc-logo"
      src="/wsc-logo.png"
      alt="Wholesale Shelf Corporations"
      width={821}
      height={360}
    />
  );
}
