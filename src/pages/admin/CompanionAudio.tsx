import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { uploadPhotoAt, getPublicUrl } from "@/lib/storage";
import { toast } from "sonner";
import { Headphones, Upload, Play, Trash2, Loader as Loader2, Check } from "lucide-react";

interface PageAudioRow {
  id: string;
  page_key: string;
  label: string;
  audio_path: string | null;
  updated_at: string;
}

const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/mp3"];

export default function AdminCompanionAudio() {
  const qc = useQueryClient();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: pages, isLoading } = useQuery<PageAudioRow[]>({
    queryKey: ["companion-page-audio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_page_audio")
        .select("*")
        .order("page_key");
      if (error) throw error;
      return data || [];
    },
  });

  const updateAudioPath = useMutation({
    mutationFn: async ({ pageKey, audioPath }: { pageKey: string; audioPath: string | null }) => {
      const { error } = await supabase
        .from("companion_page_audio")
        .update({ audio_path: audioPath, updated_at: new Date().toISOString() })
        .eq("page_key", pageKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companion-page-audio"] });
      toast.success("Audio updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(pageKey: string, file: File) {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(mp3|ogg|wav|m4a)$/i)) {
      toast.error("Please upload an audio file (MP3, OGG, WAV, or M4A)");
      return;
    }
    setUploadingKey(pageKey);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `pages/${pageKey}.${ext}`;
      await uploadPhotoAt("companion-audio", file, path, true);
      updateAudioPath.mutate({ pageKey, audioPath: path });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleDelete(pageKey: string) {
    const page = pages?.find((p) => p.page_key === pageKey);
    if (!page?.audio_path) return;
    setUploadingKey(pageKey);
    try {
      await supabase.storage.from("companion-audio").remove([page.audio_path]);
      updateAudioPath.mutate({ pageKey, audioPath: null });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingKey(null);
    }
  }

  function handlePlay(pageKey: string, audioPath: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingKey === pageKey) {
      setPlayingKey(null);
      return;
    }
    const audio = new Audio(getPublicUrl("companion-audio", audioPath));
    audioRef.current = audio;
    setPlayingKey(pageKey);
    audio.play().catch(() => toast.error("Could not play audio"));
    audio.onended = () => setPlayingKey(null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companion Audio</h1>
        <p className="text-sm text-muted-foreground">
          Upload audio instructions for each driver-facing page. When Companion Mode is enabled, these audio clips will play automatically to guide drivers through the app.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {pages?.map((page) => (
          <Card key={page.page_key} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">{page.label}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Key: <code className="rounded bg-muted px-1 py-0.5">{page.page_key}</code>
                </p>
                {page.audio_path && (
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Audio uploaded
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {page.audio_path && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlay(page.page_key, page.audio_path!)}
                      disabled={uploadingKey === page.page_key}
                    >
                      {playingKey === page.page_key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(page.page_key)}
                      disabled={uploadingKey === page.page_key}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
                <label>
                  <Button
                    variant={page.audio_path ? "secondary" : "default"}
                    size="sm"
                    asChild
                    disabled={uploadingKey === page.page_key}
                  >
                    <span className="cursor-pointer">
                      {uploadingKey === page.page_key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span className="ml-2">{page.audio_path ? "Replace" : "Upload"}</span>
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.ogg,.wav,.m4a"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(page.page_key, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
