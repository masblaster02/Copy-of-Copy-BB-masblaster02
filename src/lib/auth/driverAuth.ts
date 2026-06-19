import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "fg-driver-session";
const TTL_MS = 1000 * 60 * 60 * 8; // 8h

export interface DriverSession {
  driver_id: string;
  employee_number: string;
  name: string;
  surname: string;
  expires_at: number;
}

export function getDriverSession(): DriverSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DriverSession;
    if (Date.now() > s.expires_at) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearDriverSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function loginDriver(employee_number: string, pin: string): Promise<DriverSession> {
  const { data, error } = await supabase.rpc("verify_driver_pin", {
    p_employee_number: employee_number,
    p_pin: pin,
  });
  if (error) throw new Error(error.message);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error("Invalid Driver ID or PIN");
  }
  const row = Array.isArray(data) ? data[0] : data;
  const session: DriverSession = {
    driver_id: row.driver_id,
    employee_number: row.employee_number,
    name: row.name,
    surname: row.surname,
    expires_at: Date.now() + TTL_MS,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}
