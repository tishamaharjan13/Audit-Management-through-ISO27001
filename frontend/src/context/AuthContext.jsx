import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);
const IDLE_MS = 15 * 60 * 1000; // auto sign-out after 15 minutes of inactivity

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.loadSession());
  const [notice, setNotice] = useState(""); // message shown on the login page

  const login = useCallback(async (email, password) => {
    const { token, user } = await authService.login(email, password);
    authService.saveSession(token, user);
    setNotice("");
    setSession({ token, user });
    return user;
  }, []);

  const logout = useCallback(() => {
    authService.clearSession();
    setNotice("");
    setSession(null);
  }, []);

  const expire = useCallback((message) => {
    authService.clearSession();
    setNotice(message);
    setSession(null);
  }, []);

  // Auto logout when idle, or when the backend answers 401
  useEffect(() => {
    if (!session) return undefined;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => expire("You were signed out after 15 minutes of inactivity."),
        IDLE_MS,
      );
    };
    const onExpired = () => expire("Your session expired. Sign in again.");
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    window.addEventListener("auth:expired", onExpired);
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      window.removeEventListener("auth:expired", onExpired);
    };
  }, [session, expire]);

  const value = {
    user: session?.user || null,
    token: session?.token || null,
    isAuthenticated: !!session,
    notice,
    login,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
