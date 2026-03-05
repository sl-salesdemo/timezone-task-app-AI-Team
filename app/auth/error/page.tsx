"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  "access_denied": "アクセスが拒否されました",
  "invalid_credentials": "メールアドレスまたはパスワードが正しくありません",
  "session_expired": "セッションが期限切れです。再度ログインしてください",
  "unauthorized": "このページにアクセスする権限がありません",
  "unknown": "認証エラーが発生しました",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "unknown";
  const errorMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES["unknown"];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-destructive/50 rounded-lg p-6">
          {/* Error Icon */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">認証エラー</h1>
            <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/auth/login"
              className="block w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors text-center"
            >
              ログインページへ戻る
            </Link>
            <Link
              href="/"
              className="block w-full py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted/80 transition-colors text-center"
            >
              トップページへ
            </Link>
          </div>

          {/* Error code for debugging */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            エラーコード: {errorCode}
          </p>
        </div>
      </div>
    </div>
  );
}
