import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { uploadPhotoAt, getPublicUrl } from "@/lib/storage";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Loader as Loader2, Check, X, Volume2, Upload, Play } from "lucide-react";

type ChecklistType = "pre_trip" | "return";

interface ChecklistItem {
  id: string;
  item_text: string;
  item_order: number;
  is_active: boolean;
  checklist_type: ChecklistType;
  item_key: string | null;
  audio_path: string | null;
}

export default function AdminChecklists() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checklists</h1>
        <p className="text-sm text-muted-foreground">
          Manage the master checklists used for vehicle inspections
        </p>
      </div>

      <Tabs defaultValue="pre_trip">
        <TabsList>
          <TabsTrigger value="pre_trip">Pre-Trip</TabsTrigger>
          <TabsTrigger value="return">Return</TabsTrigger>
        </TabsList>
        <TabsContent value="pre_trip" className="mt-4">
          <ChecklistEditor type="pre_trip" />
        </TabsContent>
        <TabsContent value="return" className="mt-4">
          <ChecklistEditor type="return" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistEditor({ type }: { type: ChecklistType }) {
  const qc = useQueryClient();
  const [newItemText, setNewItemText] = useState("");

  const queryKey = ["checklist-items", type];

  const { data: items, isLoading } = useQuery<ChecklistItem[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("id, item_text, item_order, is_active, checklist_type, item_key, audio_path")
        .eq("checklist_type", type)
        .order("item_order");
      if (error) throw error;
      return data || [];
    },
  });

  const addItem = useMutation({
    mutationFn: async (text: string) => {
      const maxOrder = items?.reduce((max, i) => Math.max(max, i.item_order), 0) || 0;
      const { error } = await supabase.from("checklist_items").insert({
        item_text: text,
        item_order: maxOrder + 1,
        checklist_type: type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setNewItemText("");
      toast.success("Item added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["vehicle-checklist"] });
      toast.success("Item removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Item updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateText = useMutation({
    mutationFn: async ({ id, item_text }: { id: string; item_text: string }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ item_text })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Item updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderItems = useMutation({
    mutationFn: async (newItems: ChecklistItem[]) => {
      for (const [idx, item] of newItems.entries()) {
        const { error } = await supabase
          .from("checklist_items")
          .update({ item_order: idx + 1 })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const updateAudioPath = useMutation({
    mutationFn: async ({ id, audioPath }: { id: string; audioPath: string | null }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ audio_path: audioPath })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["vehicle-checklist"] });
      toast.success("Audio updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function moveItem(fromIndex: number, toIndex: number) {
    if (!items) return;
    const newItems = [...items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    reorderItems.mutate(newItems);
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && newItemText.trim()) {
      addItem.mutate(newItemText.trim());
    }
  }

  const activeItems = items?.filter((i) => i.is_active) || [];
  const inactiveItems = items?.filter((i) => !i.is_active) || [];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium">Checklist Items</p>
          <Badge variant="outline">{activeItems.length} active</Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {activeItems.map((item, idx) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                onToggleActive={() => toggleActive.mutate({ id: item.id, is_active: false })}
                onDelete={() => deleteItem.mutate(item.id)}
                onUpdateText={(text) => updateText.mutate({ id: item.id, item_text: text })}
                onMoveUp={() => idx > 0 && moveItem(idx, idx - 1)}
                onMoveDown={() => idx < activeItems.length - 1 && moveItem(idx, idx + 1)}
                onUpdateAudio={(audioPath) => updateAudioPath.mutate({ id: item.id, audioPath })}
                showControls
              />
            ))}
            {activeItems.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No items yet. Add one below.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Add new checklist item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            onClick={() => newItemText.trim() && addItem.mutate(newItemText.trim())}
            disabled={!newItemText.trim() || addItem.isPending}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </Card>

      {inactiveItems.length > 0 && (
        <Card className="p-4 opacity-70">
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground">Inactive Items</p>
            <p className="text-xs text-muted-foreground">
              These items won&apos;t appear in checklists
            </p>
          </div>
          <div className="space-y-2">
            {inactiveItems.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                onToggleActive={() => toggleActive.mutate({ id: item.id, is_active: true })}
                onDelete={() => deleteItem.mutate(item.id)}
                onUpdateText={(text) => updateText.mutate({ id: item.id, item_text: text })}
                onUpdateAudio={(audioPath) => updateAudioPath.mutate({ id: item.id, audioPath })}
                showControls={false}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ChecklistItemRow({
  item,
  onToggleActive,
  onDelete,
  onUpdateText,
  onUpdateAudio,
  onMoveUp,
  onMoveDown,
  showControls,
}: {
  item: ChecklistItem;
  onToggleActive: () => void;
  onDelete: () => void;
  onUpdateText: (text: string) => void;
  onUpdateAudio: (audioPath: string | null) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showControls: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.item_text);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function saveEdit() {
    if (editText.trim() && editText !== item.item_text) {
      onUpdateText(editText.trim());
    }
    setEditing(false);
  }

  async function handleAudioUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `checklists/${item.id}.${ext}`;
      await uploadPhotoAt("companion-audio", file, path, true);
      onUpdateAudio(path);
      setAudioDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handlePlayAudio() {
    if (!item.audio_path) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    const audio = new Audio(getPublicUrl("companion-audio", item.audio_path));
    audioRef.current = audio;
    setPlaying(true);
    audio.play().catch(() => toast.error("Could not play audio"));
    audio.onended = () => setPlaying(false);
  }

  async function handleDeleteAudio() {
    if (!item.audio_path) return;
    try {
      await supabase.storage.from("companion-audio").remove([item.audio_path]);
      onUpdateAudio(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
        {showControls && (
          <div className="flex flex-col">
            <button className="text-muted-foreground hover:text-foreground" onClick={onMoveUp}>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button className="text-muted-foreground hover:text-foreground" onClick={onMoveDown}>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-1 items-center gap-2">
          <span className="text-xs text-muted-foreground">{item.item_order}.</span>
          {editing && !item.item_key ? (
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") {
                  setEditText(item.item_text);
                  setEditing(false);
                }
              }}
              className="h-8 flex-1 text-sm"
              autoFocus
            />
          ) : (
            <span
              className={`flex-1 text-sm ${item.item_key ? "text-muted-foreground" : "cursor-pointer hover:text-primary"}`}
              onClick={() => !item.item_key && setEditing(true)}
            >
              {item.item_text}
            </span>
          )}
        </div>
        {item.audio_path && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handlePlayAudio}
            title="Play audio"
          >
            <Play className={`h-4 w-4 ${playing ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setAudioDialogOpen(true)}
          title={item.audio_path ? "Manage audio" : "Add audio"}
        >
          <Volume2 className={`h-4 w-4 ${item.audio_path ? "text-primary" : "text-muted-foreground/50"}`} />
        </Button>
        {item.item_key && (
          <Badge variant="secondary" className="shrink-0 text-xs">Built-in</Badge>
        )}
        {!item.item_key && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggleActive}>
            {item.is_active ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
        {!item.item_key && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <Dialog open={audioDialogOpen} onOpenChange={setAudioDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Audio for &quot;{item.item_text}&quot;</DialogTitle>
            <DialogDescription>
              Upload an audio instruction to play when a driver in Companion Mode reaches this checklist item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {item.audio_path && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">Audio uploaded</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePlayAudio}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeleteAudio}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
            <label className="block">
              <Button asChild disabled={uploading} className="w-full">
                <span className="cursor-pointer">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="ml-2">{item.audio_path ? "Replace Audio" : "Upload Audio"}</span>
                </span>
              </Button>
              <input
                type="file"
                accept="audio/*,.mp3,.ogg,.wav,.m4a"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAudioUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
