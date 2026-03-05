"use client";

import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";

interface LoginFormProps {
  role: "user" | "admin";
  onSuccess: () => void;
}

const CREDENTIALS = {
  user: { id: "user", password: "user", label: "作業者" },
  admin: { id: "admin", password: "admin", label: "管理者" },
};

export function LoginForm({ role, onSuccess }: LoginFormProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const cred = CREDENTIALS[role];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (loginId === cred.id && password === cred.password) {
      // セッションをsessionStorageに保存（タブを閉じるとクリア）
      sessionStorage.setItem(`auth-${role}`, "true");
      onSuccess();
    } else {
      setError("ログインIDまたはパスワードが正しくありません");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-lg p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <LogIn className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">BPO 業務進捗チェック</h1>
            <p className="text-sm text-muted-foreground mt-1">{cred.label}ログイン</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="loginId" className="block text-sm font-medium text-foreground mb-1.5">
                ログインID
              </label>
              <input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="IDを入力"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="パスワードを入力"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
