import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import * as authService from "../services/authService";
import { validatePassword } from "../utils/password";
import AuthShell, { inputCls, primaryBtn } from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";
import PasswordChecklist from "../components/PasswordChecklist";

export default function ResetPasswordPage({ onNavigate, initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !code.trim())
      return setError("Enter your email and the reset code.");
    if (validatePassword(password).length)
      return setError("New password does not meet the requirements.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await authService.resetPassword(email, code, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter the code from your email"
    >
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 space-y-4">
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-300">
              Password updated. You can sign in now.
            </p>
            <button onClick={() => onNavigate("login")} className={primaryBtn}>
              Go to sign in
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
                htmlFor="rp-email"
                className="block text-xs text-slate-400 mb-1"
              >
                Email
              </label>
              <input
                id="rp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label
                htmlFor="rp-code"
                className="block text-xs text-slate-400 mb-1"
              >
                Reset code
              </label>
              <input
                id="rp-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputCls} font-mono tracking-widest`}
              />
            </div>
            <PasswordInput
              id="rp-new"
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <PasswordChecklist password={password} />
            <PasswordInput
              id="rp-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <button type="submit" disabled={loading} className={primaryBtn}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Update password</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("login")}
              className="w-full text-xs text-slate-400 hover:text-slate-200"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
