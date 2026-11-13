import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import * as authService from "../service/authService";
import { validatePassword } from "../utils/password";
import PasswordInput from "./PasswordInput";
import PasswordChecklist from "./PasswordChecklist";

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!current) return setError("Enter your current password.");
    if (validatePassword(next).length)
      return setError("New password does not meet the requirements.");
    if (next !== confirm) return setError("New passwords do not match.");
    setLoading(true);
    try {
      await authService.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white">Change password</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-300">
              Your password was changed.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              Close
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
            <PasswordInput
              id="cp-current"
              label="Current password"
              value={current}
              onChange={setCurrent}
            />
            <PasswordInput
              id="cp-new"
              label="New password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
            />
            <PasswordChecklist password={next} />
            <PasswordInput
              id="cp-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Change password</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
