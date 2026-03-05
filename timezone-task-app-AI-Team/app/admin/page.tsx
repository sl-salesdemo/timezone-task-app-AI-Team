"use client";

import { useState, useEffect } from "react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/client";

export default function AdminPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Get profile to check admin role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        if (profile?.role === "admin") {
          setUserId(user.id);
          setIsAdmin(true);
        }
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
        
        if (profile?.role === "admin") {
          setUserId(session.user.id);
          setIsAdmin(true);
        } else {
          setUserId(null);
          setIsAdmin(false);
        }
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

  if (!userId || !isAdmin) {
    return (
      <LoginForm 
        role="admin" 
        onSuccess={(id, admin) => {
          if (admin) {
            setUserId(id);
            setIsAdmin(true);
          }
        }} 
      />
    );
  }

  return <AdminDashboard userId={userId} />;
}
