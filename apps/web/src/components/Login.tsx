import { useState, type FormEvent } from "react";
import { WSC_ESTABLISHED_YEAR, yearsInBusiness } from "@wsc/shared";
import { requestMagicLink } from "../api/client";
import { WscLogo } from "./WscLogo";

/**
 * Counted from the real founding date at render rather than typed into the markup, so the
 * number is still true after the next anniversary instead of quietly aging into a false
 * claim. Reading the clock here is the side effect at the edge; the arithmetic itself is
 * pure and lives in `@wsc/shared`.
 */
function establishedMark(): string {
  const years = yearsInBusiness(new Date());
  return `Established ${WSC_ESTABLISHED_YEAR} — ${years} ${years === 1 ? "Year" : "Years"} of Experience`;
}

/**
 * Passwordless magic-link login (ADR-0005). Submitting posts to the BFF, which emails a
 * one-time link — this screen never learns whether the email matched an account
 * (anti-enumeration; the BFF's response is intentionally generic either way).
 */
export function Login() {
  // Starts empty on purpose. This field used to be pre-filled with the sandbox demo client
  // (`m.brown@acmeholdings.com`) as a dev convenience, which on a public login screen shows
  // a real-looking stranger's address to every visitor and invites them to request a link
  // for an account that isn't theirs.
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const linkWasInvalid = new URLSearchParams(window.location.search).has("login_error");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    setStatus("sending");
    try {
      await requestMagicLink(trimmed);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="login">
        <div className="login-card">
          <WscLogo variant="full" />
          <div className="login-tick" aria-hidden="true">
            ✓
          </div>
          <h1 className="disp">Check your email</h1>
          <p className="sub">
            If <strong className="login-echo">{email}</strong> is on file, a secure sign-in link is
            on its way — it expires in 15 minutes and works once.
          </p>
          {/* Without this a typo is a dead end: the address is never echoed back anywhere
              else, so the only way to correct it is to reload the page by hand. */}
          <button className="btn-quiet" type="button" onClick={() => setStatus("idle")}>
            Use a different email
          </button>
        </div>
        <div className="login-mark">{establishedMark()}</div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <WscLogo variant="full" />
        <div className="kicker">Client Portal</div>
        <h1 className="disp">Welcome back</h1>
        <p className="sub">
          Enter your email and we&apos;ll send a secure sign-in link — no password to remember.
        </p>
        {linkWasInvalid && (
          <p className="err">That link is invalid or expired — request a new one below.</p>
        )}
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            // Phone keyboards otherwise capitalise the first letter and offer to
            // autocorrect the domain, both of which corrupt an address mid-typing.
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </div>
        <button className="btn-gold" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send secure sign-in link"}
        </button>
        {status === "error" && <p className="err">Something went wrong — please try again.</p>}
        <p className="login-foot">
          Trouble signing in? Call your advisor
          <br />
          <a href="tel:+17205342065">+1 (720) 534-2065</a>
        </p>
      </form>
      <div className="login-mark">{establishedMark()}</div>
    </div>
  );
}
