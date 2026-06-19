import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TriangleAlert as AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadCSV } from "@/lib/csv";
import { toast } from "sonner";
import { Link } from "react-router-dom";

async function run(name: string, fn: () => Promise<Record<string, unknown>[]>) {
  try {
    const rows = await fn();
    if (!rows.length) {
      toast.message("No data to export");
      return;
    }
    downloadCSV(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  } catch (e) {
    toast.error((e as Error).message);
  }
}

const reports = [
  {
    name: "Damages",
    description: "All damage reports with vehicle, driver and status",
    run: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select(
          "reported_at, damage_type, description, status, view, vehicle:vehicles(registration_number), driver:drivers(name, surname, employee_number)",
        )
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        reported_at: d.reported_at,
        vehicle: d.vehicle?.registration_number,
        driver: `${d.driver?.name ?? ""} ${d.driver?.surname ?? ""}`.trim(),
        driver_id: d.driver?.employee_number,
        damage_type: d.damage_type,
        view: d.view,
        status: d.status,
        description: d.description,
      }));
    },
  },
  {
    name: "Vehicle history",
    description: "All sessions per vehicle with duration and odometer",
    run: async () => {
      const { data, error } = await supabase
        .from("vehicle_sessions")
        .select(
          "started_at, ended_at, status, odometer_start, odometer_end, vehicle:vehicles(registration_number), driver:drivers(name, surname, employee_number)",
        )
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s: any) => {
        const mins =
          s.started_at && s.ended_at
            ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
            : null;
        return {
          vehicle: s.vehicle?.registration_number,
          driver: `${s.driver?.name ?? ""} ${s.driver?.surname ?? ""}`.trim(),
          driver_id: s.driver?.employee_number,
          started_at: s.started_at,
          ended_at: s.ended_at,
          duration_minutes: mins,
          odometer_start: s.odometer_start,
          odometer_end: s.odometer_end,
          distance_km:
            s.odometer_start != null && s.odometer_end != null
              ? s.odometer_end - s.odometer_start
              : null,
          status: s.status,
        };
      });
    },
  },
  {
    name: "Inspections",
    description: "All inspections with pass and issue counts",
    run: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "created_at, inspection_type, items_pass_count, items_issue_count, vehicle:vehicles(registration_number), driver:drivers(name, surname, employee_number)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((i: any) => ({
        created_at: i.created_at,
        type: i.inspection_type,
        vehicle: i.vehicle?.registration_number,
        driver: `${i.driver?.name ?? ""} ${i.driver?.surname ?? ""}`.trim(),
        driver_id: i.driver?.employee_number,
        items_pass: i.items_pass_count,
        items_issue: i.items_issue_count,
        items_total: i.items_pass_count + i.items_issue_count,
      }));
    },
  },
  {
    name: "Driver activity",
    description: "Sessions and inspections per driver",
    run: async () => {
      const { data: drivers, error } = await supabase
        .from("drivers")
        .select("employee_number, name, surname, sessions:vehicle_sessions(id), inspections:inspections(id)");
      if (error) throw error;
      return (drivers || []).map((d: any) => ({
        driver_id: d.employee_number,
        name: `${d.name} ${d.surname}`,
        sessions: d.sessions?.length ?? 0,
        inspections: d.inspections?.length ?? 0,
      }));
    },
  },
  {
    name: "Vehicle summary",
    description: "Per-vehicle totals: sessions, damages, last used",
    run: async () => {
      const { data, error } = await supabase
        .from("vehicle_summary")
        .select(
          "registration_number, make, model, year, status, total_sessions, last_used_at, open_damage_count, total_damage_count, last_inspection_at, last_inspection_type, last_inspection_issues",
        )
        .order("registration_number");
      if (error) throw error;
      return (data || []).map((v: any) => ({
        registration: v.registration_number,
        make: v.make,
        model: v.model,
        year: v.year,
        status: v.status,
        total_sessions: v.total_sessions,
        last_used_at: v.last_used_at,
        open_damages: v.open_damage_count,
        total_damages: v.total_damage_count,
        last_inspection_at: v.last_inspection_at,
        last_inspection_type: v.last_inspection_type,
        last_inspection_issues: v.last_inspection_issues,
      }));
    },
  },
  {
    name: "Open damages by vehicle",
    description: "Summary of open damage count per vehicle by type",
    run: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select("damage_type, vehicle:vehicles(registration_number, make, model)")
        .eq("status", "open");
      if (error) throw error;
      const map: Record<string, Record<string, unknown>> = {};
      for (const d of data || []) {
        const reg = (d.vehicle as any)?.registration_number ?? "unknown";
        if (!map[reg]) {
          map[reg] = {
            registration: reg,
            make_model: `${(d.vehicle as any)?.make ?? ""} ${(d.vehicle as any)?.model ?? ""}`.trim(),
            total: 0,
          };
        }
        map[reg][d.damage_type] = ((map[reg][d.damage_type] as number) || 0) + 1;
        map[reg]["total"] = ((map[reg]["total"] as number) || 0) + 1;
      }
      return Object.values(map).sort((a, b) => (b.total as number) - (a.total as number));
    },
  },
];

export default function AdminReports() {
  const { data: summary } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const [topDamaged, recentIssues] = await Promise.all([
        supabase
          .from("vehicle_summary")
          .select("id, registration_number, make, model, open_damage_count")
          .gt("open_damage_count", 0)
          .order("open_damage_count", { ascending: false })
          .limit(5),
        supabase
          .from("inspections")
          .select(
            "items_issue_count, driver:drivers(id, name, surname, employee_number)",
          )
          .gt("items_issue_count", 0)
          .order("items_issue_count", { ascending: false })
          .limit(100),
      ]);

      const driverMap: Record<string, { name: string; employee_number: string; issues: number }> = {};
      for (const i of recentIssues.data || []) {
        const d = i.driver as any;
        if (!d?.id) continue;
        if (!driverMap[d.id])
          driverMap[d.id] = {
            name: `${d.name} ${d.surname}`,
            employee_number: d.employee_number,
            issues: 0,
          };
        driverMap[d.id].issues += i.items_issue_count;
      }
      const topDrivers = Object.values(driverMap)
        .sort((a, b) => b.issues - a.issues)
        .slice(0, 5);

      return { topDamaged: topDamaged.data || [], topDrivers };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Fleet data exports and summary</p>
      </div>

      {/* On-screen summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-semibold">Vehicles with most open damages</p>
          </div>
          {!summary?.topDamaged.length ? (
            <p className="text-sm text-muted-foreground">No open damages — fleet is clean</p>
          ) : (
            <div className="space-y-2">
              {(summary?.topDamaged || []).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between">
                  <Link
                    to={`/admin/vehicles/${v.id}/blueprint`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {v.registration_number}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {v.make} {v.model}
                    </span>
                  </Link>
                  <Badge variant="destructive">{v.open_damage_count} open</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold">Drivers with most inspection issues</p>
          </div>
          {!summary?.topDrivers.length ? (
            <p className="text-sm text-muted-foreground">No inspection issues recorded</p>
          ) : (
            <div className="space-y-2">
              {(summary?.topDrivers || []).map((d) => (
                <div key={d.employee_number} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.employee_number}</p>
                  </div>
                  <Badge variant="outline" className="border-amber-400 text-amber-700">
                    {d.issues} issues
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* CSV exports */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CSV Exports
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {reports.map((r) => (
            <Card key={r.name} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </div>
              <Button onClick={() => run(r.name.replace(/\s+/g, "-").toLowerCase(), r.run)}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
