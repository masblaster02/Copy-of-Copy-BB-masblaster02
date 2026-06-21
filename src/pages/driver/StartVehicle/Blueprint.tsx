import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { DriverShell } from "@/components/layout/DriverShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VehicleBlueprint,
  type BlueprintMarker,
  type BlueprintView,
} from "@/components/VehicleBlueprint";
import { supabase } from "@/lib/supabase";
import { uploadPhoto, getPublicUrl, getDamagePhotoUrl } from "@/lib/storage";
import { getDriverSession } from "@/lib/auth/driverAuth";
import { toast } from "sonner";
import { Camera, Loader as Loader2, CircleAlert as AlertCircle, Eye } from "lucide-react";

const ALL_VIEWS: BlueprintView[] = ["front", "rear", "left", "right", "roof", "interior"];

const DAMAGE_TYPES = ["scratch", "dent", "crack", "paint", "missing_part", "other"];
const BASE_BUCKET = "vehicle-base-photos";
const DAMAGE_BUCKET = "damage-photos";
const BLUEPRINT_BUCKET = "vehicle-blueprints";

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
  reported_during: string | null;
}

export default function DriverStartBlueprint() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const driver = getDriverSession()!;
  const qc = useQueryClient();

  const [view, setView] = useState<BlueprintView>("front");
  const [visited, setVisited] = useState<Set<BlueprintView>>(new Set(["front"]));
  const [newMarkerIds, setNewMarkerIds] = useState<string[]>([]);
  const [openMarker, setOpenMarker] = useState<MarkerRow | null>(null);
  const [reportCoord, setReportCoord] = useState<{
    x: number;
    y: number;
    view: BlueprintView;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-vehicle-blueprint", vehicleId],
    queryFn: async () => {
      const [v, m, p, links, bp, dp] = await Promise.all([
        supabase
          .from("vehicles")
          .select("registration_number, make, model")
          .eq("id", vehicleId)
          .single(),
        supabase
          .from("damage_markers")
          .select(
            "id, x_coordinate, y_coordinate, view, status, source, damage_type, description, approved, reported_during",
          )
          .eq("vehicle_id", vehicleId)
          .in("status", ["open", "in_review"]),
        supabase
          .from("vehicle_base_photos")
          .select("id, photo_url, view, label")
          .eq("vehicle_id", vehicleId),
        supabase.from("damage_marker_base_photos").select("damage_marker_id, base_photo_id"),
        supabase
          .from("vehicle_blueprints")
          .select("view, blueprint_image")
          .eq("vehicle_id", vehicleId),
        // RLS already filters out non-approved rows for anon
        supabase
          .from("damage_marker_photos")
          .select("id, damage_marker_id, photo_url"),
      ]);
      if (v.error) throw v.error;
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (links.error) throw links.error;
      if (bp.error) throw bp.error;
      if (dp.error) throw dp.error;
      return {
        vehicle: v.data,
        markers: m.data as MarkerRow[],
        basePhotos: p.data,
        links: links.data,
        blueprints: bp.data as { view: BlueprintView | null; blueprint_image: string }[],
        damagePhotos: dp.data as { id: string; damage_marker_id: string; photo_url: string }[],
      };
    },
  });

  const blueprintImages: Partial<Record<BlueprintView, string>> = {};
  for (const b of data?.blueprints ?? []) {
    if (b.view) blueprintImages[b.view] = getPublicUrl(BLUEPRINT_BUCKET, b.blueprint_image);
  }

  const markers: BlueprintMarker[] =
    data?.markers.map((m) => ({
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
            : "hsl(0 80% 50%)",
    })) ?? [];

  const linkedPhotosFor = (markerId: string) => {
    const ids = (data?.links ?? [])
      .filter((l) => l.damage_marker_id === markerId)
      .map((l) => l.base_photo_id);
    return (data?.basePhotos ?? []).filter((p) => ids.includes(p.id));
  };

  return (
    <DriverShell title="Vehicle blueprint" back="/driver/start" steps={{ steps: ["Select", "Inspect", "Pre-trip"], current: 2 }}>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-lg font-semibold">{data?.vehicle.registration_number}</p>
            <p className="text-sm text-muted-foreground">
              {data?.vehicle.make} {data?.vehicle.model}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <VehicleBlueprint
              blueprintImages={blueprintImages}
              markers={markers}
              view={view}
              onViewChange={(v) => { setView(v); setVisited((prev) => new Set(prev).add(v)); }}
              onAdd={(c) => setReportCoord(c)}
              onMarkerClick={(m) => {
                const row = data?.markers.find((x) => x.id === m.id);
                if (row) setOpenMarker(row);
              }}
            />
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Legend color="hsl(220 80% 55%)" label="Known (tap to view)" />
              <Legend color="hsl(0 80% 50%)" label="Reported damage" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap any marker to see existing damage photos. Tap an empty area on the blueprint
              to report new damage.
            </p>
          </div>

          {visited.size < ALL_VIEWS.length && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-medium">
                Review all views before continuing ({visited.size}/{ALL_VIEWS.length} viewed)
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ALL_VIEWS.map((v) => (
                  <span
                    key={v}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs capitalize ${
                      visited.has(v)
                        ? "bg-green-600/20 text-green-800 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {visited.has(v) && <Eye className="h-3 w-3" />}
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button
            className="h-12 w-full"
            disabled={visited.size < ALL_VIEWS.length}
            onClick={() => navigate(`/driver/start/${vehicleId}/pretrip`, { state: { newMarkerIds, reportedDamageCount: newMarkerIds.length } })}
          >
            Continue to pre-trip
          </Button>
        </div>
      )}

      {/* ----- Existing marker sheet ----- */}
      <Sheet open={!!openMarker} onOpenChange={(o) => !o && setOpenMarker(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          {openMarker && (
            <>
              <SheetHeader>
                <SheetTitle className="capitalize">
                  {openMarker.source === "baseline" ? "Known damage" : "Previously reported"} —{" "}
                  {openMarker.damage_type.replace("_", " ")}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4">
                {openMarker.description && (
                  <p className="text-sm">{openMarker.description}</p>
                )}
                {openMarker.source === "driver" && !openMarker.approved && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                    This report is awaiting admin approval. Photos will be visible
                    once it has been reviewed.
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
                            <a
                              key={p.id}
                              href={getPublicUrl(BASE_BUCKET, p.photo_url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={getPublicUrl(BASE_BUCKET, p.photo_url)}
                                alt=""
                                className="aspect-square w-full rounded-md object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No reference photos linked to this damage.
                      </p>
                    );
                  }
                  // driver-source marker — show approved damage photos via signed URLs
                  const photos = (data?.damagePhotos ?? []).filter(
                    (p) => p.damage_marker_id === openMarker.id,
                  );
                  if (!openMarker.approved) return null;
                  return photos.length ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Damage photos</p>
                      <div className="grid grid-cols-2 gap-2">
                        {photos.map((p) => (
                          <DamagePhotoImg key={p.id} path={p.photo_url} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No approved photos yet for this report.
                    </p>
                  );
                })()}


                <div className="rounded-md border border-dashed p-3">
                  <p className="flex items-start gap-2 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    Is the damage worse than the photos, or is there new damage near this spot?
                    Report it so it's recorded against your trip.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => {
                      setReportCoord({
                        x: Number(openMarker.x_coordinate),
                        y: Number(openMarker.y_coordinate),
                        view: openMarker.view,
                      });
                      setOpenMarker(null);
                    }}
                  >
                    Report new damage here
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ----- Report new damage sheet ----- */}
      <ReportDamageSheet
        coord={reportCoord}
        vehicleId={vehicleId!}
        driverId={driver.driver_id}
        onClose={() => setReportCoord(null)}
        onSaved={(id) => {
          setReportCoord(null);
          setNewMarkerIds((ids) => [...ids, id]);
          qc.invalidateQueries({ queryKey: ["driver-vehicle-blueprint", vehicleId] });
          toast.success("Damage reported");
        }}
      />
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

/* ============================================================
   Report new damage (≥2 photos)
============================================================ */
function ReportDamageSheet({
  coord,
  vehicleId,
  driverId,
  onClose,
  onSaved,
}: {
  coord: { x: number; y: number; view: BlueprintView } | null;
  vehicleId: string;
  driverId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [damageType, setDamageType] = useState("scratch");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setDamageType("scratch");
    setDescription("");
    setPhotos([]);
  }

  async function save() {
    if (!coord) return;
    if (photos.length < 2) {
      toast.error("At least 2 photos are required.");
      return;
    }
    setSaving(true);
    try {
      const { data: mr, error } = await supabase
        .from("damage_markers")
        .insert({
          vehicle_id: vehicleId,
          driver_id: driverId,
          reported_during: "pre_trip",
          damage_type: damageType,
          description: description || null,
          status: "open",
          source: "driver",
          x_coordinate: coord.x,
          y_coordinate: coord.y,
          view: coord.view,
        })
        .select("id")
        .single();
      if (error) throw error;
      for (const f of photos) {
        const path = await uploadPhoto(DAMAGE_BUCKET, f, `${mr.id}`);
        const { error: pErr } = await supabase
          .from("damage_marker_photos")
          .insert({ damage_marker_id: mr.id, photo_url: path });
        if (pErr) throw pErr;
      }
      reset();
      onSaved(mr.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={!!coord}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report new damage</SheetTitle>
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
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">
              Photos ({photos.length}/2)
            </Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((f, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded bg-background/90 px-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < 2 && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  <Camera className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPhotos((p) => [...p, f]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {photos.length < 2 && (
              <p className="mt-1 text-xs text-destructive">
                {2 - photos.length} more photo(s) required
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
