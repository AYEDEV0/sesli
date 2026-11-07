import { YouTubeTrack } from "@/types/youtube";

// Varsayılan Popüler Parçalar (Gerçek YouTube Video ID'leri)
export const DEFAULT_YOUTUBE_TRACKS: YouTubeTrack[] = [
  {
    id: "4NRXx6U8ABQ",
    title: "The Weeknd - Blinding Lights",
    channelTitle: "The Weeknd",
    thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg",
    durationMs: 203000,
    durationFormatted: "03:23",
  },
  {
    id: "k4xK_24i_98",
    title: "Ezhel - Geceler",
    channelTitle: "KOAL",
    thumbnail: "https://i.ytimg.com/vi/k4xK_24i_98/mqdefault.jpg",
    durationMs: 222000,
    durationFormatted: "03:42",
  },
  {
    id: "5NV6Rdv1a3I",
    title: "Daft Punk - Get Lucky (Official Audio) ft. Pharrell Williams",
    channelTitle: "Daft Punk",
    thumbnail: "https://i.ytimg.com/vi/5NV6Rdv1a3I/mqdefault.jpg",
    durationMs: 248000,
    durationFormatted: "04:08",
  },
  {
    id: "TUVcZfQe-Kw",
    title: "Dua Lipa - Levitating",
    channelTitle: "Dua Lipa",
    thumbnail: "https://i.ytimg.com/vi/TUVcZfQe-Kw/mqdefault.jpg",
    durationMs: 203000,
    durationFormatted: "03:23",
  },
  {
    id: "nO_1q06P-tY",
    title: "Tarkan - Kuzu Kuzu (Official Video)",
    channelTitle: "Tarkan",
    thumbnail: "https://i.ytimg.com/vi/nO_1q06P-tY/mqdefault.jpg",
    durationMs: 235000,
    durationFormatted: "03:55",
  },
  {
    id: "34Na4j8AVgA",
    title: "The Weeknd - Starboy ft. Daft Punk",
    channelTitle: "The Weeknd",
    thumbnail: "https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg",
    durationMs: 230000,
    durationFormatted: "03:50",
  },
];

// ISO 8601 YouTube Duration formatını (örn: PT3M45S, PT1H2M30S) milisaniyeye çevirir
export function parseISO8601Duration(durationStr: string): number {
  if (!durationStr) return 180000;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 180000;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

// Süreyi MM:SS veya HH:MM:SS formatına dönüştürür
export function formatDuration(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// YouTube Video Arama (Sunucu API Rotalı)
export async function searchYouTubeVideos(query: string): Promise<YouTubeTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return DEFAULT_YOUTUBE_TRACKS;
  }

  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        return data.tracks;
      }
    }
  } catch (err) {
    console.warn("YouTube arama hatası:", err);
  }

  // Fallback: Yerel önceden tanımlanmış parçaları filtrele
  const lower = trimmed.toLowerCase();
  const filtered = DEFAULT_YOUTUBE_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(lower) ||
      t.channelTitle.toLowerCase().includes(lower)
  );

  return filtered.length > 0 ? filtered : DEFAULT_YOUTUBE_TRACKS;
}

