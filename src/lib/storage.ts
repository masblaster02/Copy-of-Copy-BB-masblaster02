import { supabase } from "@/lib/supabase";

export async function uploadPhoto(bucket: string, file: File, pathPrefix: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  // Return storage path; resolve to signed/public URL at read-time.
  return path;
}

export async function uploadPhotoAt(
  bucket: string,
  file: File,
  path: string,
  upsert = true,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export function getPublicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function getDamagePhotoUrl(path: string): Promise<string> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!url || !anon) return "";
  const res = await fetch(`${url}/functions/v1/damage-photo-url?path=${encodeURIComponent(path)}`, {
    headers: { apikey: anon },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.signedUrl ?? "";
}
