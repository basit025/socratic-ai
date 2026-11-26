/**
 * Private file storage (Supabase Storage), server only. Photographed handwritten pages live in the
 * private "handwritten" bucket; the browser never gets a storage URL, only bytes through our API.
 */
const BUCKET = "handwritten";

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Storage is not configured.");
  return { url: url.replace(/\/$/, ""), key };
}

const objectUrl = (base: string, path: string) => `${base}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

export async function putImage(path: string, bytes: Uint8Array, contentType = "image/jpeg"): Promise<void> {
  const { url, key } = config();
  const res = await fetch(objectUrl(url, path), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": contentType, "x-upsert": "true" },
    body: bytes,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status}`);
}

export async function getImage(path: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const { url, key } = config();
  const res = await fetch(objectUrl(url, path), { headers: { Authorization: `Bearer ${key}`, apikey: key }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`storage download failed: ${res.status}`);
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "image/jpeg" };
}
