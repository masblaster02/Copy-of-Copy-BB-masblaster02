import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { supabase } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/storage";
import {
  User,
  Car,
  Clock,
  Gauge,
  CalendarDays,
  ClipboardCheck,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2,
  ExternalLink,
  Hash,
} from "lucide-react";

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "In progress";
  const mins = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AdminSessionReport() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session-report-header", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_sessions")
        .select(
          "id, started_at, ended_at, status, odometer_start, odometer_end, driver:drivers(id, name, surname, employee_number), vehicle:vehicles(id, registration_number, make, model, year)",
        )
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ["session-report-inspections", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, inspection_type, created_at, items_pass_count, items_issue_count",
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: damages } = useQuery({
    queryKey: ["session-report-damages", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select(
          "id, damage_type, view, description, status, approved, reported_during, photos:damage_marker_photos(photo_url)",
        )
        .eq("session_id", sessionId)
        .order("reported_during", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const preTrip = inspections?.find((i: any) => i.inspection_type === "pre_trip");
  const returnInsp = inspections?.find((i: any) => i.inspection_type === "return");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <p className="text-muted-foreground">Session not found.</p>;
  }

  const driver = session.driver as any;
  const vehicle = session.vehicle as any;
  const distance =
    session.odometer_start != null && session.odometer_end != null
      ? (session.odometer_end - session.odometer_start).toFixed(0)
      : null;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Sessions", href: "/admin/sessions" },
          { label: `Session — ${fmtDate(session.started_at)}` },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Session Report</h1>
            <Badge variant={session.status === "active" ? "default" : "secondary"} className="capitalize">
              {session.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {fmtDateTime(session.started_at)}
            {session.ended_at ? ` — ${fmtDateTime(session.ended_at)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {vehicle?.id && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/vehicles/${vehicle.id}`}>
                <Car className="mr-2 h-4 w-4" /> Vehicle
              </Link>
            </Button>
          )}
          {driver?.id && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/drivers/${driver.id}`}>
                <User className="mr-2 h-4 w-4" /> Driver
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<User className="h-5 w-5 text-primary" />}
          label="Driver"
          value={`${driver?.name ?? ""} ${driver?.surname ?? ""}`.trim() || "—"}
          sub={driver?.employee_number ?? ""}
        />
        <SummaryCard
          icon={<Car className="h-5 w-5 text-blue-600" />}
          label="Vehicle"
          value={vehicle?.registration_number ?? "—"}
          sub={vehicle ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` · ${vehicle.year}` : ""}` : ""}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-green-600" />}
          label="Duration"
          value={fmtDuration(session.started_at, session.ended_at)}
          sub={session.ended_at ? `Returned ${fmtDate(session.ended_at)}` : "Session still active"}
        />
        <SummaryCard
          icon={<Gauge className="h-5 w-5 text-orange-500" />}
          label="Distance"
          value={distance != null ? `${distance} km` : "—"}
          sub={
            session.odometer_start != null
              ? `${session.odometer_start} → ${session.odometer_end ?? "…"}`
              : "No odometer data"
          }
        />
      </div>

      {/* Inspections side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <InspectionSection
          label="Pre-trip inspection"
          inspection={preTrip}
          emptyMessage="No pre-trip inspection recorded for this session."
        />
        <InspectionSection
          label="Return inspection"
          inspection={returnInsp}
          emptyMessage={
            session.status === "active"
              ? "Session is still active — return inspection not yet completed."
              : "No return inspection recorded for this session."
          }
        />
      </div>

      {/* Damage sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DamageSection
          label="Damage reported on pre-trip"
          damages={(damages || []).filter((d) => d.reported_during === "pre_trip")}
          emptyMessage="No damage was reported during the pre-trip inspection."
        />
        <DamageSection
          label="Damage reported on return"
          damages={(damages || []).filter((d) => d.reported_during === "return")}
          emptyMessage={
            session.status === "active"
              ? "Return not yet completed — damage will appear here once the driver finishes their return inspection."
              : "No damage was reported during this session's return."
          }
        />
      </div>
    </div>
  );
}

/* ── Summary card ── */
function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-semibold">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}

/* ── Inspection section ── */
function InspectionSection({
  label,
  inspection,
  emptyMessage,
}: {
  label: string;
  inspection: any;
  emptyMessage: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{label}</p>
        </div>
        {inspection && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {inspection.items_issue_count > 0 ? (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {inspection.items_issue_count} issue{inspection.items_issue_count !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> All pass
              </span>
            )}
          </div>
        )}
      </div>
      {!inspection ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <InspectionItemList inspectionId={inspection.id} />
      )}
    </Card>
  );
}

/* ── Inspection items ── */
function InspectionItemList({ inspectionId }: { inspectionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["session-inspection-items", inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_items")
        .select("id, item_name, result, notes, photos:inspection_item_photos(photo_url)")
        .eq("inspection_id", inspectionId);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  const items = data || [];
  if (!items.length) {
    return <p className="px-4 py-4 text-sm text-muted-foreground">No checklist items recorded.</p>;
  }

  return (
    <div className="divide-y">
      {items.map((it: any) => (
        <div key={it.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{it.item_name}</p>
            <Badge
              variant={it.result === "pass" ? "default" : "destructive"}
              className="shrink-0 capitalize text-xs"
            >
              {it.result}
            </Badge>
          </div>
          {it.notes && (
            <p className="mt-1 text-xs text-muted-foreground">{it.notes}</p>
          )}
          {it.photos?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {it.photos.map((p: any, idx: number) => (
                <SignedImg key={idx} bucket="inspection-photos" path={p.photo_url} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Damage section ── */
function DamageSection({
  label,
  damages,
  emptyMessage,
}: {
  label: string;
  damages: any[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{label}</p>
        </div>
        {damages.length > 0 && (
          <span className="text-xs text-destructive font-medium">
            {damages.length} item{damages.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {damages.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="divide-y">
          {damages.map((d: any) => (
            <DamageRow key={d.id} damage={d} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Single damage row ── */
function DamageRow({ damage }: { damage: any }) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize text-xs">
          {damage.damage_type.replace("_", " ")}
        </Badge>
        <span className="text-xs capitalize text-muted-foreground">{damage.view}</span>
        {damage.approved ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            Approved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Pending review
          </span>
        )}
        <Badge variant="outline" className="capitalize text-xs">
          {damage.status}
        </Badge>
      </div>
      {damage.description && (
        <p className="mt-1 text-xs text-muted-foreground">{damage.description}</p>
      )}
      {damage.photos?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {damage.photos.map((p: any, idx: number) => (
            <DamagePhotoImg key={idx} path={p.photo_url} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Photo helpers ── */
function SignedImg({ bucket, path }: { bucket: string; path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    getSignedUrl(bucket, path).then(setUrl).catch(() => setUrl(""));
  }, [bucket, path]);
  if (!url) return <div className="h-20 w-20 animate-pulse rounded border bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} className="h-20 w-20 rounded border object-cover" alt="" />
    </a>
  );
}

function DamagePhotoImg({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    getSignedUrl("damage-photos", path).then(setUrl).catch(() => setUrl(""));
  }, [path]);
  if (!url) return <div className="h-20 w-20 animate-pulse rounded border bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} className="h-20 w-20 rounded border object-cover" alt="" />
    </a>
  );
}
