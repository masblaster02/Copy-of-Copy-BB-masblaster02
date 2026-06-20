import { useState, useEffect, useCallback } from "react";
import { isCompanionMode, setCompanionMode } from "@/lib/auth/driverAuth";

export function useCompanionMode() {
  const [enabled, setEnabledState] = useState(isCompanionMode());

  useEffect(() => {
    setEnabledState(isCompanionMode());
  }, []);

  const toggle = useCallback(() => {
    const newValue = !enabled;
    setCompanionMode(newValue);
    setEnabledState(newValue);
  }, [enabled]);

  return { enabled, toggle };
}
