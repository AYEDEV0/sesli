import { SpotifyTrack } from "@/types/spotify";

const STORAGE_TOKEN_KEY = "voxa_spotify_access_token";
const STORAGE_EXPIRY_KEY = "voxa_spotify_token_expires_at";
const STORAGE_REFRESH_KEY = "voxa_spotify_refresh_token";
const STORAGE_CUSTOM_CLIENT_ID = "voxa_spotify_custom_client_id";

// Önceden hazırlanmış zengin müzik kütüphanesi (Yüksek kaliteli HD kapaklar ve doğrudan çalışan güvenli önizleme sesleri)
export const CURATED_TRACKS: SpotifyTrack[] = [
  {
    id: "sample-1",
    name: "Blinding Lights",
    artists: "The Weeknd",
    albumName: "After Hours",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/00/a3/37/00a33792-ee1b-ae29-59cb-0026e6ef1095/19UMGIM89617.rgb.jpg/600x600bb.jpg",
    durationMs: 200000,
    uri: "spotify:track:0VjIjW4GlUZAMYd2vXMi3b",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/33/c4/7a/33c47a50-681b-5353-c408-010411ab9c12/mzaf_10793666699478440059.plus.aac.p.m4a",
    externalUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
  },
  {
    id: "sample-2",
    name: "Geceler",
    artists: "Ezhel",
    albumName: "Müptezhel",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/d5/43/d3/d543d3b7-789a-0e9b-cf42-6e273f08722a/cover.jpg/600x600bb.jpg",
    durationMs: 220000,
    uri: "spotify:track:1XyoqU65fJ5c0G93p8f4s5",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/24/76/84/247684d0-4229-2165-27f9-467a5b3997bb/mzaf_14092416480572797619.plus.aac.p.m4a",
    externalUrl: "https://open.spotify.com/track/1XyoqU65fJ5c0G93p8f4s5",
  },
  {
    id: "sample-3",
    name: "Get Lucky",
    artists: "Daft Punk ft. Pharrell Williams",
    albumName: "Random Access Memories",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/09/b8/a409b82e-9d29-c88f-fa16-e42106cf35a4/886443927087.jpg/600x600bb.jpg",
    durationMs: 248000,
    uri: "spotify:track:2Foc5Q5nqNiosCNqttzHof",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b8/d3/42/b8d34293-c44f-356b-30eb-329e4b6c3a16/mzaf_842221689234850901.plus.aac.p.m4a",
    externalUrl: "https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof",
  },
  {
    id: "sample-4",
    name: "Levitating",
    artists: "Dua Lipa",
    albumName: "Future Nostalgia",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2a/39/3c/2a393c04-3079-c580-c110-388f61536b56/190295286101.jpg/600x600bb.jpg",
    durationMs: 203000,
    uri: "spotify:track:463CkQjx2Zk1yXoBuierM9",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/e0/b3/ef/e0b3efb6-7eb5-1678-b1ad-359cf9a3560b/mzaf_17208154562477544079.plus.aac.p.m4a",
    externalUrl: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9",
  },
  {
    id: "sample-5",
    name: "Kuzu Kuzu",
    artists: "Tarkan",
    albumName: "Karma",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/35/8d/22/358d22cf-8b9c-1e7d-996d-85aad739a255/dj.nixigvoo.jpg/600x600bb.jpg",
    durationMs: 233000,
    uri: "spotify:track:5FVd6KXrgO9B3JPmC8OPst",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a4/26/66/a42666ad-e41b-97fe-31fa-44d2e2ce7b0a/mzaf_6737222124035794780.plus.aac.p.m4a",
    externalUrl: "https://open.spotify.com/track/5FVd6KXrgO9B3JPmC8OPst",
  },
  {
    id: "sample-6",
    name: "Starboy",
    artists: "The Weeknd ft. Daft Punk",
    albumName: "Starboy",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d9/30/b0/d930b05e-8515-b153-2947-f3273e93ff68/16UMGIM56461.rgb.jpg/600x600bb.jpg",
    durationMs: 230000,
    uri: "spotify:track:7MXVkk9YM5IZxh0WSlVIk0",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ea/91/92/ea91924b-32ee-911d-2850-2adfe7f583e7/mzaf_13840742510344400969.plus.aac.p.m4a",
    externalUrl: "https://open.spotify.com/track/7MXVkk9YM5IZxh0WSlVIk0",
  },
];

