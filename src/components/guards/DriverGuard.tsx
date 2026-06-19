import { Navigate, Outlet } from "react-router-dom";
import { getDriverSession } from "@/lib/auth/driverAuth";

export function DriverGuard() {
  const s = getDriverSession();
  if (!s) return <Navigate to="/driver/login" replace />;
  return <Outlet />;
}
