import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type PageKey =
  | "driver_login"
  | "driver_menu"
  | "driver_select_vehicle"
  | "driver_blueprint"
  | "driver_pretrip"
  | "driver_return";

export function usePageAudio(pageKey: PageKey) {
  return useQuery({
    queryKey: ["page-audio", pageKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_page_audio")
        .select("audio_path, label")
        .eq("page_key", pageKey)
        .single();
      if (error) throw error;
      return data as { audio_path: string | null; label: string };
    },
    staleTime: 5 * 60 * 1000,
  });
}
