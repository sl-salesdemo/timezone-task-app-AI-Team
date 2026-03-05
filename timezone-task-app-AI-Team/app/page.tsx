"use client";

import { useState, useEffect } from "react";
import { TaskChecker } from "@/components/task-checker";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/client";

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Get profile to check role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        setUserId(user.id);
        setIsAdmin(profile?.role === "admin");
      }
      setChecking(false);
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setIsAdmin(false);
      } else if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        
        setUserId(session.user.id);
        setIsAdmin(profile?.role === "admin");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return (
      <LoginForm 
        role="user" 
        onSuccess={(id, admin) => {
          setUserId(id);
          setIsAdmin(admin);
        }} 
      />
    );
  }

  return <TaskChecker userId={userId} isAdmin={isAdmin} />;
}
