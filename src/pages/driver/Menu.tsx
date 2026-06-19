import { useNavigate } from "react-router-dom";
import { LogOut, Loader as Loader2, CirclePlay as PlayCircle, RotateCcw } from "lucide-react";
import { DriverShell } from "@/components/layout/DriverShell";
import { Button } from "@/components/ui/button";
import { getDriverSession, clearDriverSession } from "@/lib/auth/driverAuth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export default function DriverMenu() {
  const session = getDriverSession()!;
  const navigate = useNavigate();

  const { data: active, isLoading } = useQuery({
    queryKey: ["driver-active-session", session.driver_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_sessions")
        .select("id")
        .eq("driver_id", session.driver_id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  function logout() {
    clearDriverSession();
    navigate("/", { replace: true });
  }

  return (
    <DriverShell
      title={`Hi, ${session.name}`}
      action={
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      }
    >
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        {isLoading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your session…</p>
          </>
        ) : active ? (
          <Button
            className="h-16 w-full max-w-xs text-base gap-3"
            onClick={() => navigate("/driver/return")}
          >
            <RotateCcw className="h-5 w-5" />
            Return Vehicle
          </Button>
        ) : (
          <Button
            className="h-16 w-full max-w-xs text-base gap-3"
            onClick={() => navigate("/driver/start")}
          >
            <PlayCircle className="h-5 w-5" />
            Start Vehicle
          </Button>
        )}
      </div>
    </DriverShell>
  );
}
