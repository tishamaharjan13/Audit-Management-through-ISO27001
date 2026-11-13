import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import * as authService from "../services/authService";
import AuthShell, { inputCls, primaryBtn } from "../components/AuthShell";

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Enter your email.");
    setLoading(true);
    try {
      setResult(await authService.forgotPassword(email));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We send a reset code to your email"
    >
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 space-y-4">
        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">{result.message}</p>
            {result.devCode && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-xs text-indigo-200">
                Demo mode: no email is sent. Your code is{" "}
                <span className="font-mono font-bold text-white">
                  {result.devCode}
                </span>
              </div>
            )}
            <button
              onClick={() => onNavigate("reset", { email })}
              className={primaryBtn}
            >
              Enter reset code
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {error && (
              <div
                role="alert"
                className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg p-3"
              >
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="fp-email"
                className="block text-xs text-slate-400 mb-1"
              >
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={loading} className={primaryBtn}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Send reset code</span>
            </button>
          </form>
        )}
        <button
          onClick={() => onNavigate("login")}
          className="w-full text-xs text-slate-400 hover:text-slate-200"
        >
          Back to sign in
        </button>
      </div>
    </AuthShell>
  );
}
