// Authentication service.
// USE_MOCK = true  -> everything works in the browser (no backend needed).
// USE_MOCK = false -> the same functions call your Express API.
// Mock passwords are stored in plain text ONLY for frontend testing.
// The real backend must hash passwords with bcrypt.

import { validatePassword } from "../utils/password";

const USE_MOCK = true;
const API_URL = "http://localhost:5000/api";

const TOKEN_KEY = "audit_token";
const USER_KEY = "audit_user";
const USERS_KEY = "audit_mock_users";
const RESETS_KEY = "audit_mock_resets";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000; // lock account for 5 minutes
const RESET_MS = 10 * 60 * 1000; // reset code valid for 10 minutes

const SEED_USERS = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@audit.com",
    password: "Admin@123",
    role: "admin",
    is_active: true,
    failed_logins: 0,
    locked_until: 0,
    last_login: null,
  },
  {
    id: 2,
    name: "Jasana Kayastha",
    email: "auditor@audit.com",
    password: "Auditor@123",
    role: "auditor",
    is_active: true,
    failed_logins: 0,
    locked_until: 0,
    last_login: null,
  },
  {
    id: 3,
    name: "Client Representative",
    email: "client@audit.com",
    password: "Client@123",
    role: "client",
    is_active: true,
    failed_logins: 0,
    locked_until: 0,
    last_login: null,
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
function getUsers() {
  const stored = read(USERS_KEY, null);
  if (stored) return stored;
  const fresh = SEED_USERS.map((u) => ({ ...u }));
  write(USERS_KEY, fresh);
  return fresh;
}
const publicUser = ({ password, failed_logins, locked_until, ...rest }) => rest;
const sameEmail = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------- session helpers ----------
export function saveSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}
export function loadSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY));
    return token && user ? { token, user } : null;
  } catch {
    return null;
  }
}
export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

// ---------- real backend helper ----------
// Use this in every future API call: it adds the token and signs the user out on 401.
export async function request(
  path,
  { method = "GET", body, auth = true } = {},
) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth)
    window.dispatchEvent(new Event("auth:expired"));
  if (!res.ok) throw new Error(data.message || "Request failed.");
  return data;
}

// ---------- public auth ----------
export async function login(email, password) {
  if (!USE_MOCK)
    return request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });

  await wait(400);
  const users = getUsers();
  const u = users.find((x) => sameEmail(x.email, email));
  const generic = "Incorrect email or password.";
  if (!u) throw new Error(generic);
  if (!u.is_active)
    throw new Error("This account is deactivated. Contact an administrator.");
  if (u.locked_until > Date.now()) {
    const mins = Math.ceil((u.locked_until - Date.now()) / 60000);
    throw new Error(
      `Too many failed attempts. Try again in ${mins} minute(s).`,
    );
  }
  if (u.password !== password) {
    u.failed_logins = (u.failed_logins || 0) + 1;
    if (u.failed_logins >= MAX_ATTEMPTS) {
      u.locked_until = Date.now() + LOCK_MS;
      u.failed_logins = 0;
    }
    write(USERS_KEY, users);
    throw new Error(generic);
  }
  u.failed_logins = 0;
  u.locked_until = 0;
  u.last_login = new Date().toISOString();
  write(USERS_KEY, users);
  return { token: `mock-token-${u.id}-${Date.now()}`, user: publicUser(u) };
}

export async function forgotPassword(email) {
  if (!USE_MOCK)
    return request("/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });

  await wait(400);
  const message = "If this email is registered, a reset code has been sent.";
  const u = getUsers().find((x) => sameEmail(x.email, email));
  if (!u || !u.is_active) return { message };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const resets = read(RESETS_KEY, {});
  resets[u.email.toLowerCase()] = { code, expires: Date.now() + RESET_MS };
  write(RESETS_KEY, resets);
  return { message, devCode: code }; // devCode exists in mock mode only (no email is sent)
}

export async function resetPassword(email, code, newPassword) {
  if (!USE_MOCK)
    return request("/auth/reset-password", {
      method: "POST",
      body: { email, code, newPassword },
      auth: false,
    });

  await wait(400);
  const resets = read(RESETS_KEY, {});
  const r = resets[email.trim().toLowerCase()];
  if (!r || r.code !== code.trim() || r.expires < Date.now())
    throw new Error("Invalid or expired code.");
  if (validatePassword(newPassword).length)
    throw new Error("Password does not meet the requirements.");
  const users = getUsers();
  const u = users.find((x) => sameEmail(x.email, email));
  if (!u) throw new Error("Invalid or expired code.");
  u.password = newPassword;
  u.failed_logins = 0;
  u.locked_until = 0;
  write(USERS_KEY, users);
  delete resets[email.trim().toLowerCase()];
  write(RESETS_KEY, resets);
  return { message: "Password updated. You can sign in now." };
}

// ---------- logged-in user ----------
export async function changePassword(currentPassword, newPassword) {
  if (!USE_MOCK)
    return request("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });

  await wait(400);
  const session = loadSession();
  const users = getUsers();
  const u = users.find((x) => x.id === session?.user?.id);
  if (!u) throw new Error("Session not found. Sign in again.");
  if (u.password !== currentPassword)
    throw new Error("Current password is incorrect.");
  if (validatePassword(newPassword).length)
    throw new Error("Password does not meet the requirements.");
  if (newPassword === currentPassword)
    throw new Error("New password must be different.");
  u.password = newPassword;
  write(USERS_KEY, users);
  return { message: "Password changed." };
}

// ---------- admin: user management ----------
export async function listUsers() {
  if (!USE_MOCK) return request("/users"); // must return [{id,name,email,role,is_active,locked,last_login}]
  await wait(200);
  return getUsers().map((u) => ({
    ...publicUser(u),
    locked: u.locked_until > Date.now(),
  }));
}

export async function createUser({ name, email, role, password }) {
  if (!USE_MOCK)
    return request("/users", {
      method: "POST",
      body: { name, email, role, password },
    });

  await wait(300);
  const users = getUsers();
  if (!name.trim() || !email.trim())
    throw new Error("Name and email are required.");
  if (users.some((x) => sameEmail(x.email, email)))
    throw new Error("A user with this email already exists.");
  if (validatePassword(password).length)
    throw new Error("Temporary password does not meet the requirements.");
  const id = Math.max(0, ...users.map((x) => x.id)) + 1;
  users.push({
    id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role,
    is_active: true,
    failed_logins: 0,
    locked_until: 0,
    last_login: null,
  });
  write(USERS_KEY, users);
  return { id };
}

// active = true also unlocks the account
export async function setUserActive(id, active) {
  if (!USE_MOCK)
    return request(`/users/${id}/active`, {
      method: "PATCH",
      body: { active },
    });

  await wait(200);
  const users = getUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error("User not found.");
  u.is_active = active;
  if (active) {
    u.failed_logins = 0;
    u.locked_until = 0;
  }
  write(USERS_KEY, users);
  return { id };
}
