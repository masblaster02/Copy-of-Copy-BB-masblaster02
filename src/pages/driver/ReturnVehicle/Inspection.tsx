import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DriverShell } from "@/components/layout/DriverShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleBlueprint, type BlueprintMarker, type BlueprintView } from "@/components/VehicleBlueprint";
import { getDriverSession, clearDriverSession } from "@/lib/auth/driverAuth";
import { supabase } from "@/lib/supabase";
import { uploadPhoto, getPublicUrl, getDamagePhotoUrl } from "@/lib/storage";
import { toast } from "sonner";
import {
  Camera,
  Loader as Loader2,
  Trash2,
  LogOut,
  CircleAlert as AlertCircle,
  Check,
  X,
  Car,
  ClipboardList,
  User,
  Fuel,
  TriangleAlert as AlertTriangle,
} from "lucide-react";
import { type ChecklistItemDef } from "@/components/InspectionChecklist";

const DAMAGE_TYPES = ["scratch", "dent", "crack", "paint", "missing_part", "other"];
const BASE_BUCKET = "vehicle-base-photos";
const DAMAGE_BUCKET = "damage-photos";
const BLUEPRINT_BUCKET = "vehicle-blueprints";

interface NewMarker extends BlueprintMarker {
  damage_type: string;
  description: string;
  photos: File[];
}

interface MarkerRow {
  id: string;
  x_coordinate: number;
  y_coordinate: number;
  view: BlueprintView;
  status: string;
  source: "baseline" | "driver";
  damage_type: string;
  description: string | null;
  approved: boolean;
}

type FuelLevelValue = "empty" | "half" | "full";

// Per-item state for checklist items
interface ItemState {
  item_id: string;
  item_text: string;
  item_key: string | null;
  result: "pass" | "issue" | null;
  notes: string;
  photo?: File;
  // special state for fuel_level
  fuelLevel?: FuelLevelValue;
}

