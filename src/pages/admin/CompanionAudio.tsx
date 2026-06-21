import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Volume2,
  Plus,
  Trash2,
  GripVertical,
  Loader as Loader2,
  Upload,
  Play,
  Square,
  X,
} from "lucide-react";

const PAGE_KEYS = [
  { key: "driver_login", label: "Login Page" },
  { key: "driver_menu", label: "Main Menu" },
  { key: "driver_select_vehicle", label: "Select Vehicle" },
  { key: "driver_blueprint", label: "Vehicle Blueprint" },
  { key: "driver_pretrip", label: "Pre-Trip Inspection" },
  { key: "driver_return", label: "Return Vehicle Inspection" },
] as const;

type PageKey = (typeof PAGE_KEYS)[number]["key"];

interface AudioIcon {
  id: string;
  page_key: string;
  x_position: number;
  y_position: number;
  audio_path: string;
  label: string | null;
  display_order: number;
}

const COMPANION_AUDIO_BUCKET = "companion-audio";

function getAudioUrl(path: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/${COMPANION_AUDIO_BUCKET}/${path}`;
}

export default function CompanionAudioEditor() {
  const [activePage, setActivePage] = useState<PageKey>("driver_login");
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const [editIcon, setEditIcon] = useState<AudioIcon | null>(null);
  const [listSheetOpen, setListSheetOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companion Audio</h1>
        <p className="text-sm text-muted-foreground">
          Place audio helper icons on workflow pages for drivers
        </p>
      </div>

      <Tabs value={activePage} onValueChange={(v) => setActivePage(v as PageKey)}>
        <TabsList className="flex flex-wrap">
          {PAGE_KEYS.map((p) => (
            <TabsTrigger key={p.key} value={p.key} className="text-xs">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PAGE_KEYS.map((p) => (
          <TabsContent key={p.key} value={p.key} className="mt-4">
            <PageEditor
              pageKey={p.key}
              onOpenList={() => setListSheetOpen(true)}
              onPlaceIcon={(pos) => {
                setPendingPosition(pos);
                setPlacementDialogOpen(true);
              }}
              onEditIcon={setEditIcon}
            />
          </TabsContent>
        ))}
      </Tabs>

      <PlacementDialog
        open={placementDialogOpen}
        onOpenChange={setPlacementDialogOpen}
        pageKey={activePage}
        position={pendingPosition}
        onPlaced={() => {
          setPlacementDialogOpen(false);
          setPendingPosition(null);
        }}
      />

      <EditIconDialog
        icon={editIcon}
        onClose={() => setEditIcon(null)}
      />

      <IconListSheet
        pageKey={activePage}
        open={listSheetOpen}
        onOpenChange={setListSheetOpen}
        onEdit={setEditIcon}
      />
    </div>
  );
}

function PageEditor({
  pageKey,
  onOpenList,
  onPlaceIcon,
  onEditIcon,
}: {
  pageKey: PageKey;
  onOpenList: () => void;
  onPlaceIcon: (pos: { x: number; y: number }) => void;
  onEditIcon: (icon: AudioIcon) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: icons, isLoading } = useQuery<AudioIcon[]>({
    queryKey: ["companion-audio-icons", pageKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_companion_audio_icons", { p_page_key: pageKey });
      if (error) throw error;
      return data || [];
    },
  });

  const updatePosition = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const { error } = await supabase
        .from("companion_audio_icons")
        .update({ x_position: x, y_position: y, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companion-audio-icons", pageKey] }),
  });

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragging) return;
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onPlaceIcon({ x, y });
    },
    [dragging, onPlaceIcon]
  );

  const handleIconDragStart = (id: string) => {
    setDragging(id);
  };

  const handleIconDrag = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    e.currentTarget.style.left = `${x}%`;
    e.currentTarget.style.top = `${y}%`;
  };

  const handleIconDragEnd = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updatePosition.mutate({ id, x, y });
    setDragging(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{icons?.length || 0} icons</Badge>
          <p className="text-xs text-muted-foreground">Click to place, drag to reposition</p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenList}>
          <GripVertical className="mr-1.5 h-3.5 w-3.5" /> Manage List
        </Button>
      </div>

      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative h-[500px] w-full overflow-hidden rounded-lg border-2 border-dashed bg-muted/30 cursor-crosshair"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">Click anywhere to place an audio icon</p>
        </div>

        {icons?.map((icon) => (
          <div
            key={icon.id}
            className={`absolute flex items-center justify-center cursor-grab ${dragging === icon.id ? "cursor-grabbing z-50" : ""}`}
            style={{ left: `${icon.x_position}%`, top: `${icon.y_position}%`, transform: "translate(-50%, -50%)" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleIconDragStart(icon.id);
            }}
            onPointerMove={(e) => {
              if (dragging === icon.id) {
                e.preventDefault();
                handleIconDrag(icon.id, e);
              }
            }}
            onPointerUp={(e) => {
              if (dragging === icon.id) {
                handleIconDragEnd(icon.id, e);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!dragging) onEditIcon(icon);
            }}
          >
            <div className="flex flex-col items-center gap-1 rounded-lg bg-primary p-2 text-primary-foreground shadow-lg">
              <Volume2 className="h-5 w-5" />
              {icon.label && (
                <span className="max-w-20 truncate text-[10px] font-medium">{icon.label}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlacementDialog({
  open,
  onOpenChange,
  pageKey,
  position,
  onPlaced,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pageKey: PageKey;
  position: { x: number; y: number } | null;
  onPlaced: () => void;
}) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const handleUpload = async () => {
    if (!file || !position) return;

    const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an MP3, WAV, or OGG file");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${pageKey}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(COMPANION_AUDIO_BUCKET)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("companion_audio_icons").insert({
        page_key: pageKey,
        x_position: position.x,
        y_position: position.y,
        audio_path: fileName,
        label: label || null,
      });

      if (insertError) throw insertError;

      toast.success("Audio icon placed");
      setLabel("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["companion-audio-icons", pageKey] });
      onPlaced();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Place Audio Icon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {position && (
            <p className="text-xs text-muted-foreground">
              Position: ({position.x.toFixed(1)}%, {position.y.toFixed(1)}%)
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Listen to instructions"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Audio File (MP3, WAV, OGG)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="flex-1"
              />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground">{file.name}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Place Icon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditIconDialog({
  icon,
  onClose,
}: {
  icon: AudioIcon | null;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);

  useState(() => {
    if (icon) setLabel(icon.label || "");
  });

  const handleSave = async () => {
    if (!icon) return;
    setSaving(true);
    try {
      if (file) {
        const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"];
        if (!validTypes.includes(file.type)) {
          toast.error("Please upload an MP3, WAV, or OGG file");
          setSaving(false);
          return;
        }
        const fileExt = file.name.split(".").pop();
        const fileName = `${icon.page_key}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(COMPANION_AUDIO_BUCKET)
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        await supabase.storage.from(COMPANION_AUDIO_BUCKET).remove([icon.audio_path]);
        const { error: updateError } = await supabase
          .from("companion_audio_icons")
          .update({ label: label || null, audio_path: fileName, updated_at: new Date().toISOString() })
          .eq("id", icon.id);
        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from("companion_audio_icons")
          .update({ label: label || null, updated_at: new Date().toISOString() })
          .eq("id", icon.id);
        if (updateError) throw updateError;
      }
      toast.success("Icon updated");
      qc.invalidateQueries({ queryKey: ["companion-audio-icons", icon.page_key] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!icon) return;
    setSaving(true);
    try {
      await supabase.storage.from(COMPANION_AUDIO_BUCKET).remove([icon.audio_path]);
      const { error } = await supabase.from("companion_audio_icons").delete().eq("id", icon.id);
      if (error) throw error;
      toast.success("Icon deleted");
      qc.invalidateQueries({ queryKey: ["companion-audio-icons", icon.page_key] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  if (!icon) return null;

  return (
    <Dialog open={!!icon} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Audio Icon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Position: ({Number(icon.x_position).toFixed(1)}%, {Number(icon.y_position).toFixed(1)}%)
          </p>
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Listen to instructions"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Current Audio</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={togglePlay}>
                {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <audio
                ref={audioRef}
                src={getAudioUrl(icon.audio_path)}
                onEnded={() => setPlaying(false)}
              />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {icon.audio_path.split("/").pop()}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Replace Audio (optional)</Label>
            <Input
              type="file"
              accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconListSheet({
  pageKey,
  open,
  onOpenChange,
  onEdit,
}: {
  pageKey: PageKey;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (icon: AudioIcon) => void;
}) {
  const qc = useQueryClient();

  const { data: icons, isLoading } = useQuery<AudioIcon[]>({
    queryKey: ["companion-audio-icons", pageKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_companion_audio_icons", { p_page_key: pageKey });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteIcon = useMutation({
    mutationFn: async (icon: AudioIcon) => {
      await supabase.storage.from(COMPANION_AUDIO_BUCKET).remove([icon.audio_path]);
      const { error } = await supabase.from("companion_audio_icons").delete().eq("id", icon.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companion-audio-icons", pageKey] });
      toast.success("Icon deleted");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const reorder = useMutation({
    mutationFn: async (newOrder: AudioIcon[]) => {
      for (const [idx, icon] of newOrder.entries()) {
        const { error } = await supabase
          .from("companion_audio_icons")
          .update({ display_order: idx })
          .eq("id", icon.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companion-audio-icons", pageKey] }),
  });

  const moveUp = (idx: number) => {
    if (!icons || idx === 0) return;
    const newIcons = [...icons];
    [newIcons[idx - 1], newIcons[idx]] = [newIcons[idx], newIcons[idx - 1]];
    reorder.mutate(newIcons);
  };

  const moveDown = (idx: number) => {
    if (!icons || idx === icons.length - 1) return;
    const newIcons = [...icons];
    [newIcons[idx], newIcons[idx + 1]] = [newIcons[idx + 1], newIcons[idx]];
    reorder.mutate(newIcons);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Manage Audio Icons</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !icons?.length ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No audio icons yet. Click on the canvas to place one.
            </p>
          ) : (
            <div className="space-y-2 pr-4">
              {icons.map((icon, idx) => (
                <div
                  key={icon.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2"
                >
                  <div className="flex flex-col">
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveDown(idx)}
                      disabled={idx === icons.length - 1}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {icon.label || "Audio Icon"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ({Number(icon.x_position).toFixed(0)}%, {Number(icon.y_position).toFixed(0)}%)
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(icon)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteIcon.mutate(icon)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
