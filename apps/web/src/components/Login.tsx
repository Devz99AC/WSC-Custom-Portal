import { useState, type FormEvent } from "react";

interface LoginProps {
  onSignIn: (email: string) => void;
}

/**
 * Passwordless magic-link login (visual). In the demo, "sending the link" resolves the
 * session immediately; in Phase 1 this posts to the BFF, which emails a one-time link.
 */
export function Login({ onSignIn }: LoginProps) {
  const [email, setEmail] = useState("m.brown@acmeholdings.com");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (trimmed) {
      onSignIn(trimmed);
    }
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
        <button className="btn-gold" type="submit">
          Send secure sign-in link
        </button>
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
