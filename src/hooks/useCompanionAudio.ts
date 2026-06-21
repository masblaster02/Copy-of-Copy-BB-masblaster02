import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AudioIcon {
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

export function useCompanionAudioAccess(driverId: string | null) {
  return useQuery({
    queryKey: ["companion-audio-access", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      if (!driverId) return false;
      const { data, error } = await supabase.rpc("get_driver_companion_access", {
        p_driver_id: driverId,
      });
      if (error) {
        console.error("Error fetching companion audio access:", error);
        return false;
      }
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanionAudioIcons(pageKey: string) {
  return useQuery<AudioIcon[]>({
    queryKey: ["companion-audio-icons", pageKey],
    enabled: !!pageKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_companion_audio_icons", {
        p_page_key: pageKey,
      });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function getAudioFileUrl(path: string): string {
  return getAudioUrl(path);
}
