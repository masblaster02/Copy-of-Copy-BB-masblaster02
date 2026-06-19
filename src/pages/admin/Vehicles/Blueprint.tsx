import { useState } from "react";
import { useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  VehicleBlueprint,
  type BlueprintMarker,
  type BlueprintView,
} from "@/components/VehicleBlueprint";
import { supabase } from "@/lib/supabase";
import { uploadPhoto, uploadPhotoAt, getPublicUrl, getSignedUrl } from "@/lib/storage";
import { toast } from "sonner";
import { Camera, Loader as Loader2, Trash2, Upload, ClipboardList, Check } from "lucide-react";
import { useEffect } from "react";

const VIEWS: BlueprintView[] = ["front", "rear", "left", "right", "roof", "interior"];
const DAMAGE_TYPES = ["scratch", "dent", "crack", "paint", "missing_part", "other"];
const BASE_BUCKET = "vehicle-base-photos";
const DAMAGE_BUCKET = "damage-photos";
const BLUEPRINT_BUCKET = "vehicle-blueprints";

interface BasePhoto {
  id: string;
  photo_url: string;
  view: BlueprintView | null;
  label: string | null;
}
interface MarkerRow {
  id: string;
  x_coordinate: number;
  y_coordinate: number;
  view: BlueprintView;
  status: string;
  damage_type: string;
  description: string | null;
  source: "baseline" | "driver";
  approved: boolean;
  driver_id: string | null;
  reported_at: string;
}
interface DamagePhoto {
  id: string;
  damage_marker_id: string;
  photo_url: string;
  approved: boolean;
  uploaded_at: string;
}

