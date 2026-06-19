import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export async function adminLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  // Confirm role
  const userId = data.user?.id;
  if (!userId) throw new Error("Login failed");
  const { data: hasAdmin, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr) throw new Error(roleErr.message);
  if (!hasAdmin) {
    await supabase.auth.signOut();
    throw new Error("This account is not an administrator.");
  }
  return data;
}

export async function adminLogout() {
  await supabase.auth.signOut();
}

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      checkAdmin(s?.user?.id);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      checkAdmin(data.session?.user?.id);
    });
    async function checkAdmin(userId: string | undefined) {
      if (!userId) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!active) return;
      setIsAdmin(Boolean(data));
      setLoading(false);
    }
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, isAdmin, loading };
}