// Dakika ve Saniye formatlama (Örn: 215000 ms -> 03:35)
export function formatDuration(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Token Yönetimi
export function getStoredSpotifyToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  const expiresAt = localStorage.getItem(STORAGE_EXPIRY_KEY);
  if (!token) return null;
  if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    return null;
  }
  return token;
}

export function storeSpotifyToken(token: string, expiresInSeconds: number, refreshToken?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_EXPIRY_KEY, (Date.now() + expiresInSeconds * 1000).toString());
  if (refreshToken) {
    localStorage.setItem(STORAGE_REFRESH_KEY, refreshToken);
  }
}

export function clearStoredSpotifyToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_EXPIRY_KEY);
  localStorage.removeItem(STORAGE_REFRESH_KEY);
}

export const DEFAULT_SPOTIFY_CLIENT_ID = "0f084e1e90c9407fa7fbd62bdbf638ac";

export function getCustomSpotifyClientId(): string {
  if (typeof window === "undefined") return DEFAULT_SPOTIFY_CLIENT_ID;
  return (
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    localStorage.getItem(STORAGE_CUSTOM_CLIENT_ID) ||
    DEFAULT_SPOTIFY_CLIENT_ID
  );
}

export function setCustomSpotifyClientId(clientId: string) {
  if (typeof window === "undefined") return;
  if (!clientId) {
    localStorage.removeItem(STORAGE_CUSTOM_CLIENT_ID);
  } else {
    localStorage.setItem(STORAGE_CUSTOM_CLIENT_ID, clientId.trim());
  }
}

// PKCE Helper Functions (Spotify Web API Doğrulaması)
export function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let text = "";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  const base64Digest = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64Digest;
}

export async function createSpotifyAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  const verifier = generateRandomString(64);
  if (typeof window !== "undefined") {
    sessionStorage.setItem("voxa_spotify_code_verifier", verifier);
  }
  const challenge = await generateCodeChallenge(verifier);
  const scope = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
    "user-read-currently-playing",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scope,
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: redirectUri,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Doğrudan Açık Müzik Arama (İstemci Tarafı Güvenli Fallback - Sıfır Bağımlılık)
async function searchClientPublicCatalog(query: string): Promise<SpotifyTrack[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.results)) return [];

    return data.results.map((item: any) => ({
      id: `track-${item.trackId || Math.random().toString(36).substring(7)}`,
      name: item.trackName || "Bilinmeyen Parça",
      artists: item.artistName || "Bilinmeyen Sanatçı",
      albumName: item.collectionName || item.trackName || "",
      albumArt: item.artworkUrl100
        ? item.artworkUrl100.replace("100x100bb", "600x600bb")
        : item.artworkUrl60 || "",
      durationMs: item.trackTimeMillis || 180000,
      previewUrl: item.previewUrl || null,
      externalUrl: item.trackViewUrl || "",
    }));
  } catch {
    return [];
  }
}

// Şarkı Arama (Spotify API veya Yedek Akıllı Global Arama)
export async function searchSpotifyTracks(query: string): Promise<SpotifyTrack[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return CURATED_TRACKS;
  }

  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        return data.tracks;
      }
    }
  } catch (err) {
    console.warn("Müzik arama API uyarısı, doğrudan istemci aramasına geçiliyor:", err);
  }

  // Sunucu yanıt vermezse veya offline durumdaysa doğrudan istemciden dünya kataloğunda ara
  const directResults = await searchClientPublicCatalog(trimmed);
  if (directResults.length > 0) {
    return directResults;
  }

  // Yedek filtreleme
  const filtered = CURATED_TRACKS.filter(
    (t) =>
      t.name.toLowerCase().includes(trimmed) ||
      t.artists.toLowerCase().includes(trimmed) ||
      t.albumName.toLowerCase().includes(trimmed)
  );

  return filtered.length > 0 ? filtered : CURATED_TRACKS;
}
