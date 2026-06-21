import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { DriverShell } from "@/components/layout/DriverShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { clearDriverSession } from "@/lib/auth/driverAuth";
import { Loader as Loader2, LogOut } from "lucide-react";

export default function DriverStartSelect() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["available-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, make, model, year")
        .eq("status", "available")
        .eq("archived", false)
        .order("registration_number");
      if (error) throw error;
      return data;
    },
  });

  function logout() {
    clearDriverSession();
    navigate("/", { replace: true });
  }

  return (
    <DriverShell
      title="Choose vehicle"
      back="/driver"
      steps={{ steps: ["Select", "Inspect", "Pre-trip"], current: 1 }}
      action={
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <p className="text-center text-sm text-muted-foreground">No vehicles available.</p>
      ) : (
        <div className="space-y-2">
          {data.map((v) => (
            <Link key={v.id} to={`/driver/start/${v.id}/blueprint`}>
              <Card className="p-4 transition-colors hover:bg-accent">
                <p className="font-semibold">{v.registration_number}</p>
                <p className="text-sm text-muted-foreground">
                  {v.make} {v.model} {v.year ? `· ${v.year}` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DriverShell>
  );
}
