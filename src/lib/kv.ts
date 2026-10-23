/**
 * Vercel KV & Upstash Redis REST API İstemcisi
 * Sıfır harici paket bağımlılığı ile doğrudan yerel fetch (Upstash REST API) kullanarak çalışır.
 * Ortam değişkenleri (KV_REST_API_URL veya UPSTASH_REDIS_REST_URL) tanımlı değilse
 * hata fırlatmadan sessizce in-memory fallback yapar.
 */

const cleanEnv = (val?: string) => (val ? val.replace(/^["']|["']$/g, "").trim() : "");

const getKvConfig = () => {
  const rawUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  const url = cleanEnv(rawUrl);
  const token = cleanEnv(rawToken);

  return { url, token, isConfigured: Boolean(url && token) };
};

/**
 * Anahtarın değerini çeker (GET)
 */
export async function kvGet(key: string): Promise<string | null> {
  const { url, token, isConfigured } = getKvConfig();
  if (!isConfigured) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", key]),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.result === "string" ? data.result : null;
  } catch (err) {
    console.warn(`[KV GET Hata]: ${key}`, err);
    return null;
  }
}

/**
 * Anahtarı ve değerini kaydeder (SET / EX TTL)
 */
export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  const { url, token, isConfigured } = getKvConfig();
  if (!isConfigured) return false;

  try {
    const command = ttlSeconds
      ? ["SET", key, value, "EX", String(ttlSeconds)]
      : ["SET", key, value];

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.result === "OK";
  } catch (err) {
    console.warn(`[KV SET Hata]: ${key}`, err);
    return false;
  }
}

/**
 * Anahtarı siler (DEL)
 */
export async function kvDel(key: string): Promise<boolean> {
  const { url, token, isConfigured } = getKvConfig();
  if (!isConfigured) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["DEL", key]),
      cache: "no-store",
    });

    if (!res.ok) return false;
    return true;
  } catch (err) {
    console.warn(`[KV DEL Hata]: ${key}`, err);
    return false;
  }
}
