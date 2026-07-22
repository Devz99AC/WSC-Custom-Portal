import { useState, type FormEvent } from "react";
import { requestMagicLink } from "../api/client";

/**
 * Passwordless magic-link login (ADR-0005). Submitting posts to the BFF, which emails a
 * one-time link — this screen never learns whether the email matched an account
 * (anti-enumeration; the BFF's response is intentionally generic either way).
 */
export function Login() {
  const [email, setEmail] = useState("m.brown@acmeholdings.com");
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
          <div className="wsc-logo">
            WS<span className="c">C</span>
          </div>
          <h1 className="disp">Check your email</h1>
          <p className="sub">
            If <strong>{email}</strong> is on file, a secure sign-in link is on its way —
            it expires in 15 minutes and works once.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="wsc-logo">
          WS<span className="c">C</span>
        </div>
        <div className="wmark">
          <b>W</b>HOLESALE<b>S</b>HELF<b>C</b>ORPORATIONS.COM
        </div>
        <div className="kicker">Client Portal</div>
        <h1 className="disp">Welcome back</h1>
        <p className="sub">
          Enter your email and we&apos;ll send a secure sign-in link — no password to
          remember.
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
          />
        </div>
        <button className="btn-gold" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send secure sign-in link"}
        </button>
        {status === "error" && (
          <p className="err">Something went wrong — please try again.</p>
        )}
        <p className="login-foot">
          Trouble signing in? Call your advisor
          <br />
          +1 (720) 534-2065
        </p>
      </form>
      <div className="login-mark">Established 2010 — 16 Years of Experience</div>
    </div>
  );
}
