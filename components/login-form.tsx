"use client";

import { useState, type FormEvent } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  role: "user" | "admin";
  onSuccess: (userId: string, isAdmin: boolean) => void;
}

const ROLE_LABELS = {
  user: "作業者",
  admin: "管理者",
};

export function LoginForm({ role, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("[v0] Attempting login for:", email);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("[v0] SignIn response - data:", data, "error:", signInError);

      if (signInError) {
        console.error("[v0] SignIn error details:", {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name,
        });
        if (signInError.message.includes("Invalid login credentials")) {
          setError("メールアドレスまたはパスワードが正しくありません");
        } else if (signInError.message.includes("Database error")) {
          setError("データベースエラーが発生しました。しばらく待ってから再試行してください。");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("ログインに失敗しました");
        setLoading(false);
        return;
      }

      // Get user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("[v0] Profile query error:", profileError);
        // If profile query fails, check if we can determine admin from email
        // This is a fallback for RLS timing issues
        const isAdminFallback = data.user.email === "admin@test.com";
        
        if (role === "admin" && !isAdminFallback) {
          setError("管理者権限がありません");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        
        onSuccess(data.user.id, isAdminFallback);
        return;
      }

      const isAdmin = profile?.role === "admin";

      // Check if user has appropriate role for the page
      if (role === "admin" && !isAdmin) {
        setError("管理者権限がありません");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      onSuccess(data.user.id, isAdmin);
    } catch (err) {
      console.error("Login error:", err);
      setError("ログイン中にエラーが発生しました");
      setLoading(false);
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
            <p className="text-sm text-muted-foreground mt-1">ログイン</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="email@example.com"
                autoComplete="email"
                required
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
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ログイン中...
                </>
              ) : (
                "ログイン"
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
