import { useEffect, useRef, useState } from "react";
import { Volume2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCompanionMode } from "@/lib/auth/driverAuth";
import { getPublicUrl } from "@/lib/storage";

interface CompanionAudioPlayerProps {
  audioPath: string | null | undefined;
  autoPlay?: boolean;
  ignoreCompanionMode?: boolean;
}

export function CompanionAudioPlayer({ audioPath, autoPlay = true, ignoreCompanionMode = false }: CompanionAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const shouldPlay = ignoreCompanionMode || isCompanionMode();

  useEffect(() => {
    if (!audioPath || !autoPlay || !shouldPlay) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => {});
  }, [audioPath, autoPlay, shouldPlay]);

  if (!audioPath || !shouldPlay) return null;

  const audioUrl = getPublicUrl("companion-audio", audioPath);

  const handleReplay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 bg-emerald-600 px-4 py-3 text-white shadow-md">
      <Volume2 className="h-6 w-6" />
      <span className="text-sm font-medium">Audio Guide Active</span>
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setPlaying(true)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={handleReplay}
        className="ml-auto gap-2 bg-white/20 hover:bg-white/30"
      >
        <RotateCcw className="h-4 w-4" />
        Replay
      </Button>
    </div>
  );
}
