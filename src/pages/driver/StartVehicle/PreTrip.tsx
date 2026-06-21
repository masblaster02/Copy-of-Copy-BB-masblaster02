import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DriverShell } from "@/components/layout/DriverShell";
import { InspectionChecklist, type ChecklistResult, type ChecklistItemDef } from "@/components/InspectionChecklist";
import { getDriverSession, clearDriverSession } from "@/lib/auth/driverAuth";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Car, Camera, ClipboardList, User } from "lucide-react";

export default function DriverStartPreTrip() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const driver = getDriverSession()!;
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ChecklistResult[] | null>(null);

  const reportedDamageCount = (location.state as { reportedDamageCount?: number; newMarkerIds?: string[] } | null)?.reportedDamageCount ?? 0;
  const newMarkerIds = (location.state as { newMarkerIds?: string[] } | null)?.newMarkerIds ?? [];

  const { data: vehicle } = useQuery({
    queryKey: ["pretrip-vehicle", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("registration_number, make, model")
        .eq("id", vehicleId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch vehicle-specific checklist (only enabled items)
  const { data: checklistItems, isLoading: checklistLoading } = useQuery<ChecklistItemDef[]>({
    queryKey: ["vehicle-checklist", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vehicle_enabled_checklist", { p_vehicle_id: vehicleId });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.item_id,
        item_text: d.item_text,
        item_order: d.item_order,
        is_active: true,
      }));
    },
  });

  async function confirmSubmit(items: ChecklistResult[]) {
    if (!vehicleId) return;
    setSubmitting(true);
    try {
      // Creates session, closes stale sessions, backfills marker session_ids,
      // and triggers vehicle status to 'assigned' — all via security-definer RPC.
      const { data: sessionId, error: sErr } = await supabase.rpc("start_vehicle_session", {
        p_driver_id: driver.driver_id,
        p_vehicle_id: vehicleId,
        p_marker_ids: newMarkerIds,
      });
      if (sErr) throw sErr;

      const { data: insp, error: iErr } = await supabase
        .from("inspections")
        .insert({
          session_id: sessionId,
          driver_id: driver.driver_id,
          vehicle_id: vehicleId,
          inspection_type: "pre_trip",
        })
        .select("id")
        .single();
      if (iErr) throw iErr;

      for (const it of items) {
        const { data: itemRow, error: itErr } = await supabase
          .from("inspection_items")
          .insert({
            inspection_id: insp.id,
            item_name: it.item_name,
            result: it.result,
            notes: it.notes || null,
          })
          .select("id")
          .single();
        if (itErr) throw itErr;
        if (it.photo) {
          const path = await uploadPhoto("inspection-photos", it.photo, `${insp.id}`);
          await supabase.from("inspection_item_photos").insert({ inspection_item_id: itemRow.id, photo_url: path });
        }
      }

      toast.success("Pre-trip complete. Drive safely!");
      clearDriverSession();
      navigate("/", { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const passCount = summary ? summary.filter((r) => r.result === "pass").length : 0;
  const issueCount = summary ? summary.filter((r) => r.result === "issue").length : 0;
  const photoCount = summary ? summary.filter((r) => r.photo).length : 0;

  return (
    <DriverShell title="Pre-trip checklist" back={vehicleId ? `/driver/start/${vehicleId}/blueprint` : "/driver/start"} steps={{ steps: ["Select", "Inspect", "Pre-trip"], current: 3 }}>
      <InspectionChecklist
        onSubmit={(items) => setSummary(items)}
        submitLabel="Complete pre-trip"
        submitting={submitting}
        items={checklistItems}
        loading={checklistLoading}
      />

      <Dialog open={!!summary} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inspection Summary</DialogTitle>
            <DialogDescription>
              Review the details below before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <SummaryRow icon={<Car className="h-4 w-4 shrink-0 text-blue-600" />} label="Vehicle">
              {vehicle
                ? `${vehicle.registration_number} — ${vehicle.make} ${vehicle.model}`
                : "Loading…"}
            </SummaryRow>

            <SummaryRow
              icon={<AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
              label="Reported damage"
            >
              {reportedDamageCount} item(s)
            </SummaryRow>

            <SummaryRow
              icon={<ClipboardList className="h-4 w-4 shrink-0 text-green-600" />}
              label="Checklist results"
            >
              <span className="text-green-700 dark:text-green-400">{passCount} pass</span>
              {issueCount > 0 && (
                <span className="text-destructive">, {issueCount} issue(s)</span>
              )}
            </SummaryRow>

            <SummaryRow icon={<Camera className="h-4 w-4 shrink-0 text-muted-foreground" />} label="Photos uploaded">
              {photoCount}
            </SummaryRow>

            <SummaryRow icon={<User className="h-4 w-4 shrink-0 text-muted-foreground" />} label="Driver">
              {driver.name} {driver.surname}
            </SummaryRow>
          </div>

          <Button
            className="h-12 w-full"
            onClick={() => {
              if (summary) confirmSubmit(summary);
            }}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "I confirm this inspection is accurate"}
          </Button>
        </DialogContent>
      </Dialog>
    </DriverShell>
  );
}

function SummaryRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );
}
