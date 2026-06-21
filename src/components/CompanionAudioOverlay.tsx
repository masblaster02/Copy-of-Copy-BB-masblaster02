import { useState, useRef, useEffect } from "react";
import { Volume2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCompanionAudioIcons, useCompanionAudioAccess, getAudioFileUrl } from "@/hooks/useCompanionAudio";
import { getDriverSession } from "@/lib/auth/driverAuth";
import { toast } from "sonner";

interface CompanionAudioOverlayProps {
  pageKey: string;
}

export function CompanionAudioOverlay({ pageKey }: CompanionAudioOverlayProps) {
  const driver = getDriverSession();
  const { data: hasAccess, isLoading: accessLoading } = useCompanionAudioAccess(driver?.driver_id ?? null);
  const { data: icons, isLoading: iconsLoading, error } = useCompanionAudioIcons(pageKey);

  if (error) {
    console.error("Error loading companion audio icons:", error);
    return null;
  }

  if (accessLoading || iconsLoading || !hasAccess || !icons?.length) return null;

  return (
    <TooltipProvider>
      {icons.map((icon) => (
        <AudioIconMarker key={icon.id} icon={icon} />
      ))}
    </TooltipProvider>
  );
}

function AudioIconMarker({ icon }: { icon: { id: string; x_position: number; y_position: number; audio_path: string; label: string | null } }) {
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioUrl = getAudioFileUrl(icon.audio_path);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAudioError(false);

    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error("Audio playback failed:", err);
        setAudioError(true);
        toast.error("Audio playback failed");
      });
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setPlaying(false);
    const handleError = () => {
      setPlaying(false);
      setAudioError(true);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <>
      <div
        className="absolute z-30 pointer-events-auto"
        style={{
          left: `${icon.x_position}%`,
          top: `${icon.y_position}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className={`h-10 w-10 rounded-full shadow-lg ${
                playing ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90"
              } ${audioError ? "animate-pulse border-2 border-destructive" : ""}`}
              onClick={togglePlay}
            >
              {playing ? (
                <Square className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{icon.label || "Play audio guide"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
    </>
  );
}

export function InlineAudioButton({ audioPath, label }: { audioPath: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioUrl = getAudioFileUrl(audioPath);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error("Audio playback failed:", err);
        toast.error("Audio playback failed");
      });
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setPlaying(false);
    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${playing ? "text-green-600" : "text-muted-foreground"}`}
            onClick={togglePlay}
          >
            {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{playing ? "Stop" : label || "Play audio"}</p>
        </TooltipContent>
      </Tooltip>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
    </TooltipProvider>
  );
}