export default function AdminVehicleBlueprint() {
  const { vehicleId } = useParams();
  const qc = useQueryClient();
  const [view, setView] = useState<BlueprintView>("front");
  const [newCoord, setNewCoord] = useState<{ x: number; y: number; view: BlueprintView } | null>(
    null,
  );
  const [openMarker, setOpenMarker] = useState<MarkerRow | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-vehicle-detail", vehicleId],
    queryFn: async () => {
      const [v, m, p, links, bp, dp, drv] = await Promise.all([
        supabase
          .from("vehicles")
          .select("registration_number, make, model")
          .eq("id", vehicleId)
          .single(),
        supabase
          .from("damage_markers")
          .select(
            "id, x_coordinate, y_coordinate, view, status, damage_type, description, source, approved, driver_id, reported_at",
          )
          .eq("vehicle_id", vehicleId),
        supabase
          .from("vehicle_base_photos")
          .select("id, photo_url, view, label")
          .eq("vehicle_id", vehicleId),
        supabase.from("damage_marker_base_photos").select("damage_marker_id, base_photo_id"),
        supabase
          .from("vehicle_blueprints")
          .select("id, view, blueprint_image")
          .eq("vehicle_id", vehicleId),
        supabase
          .from("damage_marker_photos")
          .select("id, damage_marker_id, photo_url, approved, uploaded_at"),
        supabase.from("drivers").select("id, name, surname, employee_number"),
      ]);
      if (v.error) throw v.error;
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (links.error) throw links.error;
      if (bp.error) throw bp.error;
      if (dp.error) throw dp.error;
      if (drv.error) throw drv.error;
      return {
        vehicle: v.data,
        markers: m.data as MarkerRow[],
        basePhotos: p.data as BasePhoto[],
        links: links.data,
        blueprints: bp.data as { id: string; view: BlueprintView | null; blueprint_image: string }[],
        damagePhotos: dp.data as DamagePhoto[],
        drivers: drv.data as { id: string; name: string; surname: string; employee_number: string }[],
      };
    },
  });

  const blueprintImages: Partial<Record<BlueprintView, string>> = {};
  for (const b of data?.blueprints ?? []) {
    if (b?.view) blueprintImages[b.view] = getPublicUrl(BLUEPRINT_BUCKET, b.blueprint_image);
  }

  const markers: BlueprintMarker[] =
    (data?.markers ?? []).map((m) => ({
      id: m.id,
      x: Number(m.x_coordinate),
      y: Number(m.y_coordinate),
      view: m.view,
      source: m.source,
      color:
        m.source === "baseline"
          ? "hsl(220 80% 55%)"
          : m.status === "repaired"
            ? "hsl(142 71% 45%)"
            : m.status === "in_review"
              ? "hsl(45 90% 50%)"
              : "hsl(0 80% 50%)",
    })) ?? [];

  /* -------- base photo upload -------- */
  const uploadBase = useMutation({
    mutationFn: async ({ file, v, label }: { file: File; v: BlueprintView; label: string }) => {
      const path = await uploadPhoto(BASE_BUCKET, file, `${vehicleId}`);
      const { error } = await supabase.from("vehicle_base_photos").insert({
        vehicle_id: vehicleId,
        photo_url: path,
        view: v,
        label: label || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Photo added");
      qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_base_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] }),
  });

  /* -------- blueprint image upload (per view) -------- */
  const uploadBlueprint = useMutation({
    mutationFn: async ({ file, v }: { file: File; v: BlueprintView }) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${vehicleId}/${v}.${ext}`;
      // Remove any prior file for this view (different extension)
      const { data: existing } = await supabase.storage
        .from(BLUEPRINT_BUCKET)
        .list(`${vehicleId}`, { search: `${v}.` });
      const toRemove = (existing ?? [])
        .filter((f) => f.name.startsWith(`${v}.`) && f.name !== `${v}.${ext}`)
        .map((f) => `${vehicleId}/${f.name}`);
      if (toRemove.length) await supabase.storage.from(BLUEPRINT_BUCKET).remove(toRemove);

      await uploadPhotoAt(BLUEPRINT_BUCKET, file, path, true);

      const { error } = await supabase
        .from("vehicle_blueprints")
        .upsert(
          { vehicle_id: vehicleId, view: v, blueprint_image: path, updated_at: new Date().toISOString() },
          { onConflict: "vehicle_id,view" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blueprint updated");
      qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBlueprint = useMutation({
    mutationFn: async (v: BlueprintView) => {
      const row = data?.blueprints.find((b) => b.view === v);
      if (!row) return;
      await supabase.storage.from(BLUEPRINT_BUCKET).remove([row.blueprint_image]);
      const { error } = await supabase.from("vehicle_blueprints").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blueprint removed");
      qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* -------- delete marker -------- */
  const deleteMarker = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("damage_markers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setOpenMarker(null);
      qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] });
    },
  });

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Vehicles", href: "/admin/vehicles" }, { label: data?.vehicle.registration_number ?? "…" }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{data?.vehicle.registration_number}</h1>
        <p className="text-sm text-muted-foreground">
          {data?.vehicle.make} {data?.vehicle.model}
        </p>
      </div>

      <Tabs defaultValue="blueprint">
        <TabsList>
          <TabsTrigger value="blueprint">Blueprint & damage</TabsTrigger>
          <TabsTrigger value="images">
            Blueprint images ({(data?.blueprints ?? []).filter((b) => b?.view).length}/6)
          </TabsTrigger>
          <TabsTrigger value="base">Base photos ({(data?.basePhotos ?? []).length})</TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardList className="mr-1 h-4 w-4" />
            Checklist
          </TabsTrigger>
        </TabsList>

        {/* ---------- BLUEPRINT TAB ---------- */}
        <TabsContent value="blueprint" className="space-y-4">
          <Card className="p-4">
            <VehicleBlueprint
              markers={markers}
              view={view}
              onViewChange={setView}
              onAdd={(c) => setNewCoord(c)}
              blueprintImages={blueprintImages}
              onMarkerClick={(m) => {
                const row = data?.markers.find((x) => x.id === m.id);
                if (row) setOpenMarker(row);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Legend color="hsl(220 80% 55%)" label="Baseline (B)" />
              <Legend color="hsl(0 80% 50%)" label="Open" />
              <Legend color="hsl(45 90% 50%)" label="In review" />
              <Legend color="hsl(142 71% 45%)" label="Repaired" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap empty area to add a baseline marker. Tap a marker to edit or link base photos.
            </p>
          </Card>
        </TabsContent>

        {/* ---------- BLUEPRINT IMAGES TAB ---------- */}
        <TabsContent value="images" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload one image per side. Drivers will see this exact image when inspecting the
            vehicle. Each image is stored under <code>{`${BLUEPRINT_BUCKET}/${vehicleId}/<view>`}</code>.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {VIEWS.map((v) => {
              const url = blueprintImages[v];
              return (
                <Card key={v} className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium capitalize">{v}</p>
                    {url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteBlueprint.mutate(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    {url ? (
                      <img src={url} alt={`${v} blueprint`} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No image</span>
                    )}
                  </div>
                  <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm">
                    {uploadBlueprint.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {url ? "Replace image" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadBlueprint.mutate({ file: f, v });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Card>
              );
            })}
          </div>
        </TabsContent>


        {/* ---------- BASE PHOTOS TAB ---------- */}
        <TabsContent value="base" className="space-y-4">
          <BasePhotoUploader
            onUpload={(file, v, label) => uploadBase.mutate({ file, v, label })}
            uploading={uploadBase.isPending}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data?.basePhotos.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <img
                  src={getPublicUrl(BASE_BUCKET, p.photo_url)}
                  alt={p.label ?? ""}
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between p-2">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="capitalize">
                      {p.view ?? "—"}
                    </Badge>
                    {p.label && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{p.label}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteBase.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {!data?.basePhotos.length && (
              <p className="col-span-full text-sm text-muted-foreground">
                No base photos yet. Upload reference photos for each angle.
              </p>
            )}
          </div>
        </TabsContent>

        {/* ---------- CHECKLIST TAB ---------- */}
        <TabsContent value="checklist" className="space-y-4">
          <VehicleChecklistToggle vehicleId={vehicleId!} />
        </TabsContent>
      </Tabs>

      {/* ---------- NEW BASELINE MARKER SHEET ---------- */}
      <NewBaselineMarkerSheet
        open={!!newCoord}
        coord={newCoord}
        basePhotos={(data?.basePhotos ?? []).filter((p) => p.view === newCoord?.view)}
        vehicleId={vehicleId!}
        onClose={() => setNewCoord(null)}
        onSaved={() => {
          setNewCoord(null);
          qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] });
        }}
      />

      {/* ---------- EXISTING MARKER SHEET ---------- */}
      <ExistingMarkerSheet
        marker={openMarker}
        basePhotos={data?.basePhotos ?? []}
        links={data?.links ?? []}
        damagePhotos={(data?.damagePhotos ?? []).filter(
          (p) => p.damage_marker_id === openMarker?.id,
        )}
        drivers={data?.drivers ?? []}
        onClose={() => setOpenMarker(null)}
        onChanged={() =>
          qc.invalidateQueries({ queryKey: ["admin-vehicle-detail", vehicleId] })
        }
        onDelete={(id) => deleteMarker.mutate(id)}
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

function SignedDamageImg({ path }: { path: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    getSignedUrl(DAMAGE_BUCKET, path).then(setUrl).catch(() => setUrl(""));
  }, [path]);
  if (!url) return <div className="aspect-square w-full animate-pulse rounded bg-muted" />;
  return <img src={url} alt="" className="aspect-square w-full object-cover" />;
}

/* ============================================================
   Base photo uploader
============================================================ */
function BasePhotoUploader({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, view: BlueprintView, label: string) => void;
  uploading: boolean;
}) {
  const [view, setView] = useState<BlueprintView>("front");
  const [label, setLabel] = useState("");

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-medium">Add base photo</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs">View</Label>
          <Select value={view} onValueChange={(v) => setView(v as BlueprintView)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map((v) => (
                <SelectItem key={v} value={v} className="capitalize">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Label (optional)</Label>
          <Input
            placeholder="e.g. front bumper close-up"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 text-sm">
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Choose photo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onUpload(f, view, label);
              setLabel("");
              e.target.value = "";
            }
          }}
        />
      </label>
    </Card>
  );
}

/* ============================================================
   Sheet: create a new baseline marker (after admin clicks blueprint)
============================================================ */
function NewBaselineMarkerSheet({
  open,
  coord,
  basePhotos,
  vehicleId,
  onClose,
  onSaved,
}: {
  open: boolean;
  coord: { x: number; y: number; view: BlueprintView } | null;
  basePhotos: BasePhoto[];
  vehicleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [damageType, setDamageType] = useState("scratch");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!coord) return;
    setSaving(true);
    try {
      const { data: mr, error } = await supabase
        .from("damage_markers")
        .insert({
          vehicle_id: vehicleId,
          damage_type: damageType,
          description: description || null,
          status: "open",
          source: "baseline",
          approved: true,
          x_coordinate: coord.x,
          y_coordinate: coord.y,
          view: coord.view,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (selected.length) {
        const rows = selected.map((bp) => ({
          damage_marker_id: mr.id,
          base_photo_id: bp,
        }));
        const { error: lErr } = await supabase
          .from("damage_marker_base_photos")
          .insert(rows);
        if (lErr) throw lErr;
      }
      toast.success("Baseline marker added");
      setDamageType("scratch");
      setDescription("");
      setSelected([]);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add baseline damage</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {coord && (
            <p className="text-xs text-muted-foreground">
              {coord.view} · ({coord.x.toFixed(0)}, {coord.y.toFixed(0)})
            </p>
          )}
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={damageType} onValueChange={setDamageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAMAGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Link base photos showing this damage</p>
            {basePhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No base photos for this view. Upload some in the Base photos tab.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {basePhotos.map((p) => {
                  const checked = selected.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() =>
                        setSelected((s) =>
                          checked ? s.filter((x) => x !== p.id) : [...s, p.id],
                        )
                      }
                      className={`relative overflow-hidden rounded-md border-2 ${
                        checked ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img
                        src={getPublicUrl(BASE_BUCKET, p.photo_url)}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      <Checkbox
                        checked={checked}
                        className="absolute right-1 top-1 bg-background"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save marker"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ============================================================
   Sheet: existing marker (edit links, view photos, delete)
============================================================ */
function ExistingMarkerSheet({
  marker,
  basePhotos,
  links,
  damagePhotos,
  drivers,
  onClose,
  onChanged,
  onDelete,
}: {
  marker: MarkerRow | null;
  basePhotos: BasePhoto[];
  links: { damage_marker_id: string; base_photo_id: string }[];
  damagePhotos: DamagePhoto[];
  drivers: { id: string; name: string; surname: string; employee_number: string }[];
  onClose: () => void;
  onChanged: () => void;
  onDelete: (id: string) => void;
}) {
  const linkedIds = links
    .filter((l) => l.damage_marker_id === marker?.id)
    .map((l) => l.base_photo_id);
  const [busy, setBusy] = useState(false);

  if (!marker) return null;
  const sameViewPhotos = basePhotos.filter((p) => p.view === marker.view);
  const linkedPhotos = basePhotos.filter((p) => linkedIds.includes(p.id));
  const reporter = marker.driver_id
    ? drivers.find((d) => d.id === marker.driver_id)
    : null;

  async function toggle(bpId: string) {
    setBusy(true);
    try {
      if (linkedIds.includes(bpId)) {
        await supabase
          .from("damage_marker_base_photos")
          .delete()
          .eq("damage_marker_id", marker!.id)
          .eq("base_photo_id", bpId);
      } else {
        await supabase.from("damage_marker_base_photos").insert({
          damage_marker_id: marker!.id,
          base_photo_id: bpId,
        });
      }
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(s: string) {
    await supabase.from("damage_markers").update({ status: s }).eq("id", marker!.id);
    onChanged();
  }

  async function approveMarker() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("damage_markers")
        .update({ approved: true, approved_at: new Date().toISOString() })
        .eq("id", marker!.id);
      if (error) throw error;
      // Approve all photos that have not been explicitly rejected (i.e. still pending)
      await supabase
        .from("damage_marker_photos")
        .update({ approved: true, approved_at: new Date().toISOString() })
        .eq("damage_marker_id", marker!.id);
      toast.success("Marker approved — visible to drivers");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePhoto(photoId: string, next: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("damage_marker_photos")
        .update({
          approved: next,
          approved_at: next ? new Date().toISOString() : null,
        })
        .eq("id", photoId);
      if (error) throw error;
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const { error } = await supabase
      .from("damage_marker_photos")
      .delete()
      .eq("id", photoId);
    if (error) toast.error(error.message);
    else onChanged();
  }

  return (
    <Sheet open={!!marker} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="capitalize">
            {marker.source} marker — {marker.damage_type.replace("_", " ")}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {marker.view} · ({Number(marker.x_coordinate).toFixed(0)},{" "}
              {Number(marker.y_coordinate).toFixed(0)})
            </p>
            <p>Reported {new Date(marker.reported_at).toLocaleString()}</p>
            {reporter && (
              <p>
                By {reporter.name} {reporter.surname} (#{reporter.employee_number})
              </p>
            )}
            <p>
              Approval:{" "}
              <Badge variant={marker.approved ? "default" : "secondary"}>
                {marker.approved ? "Approved" : "Pending"}
              </Badge>
            </p>
          </div>
          {marker.description && (
            <p className="text-sm">{marker.description}</p>
          )}

          {marker.source === "driver" && (
            <div>
              <p className="mb-2 text-sm font-medium">
                Driver photos ({damagePhotos.length})
              </p>
              {damagePhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No photos uploaded by the driver.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {damagePhotos.map((p) => (
                    <div
                      key={p.id}
                      className={`relative overflow-hidden rounded-md border-2 ${
                        p.approved ? "border-emerald-500" : "border-amber-500"
                      }`}
                    >
                      <SignedDamageImg path={p.photo_url} />
                      <div className="flex items-center justify-between gap-1 p-1 text-xs">
                        <Button
                          size="sm"
                          variant={p.approved ? "secondary" : "default"}
                          className="h-7 flex-1 px-2 text-xs"
                          disabled={busy}
                          onClick={() => togglePhoto(p.id, !p.approved)}
                        >
                          {p.approved ? "Unapprove" : "Approve"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => deletePhoto(p.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!marker.approved && (
                <Button
                  className="mt-2 w-full"
                  onClick={approveMarker}
                  disabled={busy}
                >
                  Approve marker &amp; all photos
                </Button>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Status</Label>
            <Select value={marker.status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In review</SelectItem>
                <SelectItem value="repaired">Repaired</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {linkedPhotos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Linked base photos</p>
              <div className="grid grid-cols-2 gap-2">
                {linkedPhotos.map((p) => (
                  <img
                    key={p.id}
                    src={getPublicUrl(BASE_BUCKET, p.photo_url)}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Link / unlink base photos ({marker.view})</p>
            {sameViewPhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground">No base photos for this view.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sameViewPhotos.map((p) => {
                  const checked = linkedIds.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      disabled={busy}
                      onClick={() => toggle(p.id)}
                      className={`relative overflow-hidden rounded-md border-2 ${
                        checked ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img
                        src={getPublicUrl(BASE_BUCKET, p.photo_url)}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      <Checkbox
                        checked={checked}
                        className="absolute right-1 top-1 bg-background"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onDelete(marker.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete marker
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ============================================================
   Vehicle Checklist Toggle - Enable/disable items per vehicle
============================================================ */
interface ChecklistItemWithStatus {
  item_id: string;
  item_text: string;
  item_order: number;
  item_key: string | null;
  enabled: boolean;
}

function VehicleChecklistToggle({ vehicleId }: { vehicleId: string }) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="pre_trip">
        <TabsList>
          <TabsTrigger value="pre_trip">Pre-Trip</TabsTrigger>
          <TabsTrigger value="return">Return</TabsTrigger>
        </TabsList>
        <TabsContent value="pre_trip" className="mt-4">
          <VehicleChecklistTypeToggle vehicleId={vehicleId} type="pre_trip" label="Pre-Trip Checklist Settings" />
        </TabsContent>
        <TabsContent value="return" className="mt-4">
          <VehicleChecklistTypeToggle vehicleId={vehicleId} type="return" label="Return Checklist Settings" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VehicleChecklistTypeToggle({
  vehicleId,
  type,
  label,
}: {
  vehicleId: string;
  type: "pre_trip" | "return";
  label: string;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: items, isLoading } = useQuery<ChecklistItemWithStatus[]>({
    queryKey: ["vehicle-checklist", vehicleId, type],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vehicle_checklist", {
        p_vehicle_id: vehicleId,
        p_type: type,
      });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleItem = async (itemId: string, currentEnabled: boolean) => {
    setSaving(true);
    try {
      if (currentEnabled) {
        await supabase
          .from("vehicle_checklist_items")
          .upsert(
            { vehicle_id: vehicleId, checklist_item_id: itemId, enabled: false },
            { onConflict: "vehicle_id,checklist_item_id" },
          );
      } else {
        const { data: existing } = await supabase
          .from("vehicle_checklist_items")
          .select("id")
          .eq("vehicle_id", vehicleId)
          .eq("checklist_item_id", itemId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("vehicle_checklist_items")
            .update({ enabled: true })
            .eq("id", existing.id);
        }
      }
      qc.invalidateQueries({ queryKey: ["vehicle-checklist", vehicleId, type] });
      toast.success("Updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const enableAll = async () => {
    setSaving(true);
    try {
      if (!items) return;
      const ids = items.map((i) => i.item_id);
      for (const id of ids) {
        await supabase
          .from("vehicle_checklist_items")
          .upsert(
            { vehicle_id: vehicleId, checklist_item_id: id, enabled: true },
            { onConflict: "vehicle_id,checklist_item_id" },
          );
      }
      qc.invalidateQueries({ queryKey: ["vehicle-checklist", vehicleId, type] });
      toast.success("All items enabled");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = items?.filter((i) => i.enabled).length || 0;
  const totalCount = items?.length || 0;

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            Toggle which checklist items to show for this vehicle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{enabledCount}/{totalCount} enabled</Badge>
          <Button variant="outline" size="sm" onClick={enableAll} disabled={saving || enabledCount === totalCount}>
            Enable All
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1">
          {items?.map((item) => (
            <div
              key={item.item_id}
              className={`flex items-center gap-3 rounded-md border p-2.5 transition-opacity ${
                item.enabled ? "" : "opacity-50"
              }`}
            >
              <Checkbox
                checked={item.enabled}
                onCheckedChange={() => toggleItem(item.item_id, item.enabled)}
                disabled={saving}
              />
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.item_order}.</span>
                <span className="text-sm">{item.item_text}</span>
              </div>
              {item.item_key && (
                <Badge variant="secondary" className="text-xs">Built-in</Badge>
              )}
              {item.enabled ? (
                <Badge variant="secondary" className="text-xs">Show</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Hidden</Badge>
              )}
            </div>
          ))}
          {items?.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No items in this checklist. Add items in{" "}
              <a href="/admin/checklists" className="text-primary hover:underline">Checklists</a>.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Manage the master checklist in{" "}
        <a href="/admin/checklists" className="text-primary hover:underline">Checklists</a>
      </p>
    </Card>
  );
}
