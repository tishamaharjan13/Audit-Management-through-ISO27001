import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell, { inputCls, primaryBtn } from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@audit.com", password: "Admin@123" },
  { role: "Auditor", email: "auditor@audit.com", password: "Auditor@123" },
  { role: "Client", email: "client@audit.com", password: "Client@123" },
];

export default function LoginPage({ onNavigate }) {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password)
      return setError("Enter your email and password.");
    setLoading(true);
    try {
      await login(email, password); // App switches to the platform automatically
    } catch (err) {
      setError(err.message || "Login failed. Try again.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="ISO/IEC 27001:2022 Audit Platform"
      subtitle="Sign in to manage your audit"
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 space-y-4"
      >
        {notice && !error && (
          <div
            role="status"
            className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg p-3"
          >
            {notice}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg p-3"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs text-slate-400 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputCls}
          />
        </div>
        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
        />

        <div className="text-right">
          <button
            type="button"
            onClick={() => onNavigate("forgot")}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{loading ? "Signing in..." : "Sign in"}</span>
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Accounts are created by your administrator.
        </p>
      </form>

      {/* Remove this block before the final demo */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-400 mb-3">
          Demo accounts (click to fill the form)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.role}
              type="button"
              onClick={() => {
                setEmail(acc.email);
                setPassword(acc.password);
                setError("");
              }}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg py-2 text-xs font-medium text-slate-200 transition-all"
            >
              {acc.role}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
