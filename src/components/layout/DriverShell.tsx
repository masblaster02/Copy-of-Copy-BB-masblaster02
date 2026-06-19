import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StepConfig {
  steps: string[];
  current: number; // 1-based
}

export function DriverShell({
  title,
  back,
  children,
  action,
  steps,
}: {
  title: string;
  back?: string | true;
  children: ReactNode;
  action?: ReactNode;
  steps?: StepConfig;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-10 flex flex-col border-b bg-card">
        <div className="flex h-14 items-center gap-2 px-3">
          {back ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Shield className="ml-2 h-5 w-5 text-primary" />
          )}
          <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
          {action}
        </div>
        {steps && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5">
              {steps.steps.map((label, i) => {
                const idx = i + 1;
                const done = idx < steps.current;
                const active = idx === steps.current;
                return (
                  <div key={label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`h-1 w-full rounded-full transition-colors ${
                        done || active ? "bg-primary" : "bg-muted-foreground/20"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium transition-colors ${
                        active
                          ? "text-primary"
                          : done
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 p-4">
        <div className="mx-auto max-w-xl">{children}</div>
      </main>
    </div>
  );
}
