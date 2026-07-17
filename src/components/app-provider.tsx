"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Profile } from "@/lib/ui-models";

interface AppContextValue {
  session: Session | null; profile: Profile | null; loading: boolean;
  cartCount: number; refreshCart: () => Promise<void>; signOut: () => Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("id, full_name, role, zone").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
  }, [supabase]);
  const refreshCart = useCallback(async () => {
    if (!session || profile?.role !== "customer") return setCartCount(0);
    const response = await fetch("/api/cart");
    if (response.ok) {
      const body = await response.json();
      setCartCount(body.data.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0));
    }
  }, [profile?.role, session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setProfile(null);
      if (next) void loadProfile(next.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile, supabase]);
  useEffect(() => { void refreshCart(); }, [refreshCart]);

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  return <AppContext.Provider value={{ session, profile, loading, cartCount, refreshCart, signOut }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
