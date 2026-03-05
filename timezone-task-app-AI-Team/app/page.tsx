"use client";

import { useState, useEffect } from "react";
import { TaskChecker } from "@/components/task-checker";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const auth = sessionStorage.getItem("auth-user");
    if (auth === "true") {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm role="user" onSuccess={() => setAuthenticated(true)} />;
  }

  return <TaskChecker />;
}
