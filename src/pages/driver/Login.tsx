import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, ArrowLeft, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginDriver } from "@/lib/auth/driverAuth";
import { toast } from "sonner";

export default function DriverLogin() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const press = (d: string) => setPin((p) => (p.length >= 6 ? p : p + d));
  const back = () => setPin((p) => p.slice(0, -1));

  async function submit() {
    if (!employee.trim() || pin.length < 4) {
      toast.error("Enter Driver ID and a 4–6 digit PIN");
      return;
    }
    setLoading(true);
    try {
      await loginDriver(employee.trim(), pin);
      navigate("/driver", { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="mx-auto mt-6 flex w-full max-w-sm flex-col items-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Driver sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">Enter your Driver ID and PIN</p>

        <div className="w-full space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp">Driver ID</Label>
            <Input
              id="emp"
              inputMode="text"
              autoCapitalize="characters"
              placeholder="e.g. EMP001"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>PIN</Label>
            <div className="flex justify-center gap-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border ${
                    i < pin.length ? "bg-primary border-primary" : "border-muted-foreground/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid w-full grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button key={d} variant="outline" className="h-14 text-xl" onClick={() => press(d)}>
              {d}
            </Button>
          ))}
          <div />
          <Button variant="outline" className="h-14 text-xl" onClick={() => press("0")}>
            0
          </Button>
          <Button variant="outline" className="h-14" onClick={back} aria-label="Backspace">
            <Delete className="h-5 w-5" />
          </Button>
        </div>

        <Button className="mt-6 h-12 w-full text-base" onClick={submit} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </div>
  );
}
