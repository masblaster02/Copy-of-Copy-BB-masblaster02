import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { supabase } from "@/lib/supabase";
import {
  Car,
  Clock,
  TriangleAlert as AlertTriangle,
  ClipboardCheck,
  ExternalLink,
  CircleCheck as CheckCircle2,
  Gauge,
  History,
  Circle as XCircle,
  FileText,
  Wrench,
  ShieldCheck,
  Upload,
  Download,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "—";
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isDateOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function isDateWarningSoon(dateStr: string | null | undefined, days = 30): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  return d > now && d - now <= days * 24 * 60 * 60 * 1000;
}

function ComplianceDateCell({
  label,
  dateStr,
}: {
  label: string;
  dateStr: string | null | undefined;
}) {
  const overdue = isDateOverdue(dateStr);
  const soon = isDateWarningSoon(dateStr);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 flex items-center gap-1 text-sm font-medium ${
          overdue ? "text-destructive" : soon ? "text-amber-600" : ""
        }`}
      >
        {dateStr ? (
          <>
            {(overdue || soon) && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            {fmtDate(dateStr)}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </p>
    </div>
  );
}

export default function AdminVehicleDetail() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const queryClient = useQueryClient();
  const logbookInputRef = useRef<HTMLInputElement>(null);

  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [addRepairDialogOpen, setAddRepairDialogOpen] = useState(false);
  const [uploadingLogbook, setUploadingLogbook] = useState(false);

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["vehicle-summary", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_summary")
        .select(
          "id, registration_number, make, model, year, vin, status, archived, total_sessions, last_used_at, total_drive_minutes, open_damage_count, total_damage_count, last_inspection_at, last_inspection_type, last_inspection_issues",
        )
        .eq("id", vehicleId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicleCompliance } = useQuery({
    queryKey: ["vehicle-compliance", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("road_licence_date, road_licence_due, last_service_date, service_due_date")
        .eq("id", vehicleId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: logbooks } = useQuery({
    queryKey: ["vehicle-logbooks", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_logbooks")
        .select("id, file_path, file_name, uploaded_at")
        .eq("vehicle_id", vehicleId)
        .order("uploaded_at", { ascending: false })
        .limit(2);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: repairs } = useQuery({
    queryKey: ["vehicle-repairs", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_repairs")
        .select("id, repair_date, description, cost, resolved, created_at")
        .eq("vehicle_id", vehicleId)
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["vehicle-sessions", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_sessions")
        .select(
          "id, started_at, ended_at, status, odometer_start, odometer_end, driver:drivers(name, surname, employee_number)",
        )
        .eq("vehicle_id", vehicleId)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: damages } = useQuery({
    queryKey: ["vehicle-damages", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select(
          "id, reported_at, damage_type, description, status, view, source, approved, reported_during, driver:drivers(name, surname)",
        )
        .eq("vehicle_id", vehicleId)
        .in("status", ["open", "in_review"])
        .order("reported_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: damageHistory } = useQuery({
    queryKey: ["vehicle-damage-history", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select(
          "id, reported_at, damage_type, description, status, view, source, reported_during, rejection_reason, driver_id, session_id, driver:drivers(name, surname)",
        )
        .eq("vehicle_id", vehicleId)
        .in("status", ["repaired", "closed"])
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ["vehicle-inspections", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, created_at, inspection_type, items_pass_count, items_issue_count, driver:drivers(name, surname)",
        )
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const handleLogbookUpload = async (file: File) => {
    setUploadingLogbook(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${vehicleId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("vehicle-logbooks")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("vehicle_logbooks")
        .insert({ vehicle_id: vehicleId, file_path: path, file_name: file.name });
      if (insertError) throw insertError;

      const { data: allLogbooks } = await supabase
        .from("vehicle_logbooks")
        .select("id, file_path")
        .eq("vehicle_id", vehicleId)
        .order("uploaded_at", { ascending: false });

      if (allLogbooks && allLogbooks.length > 2) {
        const toDelete = allLogbooks.slice(2);
        for (const row of toDelete) {
          await supabase.storage.from("vehicle-logbooks").remove([row.file_path]);
          await supabase.from("vehicle_logbooks").delete().eq("id", row.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["vehicle-logbooks", vehicleId] });
      toast.success("Logbook uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingLogbook(false);
    }
  };

  const handleDownloadLogbook = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("vehicle-logbooks")
      .createSignedUrl(filePath, 3600);
    if (error || !data) {
      toast.error("Could not generate download link");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  };

  const handleRepairToggle = async (repairId: string, resolved: boolean) => {
    const { error } = await supabase
      .from("vehicle_repairs")
      .update({ resolved })
      .eq("id", repairId);
    if (error) {
      toast.error("Failed to update repair");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["vehicle-repairs", vehicleId] });
  };

  const handleRepairDelete = async (repairId: string) => {
    const { error } = await supabase.from("vehicle_repairs").delete().eq("id", repairId);
    if (error) {
      toast.error("Failed to delete repair");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["vehicle-repairs", vehicleId] });
    toast.success("Repair entry deleted");
  };

  if (sumLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return <p className="text-muted-foreground">Vehicle not found.</p>;
  }

  const driveMins = Math.round(summary.total_drive_minutes ?? 0);
  const driveHours = (driveMins / 60).toFixed(1);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Vehicles", href: "/admin/vehicles" },
          { label: summary.registration_number },
        ]}
      />

      {/* Vehicle header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{summary.registration_number}</h1>
            <Badge
              variant={summary.status === "available" ? "default" : "secondary"}
              className="capitalize"
            >
              {summary.status}
            </Badge>
            {summary.archived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {summary.make} {summary.model}
            {summary.year ? ` · ${summary.year}` : ""}
            {summary.vin ? (
              <span className="ml-2 text-xs text-muted-foreground/70">VIN: {summary.vin}</span>
            ) : null}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={`/admin/vehicles/${vehicleId}/blueprint`}>
            <Car className="mr-2 h-4 w-4" /> View Blueprint &amp; Damages
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="h-5 w-5 text-primary" />}
          label="Total Sessions"
          value={String(summary.total_sessions ?? 0)}
          sub={`Last used: ${fmtDate(summary.last_used_at)}`}
        />
        <StatCard
          icon={<Gauge className="h-5 w-5 text-blue-600" />}
          label="Drive Time"
          value={`${driveHours}h`}
          sub={`${driveMins} minutes total`}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          label="Open Damages"
          value={String(summary.open_damage_count ?? 0)}
          sub={`${(damageHistory || []).filter((d: any) => d.status === "repaired").length} repaired · ${summary.total_damage_count ?? 0} total`}
          highlight={(summary.open_damage_count ?? 0) > 0}
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5 text-green-600" />}
          label="Last Inspection"
          value={fmtDate(summary.last_inspection_at)}
          sub={
            summary.last_inspection_type
              ? `${summary.last_inspection_type.replace("_", " ")} · ${summary.last_inspection_issues ?? 0} issues`
              : "No inspections"
          }
        />
      </div>

      {/* Compliance & Documents */}
      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Compliance &amp; Documents</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setComplianceDialogOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </div>

        <div className="divide-y">
          {/* Road Licence */}
          <div className="px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Road Licence Registration
            </p>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <ComplianceDateCell
                label="Registration Date"
                dateStr={vehicleCompliance?.road_licence_date}
              />
              <ComplianceDateCell
                label="Due Date"
                dateStr={vehicleCompliance?.road_licence_due}
              />
            </div>
          </div>

          {/* Service */}
          <div className="px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Service
            </p>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <ComplianceDateCell
                label="Last Service"
                dateStr={vehicleCompliance?.last_service_date}
              />
              <ComplianceDateCell
                label="Due Service"
                dateStr={vehicleCompliance?.service_due_date}
              />
            </div>
          </div>

          {/* Log Book */}
          <div className="px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Log Book
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logbookInputRef.current?.click()}
                disabled={uploadingLogbook}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {uploadingLogbook ? "Uploading…" : "Upload"}
              </Button>
            </div>
            <input
              ref={logbookInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogbookUpload(file);
                e.target.value = "";
              }}
            />
            {!logbooks?.length ? (
              <p className="text-sm text-muted-foreground">No logbooks uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {(logbooks as any[]).map((lb) => (
                  <div
                    key={lb.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{lb.file_name}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(lb.uploaded_at)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadLogbook(lb.file_path, lb.file_name)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Sessions + Inspections side by side on wide screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent sessions */}
        <Card>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">Recent Sessions</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/admin/sessions`}>View all</Link>
            </Button>
          </div>
          {!sessions?.length ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No sessions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Odometer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      {s.driver?.name} {s.driver?.surname}
                      <span className="block text-xs text-muted-foreground">
                        {s.driver?.employee_number}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        to={`/admin/sessions/${s.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {fmtDate(s.started_at)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDuration(s.started_at, s.ended_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.odometer_start != null && s.odometer_end != null
                        ? `${(s.odometer_end - s.odometer_start).toFixed(0)} km`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Recent inspections */}
        <Card>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">Recent Inspections</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/admin/inspections`}>View all</Link>
            </Button>
          </div>
          {!inspections?.length ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No inspections yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inspections || []).map((i: any) => {
                  const hasIssues = i.items_issue_count > 0;
                  const total = i.items_pass_count + i.items_issue_count;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">{fmtDate(i.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {i.inspection_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {i.driver?.name} {i.driver?.surname}
                      </TableCell>
                      <TableCell>
                        {total === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : hasIssues ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {i.items_issue_count}/{total}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            All pass
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Open / Active Damages */}
      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Active Damages</p>
            {(summary.open_damage_count ?? 0) > 0 && (
              <Badge variant="destructive" className="text-xs">
                {summary.open_damage_count} open
              </Badge>
            )}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/admin/vehicles/${vehicleId}/blueprint`}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Manage on blueprint
            </Link>
          </Button>
        </div>
        {!damages?.length ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No active damages</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>View</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(damages || []).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {d.damage_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">{d.view}</TableCell>
                  <TableCell>
                    {d.source === "baseline" ? (
                      <span className="text-xs text-muted-foreground">Baseline</span>
                    ) : d.reported_during === "pre_trip" ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Pre-trip
                      </span>
                    ) : d.reported_during === "return" ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Return
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm">{d.description || "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(d.reported_at)}</TableCell>
                  <TableCell className="text-sm">
                    {d.driver ? (
                      `${d.driver.name} ${d.driver.surname}`
                    ) : (
                      <span className="text-muted-foreground">Baseline</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DamageStatusBadge status={d.status} approved={d.approved} source={d.source} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Damage History */}
      {(damageHistory?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Damage History</p>
            <Badge variant="secondary" className="text-xs">
              {damageHistory!.length}
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>View</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(damageHistory || []).map((d: any) => (
                <TableRow key={d.id} className={d.status === "closed" ? "opacity-60" : ""}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {d.damage_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">{d.view}</TableCell>
                  <TableCell>
                    {d.source === "baseline" ? (
                      <span className="text-xs text-muted-foreground">Baseline</span>
                    ) : d.reported_during === "pre_trip" ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Pre-trip
                      </span>
                    ) : d.reported_during === "return" ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Return
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 text-sm">
                    <span className="line-clamp-2">{d.description || "—"}</span>
                    {d.status === "closed" && d.rejection_reason && (
                      <span className="mt-0.5 block text-xs italic text-muted-foreground">
                        Rejected: {d.rejection_reason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(d.reported_at)}</TableCell>
                  <TableCell className="text-sm">
                    {d.driver ? (
                      <Link
                        to={`/admin/drivers/${d.driver_id}`}
                        className="font-medium hover:underline"
                      >
                        {d.driver.name} {d.driver.surname}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Baseline</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.status === "repaired" ? (
                      d.session_id ? (
                        <Link
                          to={`/admin/sessions/${d.session_id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Repaired
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Repaired
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" /> Rejected
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Repairs & Maintenance */}
      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Repairs &amp; Maintenance</p>
            {(repairs?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="text-xs">
                {repairs!.length}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAddRepairDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {!repairs?.length ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No repair entries yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(repairs as any[]).map((r) => (
                <TableRow key={r.id} className={r.resolved ? "opacity-60" : ""}>
                  <TableCell className="text-sm">{fmtDate(r.repair_date)}</TableCell>
                  <TableCell className="max-w-xs text-sm">{r.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.cost != null ? Number(r.cost).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={r.resolved}
                      onCheckedChange={(v) => handleRepairToggle(r.id, !!v)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRepairDelete(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ComplianceEditDialog
        open={complianceDialogOpen}
        onOpenChange={setComplianceDialogOpen}
        vehicleId={vehicleId!}
        current={vehicleCompliance}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["vehicle-compliance", vehicleId] })}
      />

      <AddRepairDialog
        open={addRepairDialogOpen}
        onOpenChange={setAddRepairDialogOpen}
        vehicleId={vehicleId!}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["vehicle-repairs", vehicleId] })}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${highlight ? "text-destructive" : ""}`}>{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="rounded-lg bg-muted p-2">{icon}</div>
      </div>
    </Card>
  );
}

function DamageStatusBadge({
  status,
  approved,
  source,
}: {
  status: string;
  approved: boolean;
  source: string;
}) {
  if (source === "driver" && !approved) {
    return (
      <Badge variant="outline" className="border-amber-400 text-xs text-amber-700">
        Pending review
      </Badge>
    );
  }
  const map: Record<string, string> = {
    open: "destructive",
    in_review: "secondary",
    repaired: "default",
  };
  return (
    <Badge variant={(map[status] as any) ?? "outline"} className="capitalize text-xs">
      {status.replace("_", " ")}
    </Badge>
  );
}

function ComplianceEditDialog({
  open,
  onOpenChange,
  vehicleId,
  current,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicleId: string;
  current: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    road_licence_date: current?.road_licence_date ?? "",
    road_licence_due: current?.road_licence_due ?? "",
    last_service_date: current?.last_service_date ?? "",
    service_due_date: current?.service_due_date ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm({
        road_licence_date: current?.road_licence_date ?? "",
        road_licence_due: current?.road_licence_due ?? "",
        last_service_date: current?.last_service_date ?? "",
        service_due_date: current?.service_due_date ?? "",
      });
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("vehicles")
      .update({
        road_licence_date: form.road_licence_date || null,
        road_licence_due: form.road_licence_due || null,
        last_service_date: form.last_service_date || null,
        service_due_date: form.service_due_date || null,
      })
      .eq("id", vehicleId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save compliance details");
      return;
    }
    toast.success("Compliance details saved");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Compliance Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Road Licence Registration
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Registration Date</Label>
              <Input
                type="date"
                value={form.road_licence_date}
                onChange={(e) => setForm((f) => ({ ...f, road_licence_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.road_licence_due}
                onChange={(e) => setForm((f) => ({ ...f, road_licence_due: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Service
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Last Service</Label>
              <Input
                type="date"
                value={form.last_service_date}
                onChange={(e) => setForm((f) => ({ ...f, last_service_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Service</Label>
              <Input
                type="date"
                value={form.service_due_date}
                onChange={(e) => setForm((f) => ({ ...f, service_due_date: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRepairDialog({
  open,
  onOpenChange,
  vehicleId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicleId: string;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    repair_date: today,
    description: "",
    cost: "",
    resolved: false,
  });
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm({ repair_date: today, description: "", cost: "", resolved: false });
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (!form.description.trim() || !form.repair_date) {
      toast.error("Date and description are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("vehicle_repairs").insert({
      vehicle_id: vehicleId,
      repair_date: form.repair_date,
      description: form.description.trim(),
      cost: form.cost ? parseFloat(form.cost) : null,
      resolved: form.resolved,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to add repair entry");
      return;
    }
    toast.success("Repair entry added");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Repair / Maintenance Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.repair_date}
              onChange={(e) => setForm((f) => ({ ...f, repair_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the repair or maintenance work…"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cost (optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="resolved"
              checked={form.resolved}
              onCheckedChange={(v) => setForm((f) => ({ ...f, resolved: !!v }))}
            />
            <Label htmlFor="resolved" className="cursor-pointer font-normal">
              Mark as resolved
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
