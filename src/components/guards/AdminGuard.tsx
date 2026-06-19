import { Navigate, Outlet } from "react-router-dom";
import { useAdminSession } from "@/lib/auth/adminAuth";
import { Loader2 } from "lucide-react";

export function AdminGuard() {
  const { isAdmin, loading } = useAdminSession();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
