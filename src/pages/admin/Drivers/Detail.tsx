import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Clock,
  TriangleAlert as AlertTriangle,
  ClipboardCheck,
  CircleCheck as CheckCircle2,
  Car,
  Phone,
  IdCard,
  Pencil,
  CalendarClock,
} from "lucide-react";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "Active";
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function isExpiringSoon(dateStr: string | null | undefined, days = 60): boolean {
  if (!dateStr) return false;
  const exp = new Date(dateStr).getTime();
  const now = Date.now();
  return exp > now && exp - now <= days * 24 * 60 * 60 * 1000;
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

export default function AdminDriverDetail() {
  const { driverId } = useParams<{ driverId: string }>();
  const queryClient = useQueryClient();
  const [licenceDialogOpen, setLicenceDialogOpen] = useState(false);

  const { data: driver, isLoading } = useQuery({
    queryKey: ["driver", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select(
          "id, name, surname, employee_number, mobile, active, licence_number, licence_type, licence_category, cpc_valid, cpc_expiry_date",
        )
        .eq("id", driverId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["driver-sessions", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_sessions")
        .select(
          "id, started_at, ended_at, status, odometer_start, odometer_end, vehicle:vehicles(id, registration_number, make, model)",
        )
        .eq("driver_id", driverId)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ["driver-inspections", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, created_at, inspection_type, items_pass_count, items_issue_count, vehicle:vehicles(registration_number)",
        )
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: damages } = useQuery({
    queryKey: ["driver-damages", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select(
          "id, reported_at, damage_type, description, status, view, vehicle:vehicles(id, registration_number)",
        )
        .eq("driver_id", driverId)
        .order("reported_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!driver) {
    return <p className="text-muted-foreground">Driver not found.</p>;
  }

  const totalSessions = sessions?.length ?? 0;
  const activeSessions = sessions?.filter((s: any) => s.status === "active").length ?? 0;
  const totalInspections = inspections?.length ?? 0;
  const totalDamages = damages?.length ?? 0;
  const lastSession = sessions?.[0];
  const cpcExpired = isExpired(driver.cpc_expiry_date);
  const cpcWarningSoon = isExpiringSoon(driver.cpc_expiry_date);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Drivers", href: "/admin/drivers" },
          { label: `${driver.name} ${driver.surname}` },
        ]}
      />

      {/* Driver header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {driver.name} {driver.surname}
            </h1>
            {driver.active ? (
              activeSessions > 0 ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  Active
                </span>
              ) : (
                <Badge variant="secondary">Enabled</Badge>
              )
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Employee #{driver.employee_number}</p>
          {driver.mobile && (
            <a
              href={`tel:${driver.mobile}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
              {driver.mobile}
            </a>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Clock className="h-5 w-5 text-primary" />}
          label="Total Sessions"
          value={String(totalSessions)}
          sub={lastSession ? `Last: ${fmtDate(lastSession.started_at)}` : "No sessions yet"}
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5 text-green-600" />}
          label="Inspections"
          value={String(totalInspections)}
          sub="Pre-trip &amp; return"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          label="Damages Reported"
          value={String(totalDamages)}
          sub="All time"
          highlight={totalDamages > 0}
        />
      </div>

      {/* Driving Licence */}
      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <IdCard className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Driving Licence</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLicenceDialogOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Number</p>
            <p className="mt-1 text-sm font-medium">
              {driver.licence_number || <span className="text-muted-foreground">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
            <div className="mt-1">
              {driver.licence_type ? (
                <Badge variant="outline" className="capitalize text-xs">
                  {driver.licence_type}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
            <p className="mt-1 text-sm font-medium">
              {driver.licence_category || <span className="text-muted-foreground">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valid CPC</p>
            <div className="mt-1 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                {driver.cpc_valid ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">No</span>
                )}
              </div>
              {driver.cpc_expiry_date && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    cpcExpired
                      ? "font-medium text-destructive"
                      : cpcWarningSoon
                        ? "font-medium text-amber-600"
                        : "text-muted-foreground"
                  }`}
                >
                  <CalendarClock className="h-3 w-3" />
                  {cpcExpired ? "Expired " : ""}
                  {fmtDate(driver.cpc_expiry_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Sessions + Inspections side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sessions */}
        <Card>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">Sessions</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/sessions">View all</Link>
            </Button>
          </div>
          {!sessions?.length ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No sessions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Odometer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions as any[]).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      <Link
                        to={`/admin/vehicles/${s.vehicle?.id ?? ""}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {s.vehicle?.registration_number ?? "—"}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {s.vehicle?.make} {s.vehicle?.model}
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

        {/* Inspections */}
        <Card>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">Inspections</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/inspections">View all</Link>
            </Button>
          </div>
          {!inspections?.length ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No inspections yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inspections as any[]).map((i) => {
                  const hasIssues = i.items_issue_count > 0;
                  const total = i.items_pass_count + i.items_issue_count;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">{fmtDate(i.created_at)}</TableCell>
                      <TableCell className="text-sm">
                        {i.vehicle?.registration_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {i.inspection_type.replace("_", " ")}
                        </Badge>
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

      {/* Damages reported by this driver */}
      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Damages Reported</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/damages">
              <Car className="mr-1 h-3.5 w-3.5" /> View all damages
            </Link>
          </Button>
        </div>
        {!damages?.length ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No damages reported by this driver
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(damages as any[]).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm font-medium">
                    <Link
                      to={`/admin/vehicles/${d.vehicle?.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {d.vehicle?.registration_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(d.reported_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {d.damage_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {d.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={d.status === "open" ? "destructive" : "secondary"}
                      className="capitalize text-xs"
                    >
                      {d.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <EditLicenceDialog
        open={licenceDialogOpen}
        onOpenChange={setLicenceDialogOpen}
        driver={driver}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["driver", driverId] })}
      />
    </div>
  );
}

function EditLicenceDialog({
  open,
  onOpenChange,
  driver,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    licence_number: driver.licence_number ?? "",
    licence_type: driver.licence_type ?? "",
    licence_category: driver.licence_category ?? "",
    cpc_valid: driver.cpc_valid ?? false,
    cpc_expiry_date: driver.cpc_expiry_date ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm({
        licence_number: driver.licence_number ?? "",
        licence_type: driver.licence_type ?? "",
        licence_category: driver.licence_category ?? "",
        cpc_valid: driver.cpc_valid ?? false,
        cpc_expiry_date: driver.cpc_expiry_date ?? "",
      });
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("drivers")
      .update({
        licence_number: form.licence_number || null,
        licence_type: form.licence_type || null,
        licence_category: form.licence_category || null,
        cpc_valid: form.cpc_valid,
        cpc_expiry_date: form.cpc_expiry_date || null,
      })
      .eq("id", driver.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save licence details");
      return;
    }
    toast.success("Licence details saved");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Driving Licence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Licence Number</Label>
            <Input
              value={form.licence_number}
              onChange={(e) => setForm((f) => ({ ...f, licence_number: e.target.value }))}
              placeholder="e.g. DL-123456"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.licence_type}
              onValueChange={(v) => setForm((f) => ({ ...f, licence_type: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="international">International</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input
              value={form.licence_category}
              onChange={(e) => setForm((f) => ({ ...f, licence_category: e.target.value }))}
              placeholder="e.g. B, C, CE"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">CPC Valid</p>
              <p className="text-xs text-muted-foreground">Certificate of Professional Competence</p>
            </div>
            <Switch
              checked={form.cpc_valid}
              onCheckedChange={(v) => setForm((f) => ({ ...f, cpc_valid: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>CPC Expiry Date</Label>
            <Input
              type="date"
              value={form.cpc_expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, cpc_expiry_date: e.target.value }))}
            />
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
