import React, { useState, useEffect, useCallback } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import * as authService from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { validatePassword } from "../utils/password";
import { inputCls } from "../components/AuthShell";
import PasswordChecklist from "../components/PasswordChecklist";

const generatePassword = () => "Aa1!" + Math.random().toString(36).slice(2, 10);
const EMPTY = { name: "", email: "", role: "client", password: "" };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await authService.listUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    if (validatePassword(form.password).length)
      return setError("Temporary password does not meet the requirements.");
    setSaving(true);
    try {
      await authService.createUser(form);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (u) => {
    setError("");
    try {
      // Deactivated or locked -> activate/unlock. Otherwise deactivate.
      await authService.setUserActive(u.id, !u.is_active || u.locked);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-base font-bold text-white">User management</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showForm ? "Close form" : "Add user"}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg p-3"
        >
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={create}
          noValidate
          className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
        >
          <div>
            <label htmlFor="u-name" className="block text-slate-400 mb-1">
              Full name
            </label>
            <input
              id="u-name"
              value={form.name}
              onChange={set("name")}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="u-email" className="block text-slate-400 mb-1">
              Email
            </label>
            <input
              id="u-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="u-role" className="block text-slate-400 mb-1">
              Role
            </label>
            <select
              id="u-role"
              value={form.role}
              onChange={set("role")}
              className={inputCls}
            >
              <option value="client">Client</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label htmlFor="u-pw" className="block text-slate-400 mb-1">
              Temporary password
            </label>
            <div className="flex space-x-2">
              <input
                id="u-pw"
                value={form.password}
                onChange={set("password")}
                className={`${inputCls} font-mono`}
              />
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, password: generatePassword() }))
                }
                className="px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-wrap justify-between items-end gap-4">
            <PasswordChecklist password={form.password} />
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-semibold"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create user</span>
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/40 rounded-xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4">Last login</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Loading users...
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const status = !u.is_active
                  ? "Deactivated"
                  : u.locked
                    ? "Locked"
                    : "Active";
                const color =
                  status === "Active"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : status === "Locked"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-rose-500/20 text-rose-400";
                const action =
                  status === "Deactivated"
                    ? "Activate"
                    : status === "Locked"
                      ? "Unlock"
                      : "Deactivate";
                return (
                  <tr key={u.id}>
                    <td className="p-4 font-semibold text-white">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4 capitalize">{u.role}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${color}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="p-4 text-right">
                      {u.id === me.id ? (
                        <span className="text-slate-500 italic">You</span>
                      ) : (
                        <button
                          onClick={() => toggle(u)}
                          className="bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg font-medium"
                        >
                          {action}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