export default function DriverReturnInspection() {
  const driver = getDriverSession()!;
  const navigate = useNavigate();

  const [markers, setMarkers] = useState<NewMarker[]>([]);
  const [view, setView] = useState<BlueprintView>("front");
  const [openMarker, setOpenMarker] = useState<MarkerRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(false);
  const [itemStates, setItemStates] = useState<ItemState[]>([]);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["driver-active-session-full", driver.driver_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_sessions")
        .select("id, vehicle_id, vehicle:vehicles(registration_number, make, model)")
        .eq("driver_id", driver.driver_id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const vehicleId = session?.vehicle_id;

  const { data: checklistItems, isLoading: checklistLoading } = useQuery<ChecklistItemDef[]>({
    queryKey: ["vehicle-return-checklist", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vehicle_enabled_checklist", {
        p_vehicle_id: vehicleId,
        p_type: "return",
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.item_id,
        item_text: d.item_text,
        item_order: d.item_order,
        is_active: true,
        item_key: d.item_key ?? null,
      }));
    },
  });

  // Initialise item states when checklist loads
  useEffect(() => {
    if (!checklistItems) return;
    setItemStates(
      checklistItems.map((ci) => ({
        item_id: ci.id,
        item_text: ci.item_text,
        item_key: ci.item_key ?? null,
        result: null,
        notes: "",
        fuelLevel: ci.item_key === "fuel_level" ? undefined : undefined,
      })),
    );
  }, [checklistItems]);

  const { data: vehicleData } = useQuery({
    queryKey: ["driver-return-blueprint", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const [m, p, links, bp, dp] = await Promise.all([
        supabase
          .from("damage_markers")
          .select("id, x_coordinate, y_coordinate, view, status, source, damage_type, description, approved")
          .eq("vehicle_id", vehicleId)
          .in("status", ["open", "in_review"]),
        supabase.from("vehicle_base_photos").select("id, photo_url, view, label").eq("vehicle_id", vehicleId),
        supabase.from("damage_marker_base_photos").select("damage_marker_id, base_photo_id"),
        supabase.from("vehicle_blueprints").select("view, blueprint_image").eq("vehicle_id", vehicleId),
        supabase.from("damage_marker_photos").select("id, damage_marker_id, photo_url"),
      ]);
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (links.error) throw links.error;
      if (bp.error) throw bp.error;
      if (dp.error) throw dp.error;
      return {
        markers: m.data as MarkerRow[],
        basePhotos: p.data as { id: string; photo_url: string; view: BlueprintView | null; label: string | null }[],
        links: links.data as { damage_marker_id: string; base_photo_id: string }[],
        blueprints: bp.data as { view: BlueprintView | null; blueprint_image: string }[],
        damagePhotos: dp.data as { id: string; damage_marker_id: string; photo_url: string }[],
      };
    },
  });

  const blueprintImages: Partial<Record<BlueprintView, string>> = {};
  for (const b of vehicleData?.blueprints ?? []) {
    if (b.view) blueprintImages[b.view] = getPublicUrl(BLUEPRINT_BUCKET, b.blueprint_image);
  }

  const existingMarkers: BlueprintMarker[] =
    vehicleData?.markers.map((m) => ({
      id: m.id,
      x: Number(m.x_coordinate),
      y: Number(m.y_coordinate),
      view: m.view,
      source: m.source,
      color: m.source === "baseline" ? "hsl(220 80% 55%)" : m.status === "repaired" ? "hsl(142 71% 45%)" : "hsl(0 80% 50%)",
    })) ?? [];

  const linkedPhotosFor = (markerId: string) => {
    const ids = (vehicleData?.links ?? []).filter((l) => l.damage_marker_id === markerId).map((l) => l.base_photo_id);
    return (vehicleData?.basePhotos ?? []).filter((p) => ids.includes(p.id));
  };

  function addMarker(m: { x: number; y: number; view: BlueprintView }) {
    setMarkers((arr) => [...arr, { ...m, damage_type: "scratch", description: "", photos: [] }]);
  }
  function updateMarker(i: number, patch: Partial<NewMarker>) {
    setMarkers((arr) => arr.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function removeMarker(i: number) {
    setMarkers((arr) => arr.filter((_, idx) => idx !== i));
  }

  function patchItem(item_id: string, patch: Partial<ItemState>) {
    setItemStates((s) => s.map((x) => (x.item_id === item_id ? { ...x, ...patch } : x)));
  }

  const newDamageItem = itemStates.find((s) => s.item_key === "new_damage");
  const showBlueprint = newDamageItem?.result === "issue";

  const allItemsDone = itemStates.every((s) => {
    if (s.item_key === "fuel_level") return !!s.fuelLevel;
    return s.result !== null;
  });
  const allPhotosValid = markers.every((m) => m.photos.length >= 2);
  const newDamageReported = newDamageItem?.result === "issue";
  const canSubmit =
    allItemsDone &&
    allPhotosValid &&
    !(newDamageReported && markers.length === 0);

  async function confirmReturn() {
    if (!session) return;
    setSubmitting(true);
    try {
      for (const m of markers) {
        const { data: mr, error: mErr } = await supabase
          .from("damage_markers")
          .insert({
            vehicle_id: session.vehicle_id,
            driver_id: driver.driver_id,
            session_id: session.id,
            reported_during: "return",
            damage_type: m.damage_type,
            description: m.description || null,
            status: "open",
            source: "driver",
            x_coordinate: m.x,
            y_coordinate: m.y,
            view: m.view,
          })
          .select("id")
          .single();
        if (mErr) throw mErr;
        for (const f of m.photos) {
          const path = await uploadPhoto("damage-photos", f, `${mr.id}`);
          await supabase.from("damage_marker_photos").insert({ damage_marker_id: mr.id, photo_url: path });
        }
      }

      const { data: insp, error: iErr } = await supabase
        .from("inspections")
        .insert({
          session_id: session.id,
          driver_id: driver.driver_id,
          vehicle_id: session.vehicle_id,
          inspection_type: "return",
        })
        .select("id")
        .single();
      if (iErr) throw iErr;

      for (const s of itemStates) {
        let result: "pass" | "issue";
        let notes: string | null = null;

        if (s.item_key === "fuel_level") {
          result = "pass";
          notes = s.fuelLevel ?? null;
        } else if (s.item_key === "new_damage") {
          result = s.result === "issue" ? "issue" : "pass";
          notes = s.result === "issue" ? `${markers.length} item(s) reported` : null;
        } else {
          result = s.result === "issue" ? "issue" : "pass";
          notes = s.notes || null;
        }

        const { data: itemRow, error: itErr } = await supabase
          .from("inspection_items")
          .insert({ inspection_id: insp.id, item_name: s.item_text, result, notes })
          .select("id")
          .single();
        if (itErr) throw itErr;

        if (s.photo) {
          const path = await uploadPhoto("inspection-photos", s.photo, `${insp.id}`);
          await supabase.from("inspection_item_photos").insert({ inspection_item_id: itemRow.id, photo_url: path });
        }
      }

      // Marks session completed; trigger auto-sets vehicle to 'available'.
      const { error: cErr } = await supabase.rpc("complete_vehicle_session", { p_session_id: session.id });
      if (cErr) throw cErr;
      toast.success("Vehicle returned. Thanks!");
      clearDriverSession();
      navigate("/", { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionLoading || checklistLoading) {
    return (
      <DriverShell title="Return vehicle" back="/driver">
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </DriverShell>
    );
  }

  if (!session) {
    return (
      <DriverShell title="Return vehicle" back="/driver">
        <p className="text-sm text-muted-foreground">No active session found.</p>
      </DriverShell>
    );
  }

  return (
    <DriverShell
      title="Return vehicle"
      back="/driver"
      action={
        <Button variant="ghost" size="icon" onClick={() => { clearDriverSession(); navigate("/", { replace: true }); }} aria-label="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      }
    >
      <div className="space-y-4">
        {/* @ts-expect-error supabase relation */}
        <p className="text-sm text-muted-foreground">Vehicle: {session.vehicle?.registration_number}</p>

        <div className="space-y-3">
          {itemStates.map((s) => {
            if (s.item_key === "new_damage") {
              return (
                <Card key={s.item_id} className={s.result ? (s.result === "pass" ? "border-green-600/30" : "border-amber-500/30") : ""}>
                  <div className="flex items-center justify-between p-4">
                    <span className="text-sm font-medium">{s.item_text}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant={s.result === "issue" ? "default" : "outline"} className={s.result === "issue" ? "bg-amber-600 hover:bg-amber-700" : ""} onClick={() => patchItem(s.item_id, { result: "issue" })}>
                        <X className="mr-1 h-4 w-4" /> Yes
                      </Button>
                      <Button size="sm" variant={s.result === "pass" ? "default" : "outline"} className={s.result === "pass" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => patchItem(s.item_id, { result: "pass" })}>
                        <Check className="mr-1 h-4 w-4" /> No
                      </Button>
                    </div>
                  </div>
                  {s.result === "issue" && markers.length === 0 && (
                    <div className="border-t px-4 py-2 text-xs text-amber-600">
                      Tap on the blueprint below to mark damage locations.
                    </div>
                  )}
                </Card>
              );
            }

            if (s.item_key === "fuel_level") {
              return (
                <Card key={s.item_id} className={s.fuelLevel ? "border-green-600/30" : ""}>
                  <div className="flex items-center justify-between p-4">
                    <span className="text-sm font-medium">{s.item_text}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant={s.fuelLevel === "empty" ? "default" : "outline"} className={s.fuelLevel === "empty" ? "bg-red-600 hover:bg-red-700" : ""} onClick={() => patchItem(s.item_id, { fuelLevel: "empty" })}>
                        Empty
                      </Button>
                      <Button size="sm" variant={s.fuelLevel === "half" ? "default" : "outline"} className={s.fuelLevel === "half" ? "bg-amber-600 hover:bg-amber-700" : ""} onClick={() => patchItem(s.item_id, { fuelLevel: "half" })}>
                        Half
                      </Button>
                      <Button size="sm" variant={s.fuelLevel === "full" ? "default" : "outline"} className={s.fuelLevel === "full" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => patchItem(s.item_id, { fuelLevel: "full" })}>
                        Full
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            }

            if (s.item_key === "warning_lights") {
              return (
                <Card key={s.item_id} className={s.result ? (s.result === "pass" ? "border-green-600/30" : "border-amber-500/30") : ""}>
                  <div className="flex items-center justify-between p-4">
                    <span className="text-sm font-medium">{s.item_text}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant={s.result === "issue" ? "default" : "outline"} className={s.result === "issue" ? "bg-amber-600 hover:bg-amber-700" : ""} onClick={() => patchItem(s.item_id, { result: "issue" })}>
                        <X className="mr-1 h-4 w-4" /> Yes
                      </Button>
                      <Button size="sm" variant={s.result === "pass" ? "default" : "outline"} className={s.result === "pass" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => patchItem(s.item_id, { result: "pass" })}>
                        <Check className="mr-1 h-4 w-4" /> No
                      </Button>
                    </div>
                  </div>
                  {s.result === "issue" && (
                    <div className="border-t p-4">
                      <Label className="text-xs">Describe the warning lights</Label>
                      <Textarea rows={2} placeholder="Which lights are on?" value={s.notes} onChange={(e) => patchItem(s.item_id, { notes: e.target.value })} />
                    </div>
                  )}
                </Card>
              );
            }

            // Generic Pass / Issue item
            return (
              <Card key={s.item_id} className={s.result ? (s.result === "pass" ? "border-green-600/30" : "border-amber-500/30") : ""}>
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm font-medium">{s.item_text}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant={s.result === "pass" ? "default" : "outline"} className={s.result === "pass" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => patchItem(s.item_id, { result: "pass" })}>
                      <Check className="mr-1 h-4 w-4" /> Pass
                    </Button>
                    <Button size="sm" variant={s.result === "issue" ? "default" : "outline"} className={s.result === "issue" ? "bg-destructive hover:bg-destructive/90" : ""} onClick={() => patchItem(s.item_id, { result: "issue" })}>
                      <X className="mr-1 h-4 w-4" /> Issue
                    </Button>
                  </div>
                </div>
                {s.result === "issue" && (
                  <div className="border-t p-4 space-y-2">
                    <Textarea placeholder="Describe the issue…" rows={2} value={s.notes} onChange={(e) => patchItem(s.item_id, { notes: e.target.value })} />
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                      <Camera className="h-4 w-4" />
                      {s.photo ? s.photo.name : "Add photo"}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => patchItem(s.item_id, { photo: e.target.files?.[0] })} />
                    </label>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Blueprint - only show if New Damage = Yes */}
        {showBlueprint && (
          <div className="rounded-lg border bg-card p-3">
            <VehicleBlueprint
              blueprintImages={blueprintImages}
              markers={[...existingMarkers, ...markers]}
              view={view}
              onViewChange={setView}
              onAdd={addMarker}
              onMarkerClick={(m) => {
                const row = vehicleData?.markers.find((x) => x.id === m.id);
                if (row) setOpenMarker(row);
              }}
            />
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Legend color="hsl(220 80% 55%)" label="Known damage (tap)" />
              <Legend color="hsl(0 80% 50%)" label="New reports" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Tap an empty area to report new damage.</p>
          </div>
        )}

        {/* New damage detail cards */}
        {markers.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">New damage ({markers.length})</p>
            {markers.map((m, i) => (
              <Card key={i} className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-muted-foreground">
                    {m.view} ({m.x.toFixed(0)}, {m.y.toFixed(0)})
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => removeMarker(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={m.damage_type} onValueChange={(v) => updateMarker(i, { damage_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAMAGE_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="Description" rows={2} value={m.description} onChange={(e) => updateMarker(i, { description: e.target.value })} />
                <div>
                  <Label className="text-xs">Photos ({m.photos.length}/2)</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {m.photos.map((f, pi) => (
                      <div key={pi} className="relative aspect-square overflow-hidden rounded-md border">
                        <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => updateMarker(i, { photos: m.photos.filter((_, idx) => idx !== pi) })} className="absolute right-1 top-1 rounded bg-background/90 px-1 text-xs">✕</button>
                      </div>
                    ))}
                    {m.photos.length < 2 && (
                      <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground">
                        <Camera className="h-5 w-5" />
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) updateMarker(i, { photos: [...m.photos, f] }); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                  {m.photos.length < 2 && <p className="mt-1 text-xs text-destructive">{2 - m.photos.length} more photo(s) required</p>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {!allItemsDone && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            Complete all checklist items before confirming.
          </div>
        )}

        {newDamageReported && markers.length === 0 && allItemsDone && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            Mark at least one damage location on the blueprint.
          </div>
        )}

        <Button className="h-12 w-full" onClick={() => setSummary(true)} disabled={!canSubmit}>
          {markers.length > 0 ? `Submit ${markers.length} damage(s) & confirm return` : "Confirm Return"}
        </Button>
      </div>

      {/* Summary dialog */}
      <Dialog open={summary} onOpenChange={(o) => !o && setSummary(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return Summary</DialogTitle>
            <DialogDescription>Review the details before confirming.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SummaryRow icon={<Car className="h-4 w-4 shrink-0 text-blue-600" />} label="Vehicle">
              {/* @ts-expect-error supabase relation */}
              {session.vehicle?.registration_number} — {session.vehicle?.make} {session.vehicle?.model}
            </SummaryRow>
            {itemStates.map((s) => {
              if (s.item_key === "new_damage") return (
                <SummaryRow key={s.item_id} icon={<AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />} label={s.item_text}>
                  {s.result === "issue" ? `Yes — ${markers.length} item(s) reported` : "No"}
                </SummaryRow>
              );
              if (s.item_key === "fuel_level") return (
                <SummaryRow key={s.item_id} icon={<Fuel className="h-4 w-4 shrink-0 text-muted-foreground" />} label={s.item_text}>
                  {s.fuelLevel === "empty" ? "Empty" : s.fuelLevel === "half" ? "Half" : "Full"}
                </SummaryRow>
              );
              if (s.item_key === "warning_lights") return (
                <SummaryRow key={s.item_id} icon={<ClipboardList className="h-4 w-4 shrink-0 text-green-600" />} label={s.item_text}>
                  {s.result === "issue" ? `Yes${s.notes ? ` — ${s.notes}` : ""}` : "No"}
                </SummaryRow>
              );
              return (
                <SummaryRow key={s.item_id} icon={<ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />} label={s.item_text}>
                  <span className={s.result === "pass" ? "text-green-700 dark:text-green-400" : "text-destructive capitalize"}>
                    {s.result}
                  </span>
                </SummaryRow>
              );
            })}
            <SummaryRow icon={<User className="h-4 w-4 shrink-0 text-muted-foreground" />} label="Driver">
              {driver.name} {driver.surname}
            </SummaryRow>
          </div>
          <Button className="h-12 w-full" onClick={confirmReturn} disabled={submitting}>
            {submitting ? "Submitting…" : "I confirm this return is accurate"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Existing marker sheet */}
      <Sheet open={!!openMarker} onOpenChange={(o) => !o && setOpenMarker(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          {openMarker && (
            <>
              <SheetHeader>
                <SheetTitle className="capitalize">
                  {openMarker.source === "baseline" ? "Known damage" : "Previously reported"} — {openMarker.damage_type.replace("_", " ")}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4">
                {openMarker.description && <p className="text-sm">{openMarker.description}</p>}
                {openMarker.source === "driver" && !openMarker.approved && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                    Awaiting admin approval. Photos visible once reviewed.
                  </div>
                )}
                {(() => {
                  if (openMarker.source === "baseline") {
                    const photos = linkedPhotosFor(openMarker.id);
                    return photos.length ? (
                      <div>
                        <p className="mb-2 text-sm font-medium">Reference photos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {photos.map((p) => (
                            <a key={p.id} href={getPublicUrl(BASE_BUCKET, p.photo_url)} target="_blank" rel="noreferrer">
                              <img src={getPublicUrl(BASE_BUCKET, p.photo_url)} alt="" className="aspect-square w-full rounded-md object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No reference photos linked.</p>
                    );
                  }
                  const photos = (vehicleData?.damagePhotos ?? []).filter((p) => p.damage_marker_id === openMarker.id);
                  if (!openMarker.approved) return null;
                  return photos.length ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Damage photos</p>
                      <div className="grid grid-cols-2 gap-2">
                        {photos.map((p) => <DamagePhotoImg key={p.id} path={p.photo_url} />)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No approved photos yet.</p>
                  );
                })()}
                <div className="rounded-md border border-dashed p-3">
                  <p className="flex items-start gap-2 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    New damage near this spot? Report it below.
                  </p>
                  <Button variant="outline" className="mt-3 w-full" onClick={() => { addMarker({ x: Number(openMarker.x_coordinate), y: Number(openMarker.y_coordinate), view: openMarker.view }); setOpenMarker(null); }}>
                    Report new damage here
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DriverShell>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

function DamagePhotoImg({ path }: { path: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    getDamagePhotoUrl(path).then(setUrl).catch(() => setUrl(""));
  }, [path]);
  if (!url) return <div className="aspect-square w-full animate-pulse rounded-md bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="aspect-square w-full rounded-md object-cover" />
    </a>
  );
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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
