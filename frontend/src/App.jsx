import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuditPlatform from "./components/AuditPlatform";

function Gate() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState("login"); // login | forgot | reset
  const [resetEmail, setResetEmail] = useState("");

  // Nobody can reach the platform without signing in
  if (isAuthenticated) return <AuditPlatform />;

  const go = (next, data = {}) => {
    if (data.email !== undefined) {
      setResetEmail(data.email);
    }

    setView(next);
  };

  if (view === "forgot") return <ForgotPasswordPage onNavigate={go} />;
  if (view === "reset")
    return <ResetPasswordPage onNavigate={go} initialEmail={resetEmail} />;
  return <LoginPage onNavigate={go} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
