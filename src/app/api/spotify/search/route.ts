import { NextRequest, NextResponse } from "next/server";
import { SpotifyTrack } from "@/types/spotify";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getClientCredentialsToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return cachedToken;
  } catch (err) {
    console.warn("Spotify token alma hatası:", err);
    return null;
  }
}

// Global Açık Arama Fallback (iTunes API - API key gerektirmez, tüm dünya şarkılarını kapak ve önizleme ile döner)
async function searchPublicMusicCatalog(query: string): Promise<SpotifyTrack[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.results)) return [];

    return data.results.map((item: any) => {
      // Yüksek çözünürlüklü kapak (600x600)
      const hdArt = item.artworkUrl100
        ? item.artworkUrl100.replace("100x100bb", "600x600bb")
        : item.artworkUrl60 || "";

      return {
        id: `track-${item.trackId || Math.random().toString(36).substring(7)}`,
        name: item.trackName || "Bilinmeyen Parça",
        artists: item.artistName || "Bilinmeyen Sanatçı",
        albumName: item.collectionName || item.trackName || "",
        albumArt: hdArt,
        durationMs: item.trackTimeMillis || 180000,
        previewUrl: item.previewUrl || null,
        externalUrl: item.trackViewUrl || "",
      };
    });
  } catch (err) {
    console.warn("Public catalog search hatası:", err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim() === "") {
      return NextResponse.json({ tracks: [] });
    }

    const trimmed = query.trim();

    // 1. Öncelik: Spotify Web API (Eğer ortam değişkenlerinde anahtarlar tanımlıysa)
    const token = await getClientCredentialsToken();
    if (token) {
      try {
        const spotifyRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=track&limit=15`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (spotifyRes.ok) {
          const spotifyData = await spotifyRes.json();
          const items = spotifyData.tracks?.items || [];
          if (items.length > 0) {
            const tracks: SpotifyTrack[] = items.map((item: any) => ({
              id: item.id,
              name: item.name,
              artists: item.artists.map((a: any) => a.name).join(", "),
              albumName: item.album.name,
              albumArt: item.album.images?.[0]?.url || item.album.images?.[1]?.url || "",
              durationMs: item.duration_ms,
              uri: item.uri,
              previewUrl: item.preview_url || null,
              externalUrl: item.external_urls?.spotify || "",
            }));

            return NextResponse.json({ tracks, source: "spotify" });
          }
        }
      } catch (err) {
        console.warn("Spotify API arama hatası, fallback devrede:", err);
      }
    }

    // 2. Öncelik: Global Müzik Arama Motoru (API Key gerektirmez, gerçek kapak ve ses önizlemeleri döner)
    const publicResults = await searchPublicMusicCatalog(trimmed);
    if (publicResults.length > 0) {
      return NextResponse.json({ tracks: publicResults, source: "public_catalog" });
    }

    return NextResponse.json({ tracks: [] });
  } catch (err: any) {
    return NextResponse.json({ tracks: [], error: err.message }, { status: 500 });
  }
}
