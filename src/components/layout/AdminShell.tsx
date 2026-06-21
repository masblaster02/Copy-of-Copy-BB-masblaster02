import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardCheck,
  TriangleAlert as AlertTriangle,
  Clock,
  ChartBar as FileBarChart,
  LogOut,
  Shield,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import { adminLogout } from "@/lib/auth/adminAuth";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/drivers", label: "Drivers", icon: Users },
  { to: "/admin/vehicles", label: "Vehicles", icon: Car },
  { to: "/admin/checklists", label: "Checklists", icon: ClipboardList },
  { to: "/admin/sessions", label: "Sessions", icon: Clock },
  { to: "/admin/inspections", label: "Inspections", icon: ClipboardCheck },
  { to: "/admin/damages", label: "Damages", icon: AlertTriangle },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
];

// Bottom bar shows 4 primary items; rest accessible via the sidebar drawer
const bottomNav = nav.slice(0, 4);

export function AdminShell() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function logout() {
    await adminLogout();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Fleet Guardian</span>
        </div>
        <div className="border-b p-3">
          <GlobalSearch />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Mobile overlay drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute left-0 top-0 flex h-full w-72 flex-col bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">Fleet Guardian</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              <div className="mb-3">
                <GlobalSearch onNavigate={() => setDrawerOpen(false)} />
              </div>
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Fleet Guardian</span>
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto max-w-7xl p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center border-t bg-card md:hidden">
        {bottomNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <n.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground"
          aria-label="More"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>
    </div>
  );
}
