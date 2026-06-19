import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Car, Users, TriangleAlert, ClipboardCheck, Clock, ShieldCheck, RefreshCw, ChartBar as FileBarChart } from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Area,
  BarChart,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

async function fetchStats() {
  const [vehicles, vehiclesActive, drivers, damages, damagesOpen, sessions, sessionsActive, inspections] =
    await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "assigned"),
      supabase.from("vehicle_sessions").select("driver_id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("damage_markers").select("id", { count: "exact", head: true }),
      supabase.from("damage_markers").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("vehicle_sessions").select("id", { count: "exact", head: true }),
      supabase.from("vehicle_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("inspections").select("id", { count: "exact", head: true }),
    ]);
  return {
    vehicles: vehicles.count ?? 0,
    vehiclesActive: vehiclesActive.count ?? 0,
    drivers: drivers.count ?? 0,
    damages: damages.count ?? 0,
    damagesOpen: damagesOpen.count ?? 0,
    sessions: sessions.count ?? 0,
    sessionsActive: sessionsActive.count ?? 0,
    inspections: inspections.count ?? 0,
  };
}

type Stats = Awaited<ReturnType<typeof fetchStats>>;

async function fetchTrends() {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const [{ data: insps }, { data: dmgs }] = await Promise.all([
    supabase.from("inspections").select("created_at").gte("created_at", since.toISOString()),
    supabase.from("damage_markers").select("reported_at").gte("reported_at", since.toISOString()),
  ]);
  const map: Record<string, { date: string; inspections: number; damages: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map[key] = { date: key.slice(5), inspections: 0, damages: 0 };
  }
  for (const r of insps || []) {
    const d = (r.created_at || "").slice(0, 10);
    if (d in map) map[d].inspections++;
  }
  for (const r of dmgs || []) {
    const d = (r.reported_at || "").slice(0, 10);
    if (d in map) map[d].damages++;
  }
  return Object.values(map);
}

async function fetchActivity() {
  const { data, error } = await supabase
    .from("vehicle_sessions")
    .select("id, status, started_at, ended_at, drivers(name, surname), vehicles(registration_number)")
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []) as any[];
}

async function fetchUtil() {
  const { data } = await supabase
    .from("vehicle_summary")
    .select("registration_number, total_sessions")
    .eq("archived", false)
    .gt("total_sessions", 0)
    .order("total_sessions", { ascending: false })
    .limit(8);
  return (data || []).map((v: any) => ({
    registration: v.registration_number,
    sessions: v.total_sessions,
  }));
}

type StatConfig = {
  key: keyof Stats;
  label: string;
  sub: (s: Stats) => string;
  icon: typeof Car;
  href: string;
  accent: string;
  iconBg: string;
};

const STAT_CARDS: StatConfig[] = [
  {
    key: "vehicles",
    label: "Total Vehicles",
    sub: (s) => `${s.vehiclesActive} currently assigned`,
    icon: Car,
    href: "/admin/vehicles",
    accent: "border-l-blue-500",
    iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    key: "drivers",
    label: "Active Drivers",
    sub: (s) => `${s.sessionsActive} sessions open`,
    icon: Users,
    href: "/admin/drivers",
    accent: "border-l-emerald-500",
    iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  {
    key: "damagesOpen",
    label: "Open Damages",
    sub: (s) => `${s.damages} reported total`,
    icon: TriangleAlert,
    href: "/admin/damages",
    accent: "border-l-rose-500",
    iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  },
  {
    key: "sessionsActive",
    label: "Active Sessions",
    sub: (s) => `${s.sessions} all-time`,
    icon: Clock,
    href: "/admin/sessions",
    accent: "border-l-amber-500",
    iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  },
  {
    key: "inspections",
    label: "Inspections",
    sub: () => "all time",
    icon: ClipboardCheck,
    href: "/admin/inspections",
    accent: "border-l-violet-500",
    iconBg: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  },
  {
    key: "vehicles",
    label: "Fleet Health",
    sub: (s) => `${Math.max(0, s.vehicles - s.damagesOpen)} clean vehicles`,
    icon: ShieldCheck,
    href: "/admin/vehicles",
    accent: "border-l-teal-500",
    iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
  },
];

function StatCardSkeleton() {
  return (
    <Card className="p-4 border-l-4 border-l-muted">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });
  const { data: trends } = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: fetchTrends,
    refetchInterval: 60_000,
  });
  const { data: activity } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: fetchActivity,
    refetchInterval: 30_000,
  });
  const { data: util } = useQuery({
    queryKey: ["dashboard-util"],
    queryFn: fetchUtil,
    refetchInterval: 60_000,
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const trendTotals = trends
    ? {
        inspections: trends.reduce((a, r) => a + r.inspections, 0),
        damages: trends.reduce((a, r) => a + r.damages, 0),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Fleet overview at a glance
            {lastUpdated && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs opacity-70">
                <RefreshCw className="h-3 w-3" />
                {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/damages">
              <TriangleAlert className="mr-1.5 h-3.5 w-3.5" />
              Review Damages
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/reports">
              <FileBarChart className="mr-1.5 h-3.5 w-3.5" />
              Export Report
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {!stats
          ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          : STAT_CARDS.map((c) => (
              <Link key={c.label} to={c.href}>
                <Card
                  className={`p-4 border-l-4 ${c.accent} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer h-full`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
                        {c.label}
                      </p>
                      <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">{(stats as any)[c.key]}</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{c.sub(stats)}</p>
                    </div>
                    <div className={`flex-shrink-0 rounded-lg p-2 ${c.iconBg}`}>
                      <c.icon className="h-4 w-4" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Combined Activity + Damage Chart */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold">Fleet Activity — Last 30 Days</p>
              {trendTotals ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {trendTotals.inspections} inspections &middot; {trendTotals.damages} damage reports
                </p>
              ) : (
                <Skeleton className="mt-1 h-3 w-40" />
              )}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <ComposedChart data={trends || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inspGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area
                  type="monotone"
                  dataKey="inspections"
                  stroke="hsl(217 91% 60%)"
                  strokeWidth={2}
                  fill="url(#inspGrad)"
                  dot={false}
                  name="Inspections"
                />
                <Bar dataKey="damages" fill="hsl(0 80% 60%)" radius={[3, 3, 0, 0]} opacity={0.8} name="Damages" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Vehicle Utilization */}
        <Card className="p-5">
          <p className="text-sm font-semibold">Top Vehicles by Sessions</p>
          <p className="mb-4 mt-0.5 text-xs text-muted-foreground">All-time usage</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={util || []} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="registration"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="sessions" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Recent Activity</p>
            <p className="text-xs text-muted-foreground">Latest vehicle sessions</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/sessions">View all</Link>
          </Button>
        </div>
        <div className="divide-y">
          {!activity
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-2 w-2 rounded-full flex-shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            : activity.map((s: any) => {
                const isActive = s.status === "active";
                const driver = s.drivers;
                const vehicle = s.vehicles;
                const driverName = driver ? `${driver.name} ${driver.surname}` : "Unknown driver";
                const reg = vehicle?.registration_number ?? "—";
                const time = s.ended_at ?? s.started_at;
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{driverName}</p>
                      <p className="text-xs text-muted-foreground">{reg}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isActive ? "Active" : "Returned"}
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {time ? formatDistanceToNow(new Date(time), { addSuffix: true }) : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
          {activity?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
          )}
        </div>
      </Card>
    </div>
  );
}
