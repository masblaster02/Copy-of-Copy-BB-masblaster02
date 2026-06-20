import { useState, useEffect, useRef } from "react";
import { CHECKLIST_ITEMS } from "@/lib/checklist";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Check, X, Camera, Loader as Loader2, Eye, Volume2 } from "lucide-react";
import { isCompanionMode } from "@/lib/auth/driverAuth";
import { getPublicUrl } from "@/lib/storage";

export interface ChecklistItemDef {
  id: string;
  item_text: string;
  item_order: number;
  is_active: boolean;
  item_key?: string | null;
  audio_path?: string | null;
}

export interface ChecklistResult {
  item_name: string;
  result: "pass" | "issue";
  notes: string;
  photo?: File;
  reviewed: boolean;
}

export function InspectionChecklist({
  onSubmit,
  submitLabel = "Submit inspection",
  submitting,
  items: externalItems,
  loading,
}: {
  onSubmit: (results: ChecklistResult[]) => void;
  submitLabel?: string;
  submitting?: boolean;
  items?: ChecklistItemDef[] | null;
  loading?: boolean;
}) {
  const [results, setResults] = useState<ChecklistResult[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Initialize results when items change
  useEffect(() => {
    const itemsToUse = externalItems?.filter((i) => i.is_active) ?? [];
    if (itemsToUse.length > 0) {
      setResults(
        itemsToUse.map((i) => ({ item_name: i.item_text, result: "pass", notes: "", reviewed: false })),
      );
    } else if (!externalItems) {
      setResults(
        CHECKLIST_ITEMS.map((i) => ({ item_name: i, result: "pass", notes: "", reviewed: false })),
      );
    }
  }, [externalItems]);

  const reviewedCount = results.filter((r) => r.reviewed).length;
  const allReviewed = reviewedCount === results.length;

  function update(idx: number, patch: Partial<ChecklistResult>) {
    setResults((r) => r.map((x, i) => (i === idx ? { ...x, ...patch, reviewed: true } : x)));
  }

  function playItemAudio(item: ChecklistItemDef) {
    if (!item.audio_path || !isCompanionMode()) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(getPublicUrl("companion-audio", item.audio_path));
    audioRef.current = audio;
    setPlayingAudio(item.id);
    audio.play().catch(() => {});
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => setPlayingAudio(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!allReviewed && results.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">
            Inspect each item ({reviewedCount}/{results.length} checked)
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {results.map((r, i) => (
              <span
                key={r.item_name}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  r.reviewed
                    ? "bg-green-600/20 text-green-800 dark:text-green-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {r.reviewed && <Eye className="h-3 w-3" />}
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {results.map((r, i) => {
        const item = externalItems?.find((it) => it.item_text === r.item_name);
        const hasAudio = item?.audio_path && isCompanionMode();
        return (
          <Card key={r.item_name} className={r.reviewed ? (r.result === "pass" ? "border-green-600/30" : "border-amber-500/30") : ""}>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.item_name}</span>
                {hasAudio && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 ${playingAudio === item.id ? "text-primary animate-pulse" : "text-muted-foreground"}`}
                    onClick={() => playItemAudio(item)}
                    aria-label="Play instruction"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={r.result === "pass" && r.reviewed ? "default" : "outline"}
                  className={r.result === "pass" && r.reviewed ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => {
                    update(i, { result: "pass" });
                    if (hasAudio) playItemAudio(item);
                  }}
                >
                  <Check className="mr-1 h-4 w-4" /> Pass
                </Button>
                <Button
                  size="sm"
                  variant={r.result === "issue" && r.reviewed ? "default" : "outline"}
                  className={r.result === "issue" && r.reviewed ? "bg-destructive hover:bg-destructive/90" : ""}
                  onClick={() => {
                    update(i, { result: "issue" });
                    if (hasAudio) playItemAudio(item);
                  }}
                >
                  <X className="mr-1 h-4 w-4" /> Issue
                </Button>
              </div>
            </div>
          {r.result === "issue" && r.reviewed && (
            <div className="border-t p-4 space-y-2">
              <Textarea
                placeholder="Describe the issue…"
                value={r.notes}
                onChange={(e) => update(i, { notes: e.target.value })}
                rows={2}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                <Camera className="h-4 w-4" />
                {r.photo ? r.photo.name : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => update(i, { photo: e.target.files?.[0] })}
                />
              </label>
            </div>
          )}
        </Card>
        );
      })}
      <Button className="h-12 w-full" onClick={() => onSubmit(results)} disabled={submitting || !allReviewed}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </div>
  );
}
