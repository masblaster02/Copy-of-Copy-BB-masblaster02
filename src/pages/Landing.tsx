import { Link } from "react-router-dom";
import { Shield, Car, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted px-6">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Fleet Guardian</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Vehicle inspections, damage tracking and fleet oversight.
        </p>
      </div>
      <div className="grid w-full max-w-md gap-3">
        <Button asChild size="lg" className="h-16 justify-start gap-4 text-base">
          <Link to="/driver/login">
            <Car className="h-5 w-5" />
            <span>
              <span className="block font-semibold">I'm a Driver</span>
              <span className="block text-xs opacity-80">Start or return a vehicle</span>
            </span>
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-16 justify-start gap-4 text-base">
          <Link to="/admin/login">
            <UserCog className="h-5 w-5" />
            <span>
              <span className="block font-semibold">I'm an Administrator</span>
              <span className="block text-xs text-muted-foreground">Manage fleet & view reports</span>
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
