import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BlueprintView = "front" | "rear" | "left" | "right" | "roof" | "interior";

export interface BlueprintMarker {
  id?: string;
  x: number;
  y: number;
  view: BlueprintView;
  color?: string;
  label?: string;
  source?: "baseline" | "driver";
}

const VIEWS: BlueprintView[] = ["front", "rear", "left", "right", "roof", "interior"];

export function VehicleBlueprint({
  markers,
  onAdd,
  onMarkerClick,
  readOnly,
  view: controlledView,
  onViewChange,
  blueprintImages,
}: {
  markers: BlueprintMarker[];
  onAdd?: (m: { x: number; y: number; view: BlueprintView }) => void;
  onMarkerClick?: (m: BlueprintMarker) => void;
  readOnly?: boolean;
  view?: BlueprintView;
  onViewChange?: (v: BlueprintView) => void;
  blueprintImages?: Partial<Record<BlueprintView, string>>;
}) {
  const [internalView, setInternalView] = useState<BlueprintView>("front");
  const view = controlledView ?? internalView;
  const setView = (v: BlueprintView) => {
    onViewChange?.(v);
    if (controlledView === undefined) setInternalView(v);
  };

  // Preload all blueprint images so tab switches are instant
  useEffect(() => {
    if (!blueprintImages) return;
    Object.values(blueprintImages).forEach((url) => {
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [blueprintImages]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !onAdd) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAdd({ x, y, view });
  }

  const viewMarkers = markers.filter((m) => m.view === view);
  const imgUrl = blueprintImages?.[view];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "outline"}
            onClick={() => setView(v)}
            className="capitalize"
          >
            {v}
          </Button>
        ))}
      </div>
      <div
        onClick={handleClick}
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted/40",
          !readOnly && onAdd && "cursor-crosshair",
        )}
      >
        {/* Hidden prerender for all blueprint images so switching views is instant */}
        {blueprintImages &&
          VIEWS.filter((v) => v !== view && blueprintImages[v]).map((v) => (
            <img
              key={v}
              src={blueprintImages[v]}
              alt=""
              className="pointer-events-none invisible absolute inset-0 h-0 w-0"
              aria-hidden="true"
              draggable={false}
            />
          ))}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${view} blueprint`}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        ) : (          <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
            {view === "front" && (
              <>
                <rect x="80" y="40" width="240" height="220" rx="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <rect x="100" y="55" width="200" height="70" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
                <circle cx="120" cy="160" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40" />
                <circle cx="280" cy="160" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40" />
                <rect x="160" y="150" width="80" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40" />
              </>
            )}
            {view === "rear" && (
              <>
                <rect x="80" y="40" width="240" height="220" rx="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <rect x="100" y="55" width="200" height="60" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
                <circle cx="120" cy="155" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40" />
                <circle cx="280" cy="155" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40" />
                <rect x="150" y="180" width="100" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40" />
              </>
            )}
            {view === "left" && (
              <>
                <path d="M 60 200 L 60 100 Q 60 60 100 50 L 200 45 Q 240 42 280 60 L 340 80 Q 350 85 350 100 L 350 200 Q 350 230 320 240 L 90 240 Q 60 240 60 200 Z" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <line x1="200" y1="50" x2="200" y2="235" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/20" />
                <rect x="80" y="80" width="100" height="60" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
                <circle cx="110" cy="225" r="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" />
                <circle cx="300" cy="225" r="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" />
              </>
            )}
            {view === "right" && (
              <>
                <path d="M 340 200 L 340 100 Q 340 60 300 50 L 200 45 Q 160 42 120 60 L 60 80 Q 50 85 50 100 L 50 200 Q 50 230 80 240 L 310 240 Q 340 240 340 200 Z" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <line x1="200" y1="50" x2="200" y2="235" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/20" />
                <rect x="220" y="80" width="100" height="60" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
                <circle cx="100" cy="225" r="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" />
                <circle cx="290" cy="225" r="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" />
              </>
            )}
            {view === "roof" && (
              <>
                <rect x="60" y="60" width="280" height="180" rx="20" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <rect x="100" y="80" width="200" height="80" rx="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
                <line x1="60" y1="180" x2="340" y2="180" stroke="currentColor" strokeWidth="1" strokeDasharray="8 4" className="text-muted-foreground/20" />
              </>
            )}
            {view === "interior" && (
              <>
                <rect x="40" y="30" width="320" height="240" rx="12" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <circle cx="200" cy="100" r="35" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" />
                <rect x="60" y="160" width="280" height="30" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
                <circle cx="80" cy="175" r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30" />
                <circle cx="320" cy="175" r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30" />
                <rect x="100" y="200" width="200" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
              </>
            )}
            <text x="200" y="280" textAnchor="middle" className="fill-muted-foreground/60 text-xs uppercase tracking-widest">
              {view}
            </text>
          </svg>
        )}
        {viewMarkers.map((m, i) => (
          <button
            type="button"
            key={m.id ?? `${i}-${m.x}-${m.y}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            onClick={(e) => {
              if (!onMarkerClick) return;
              e.stopPropagation();
              onMarkerClick(m);
            }}
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow ring-2 ring-background",
                onMarkerClick && "transition-transform hover:scale-110",
              )}
              style={{
                background:
                  m.color ?? (m.source === "baseline" ? "hsl(220 80% 55%)" : "hsl(0 80% 50%)"),
              }}
            >
              {m.label ?? (m.source === "baseline" ? "B" : "!")}
            </div>
          </button>
        ))}
      </div>
      {!readOnly && onAdd && (
        <p className="text-xs text-muted-foreground">Tap the blueprint to drop a damage marker.</p>
      )}
    </div>
  );
}
