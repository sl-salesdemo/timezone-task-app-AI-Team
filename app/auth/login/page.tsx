"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);

  const supabase = createClient();
  const redirectTo = searchParams.get("redirect") || "/";
  const roleParam = searchParams.get("role") as "user" | "admin" | null;
  const role = roleParam === "admin" ? "admin" : "user";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Already logged in, redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        if (profile?.role === "admin" && redirectTo === "/admin") {
          router.push("/admin");
        } else {
          router.push("/");
        }
        return;
      }
      setChecking(false);
    };

    checkAuth();
  }, [supabase, router, redirectTo]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSuccess = (userId: string, isAdmin: boolean) => {
    if (redirectTo === "/admin" && isAdmin) {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  return (
    <LoginForm 
      role={role} 
      onSuccess={handleSuccess}
    />
  );
}
