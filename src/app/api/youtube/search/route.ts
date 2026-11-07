import { NextRequest, NextResponse } from "next/server";
import { YouTubeTrack } from "@/types/youtube";
import { parseISO8601Duration, formatDuration } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim() === "") {
      return NextResponse.json({ tracks: [] });
    }

    const apiKey =
      process.env.YOUTUBE_API_KEY ||
      process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

    if (!apiKey) {
      console.warn("YOUTUBE_API_KEY environment variable is not defined.");
      return NextResponse.json({ tracks: [] });
    }

    const trimmed = query.trim();

    // 1. YouTube Search API (Öncelikli olarak müzik videoları)
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(
      trimmed
    )}&key=${apiKey}`;

    let searchRes = await fetch(searchUrl, { cache: "no-store" });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("YouTube API search error:", searchRes.status, errText);
      return NextResponse.json(
        { tracks: [], error: "YouTube API arama hatası" },
        { status: searchRes.status }
      );
    }

    const searchData = await searchRes.json();
    const items = searchData.items || [];

    if (items.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    // 2. Video ID'lerini topla ve süre / detayları almak için videos endpoint'ine sor
    const videoIds = items
      .map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(",");

    if (!videoIds) {
      return NextResponse.json({ tracks: [] });
    }

    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl, { cache: "no-store" });

    if (!detailsRes.ok) {
      // Eğer detaylar başarısız olursa arama verileriyle dön
      const fallbackTracks: YouTubeTrack[] = items.map((item: any) => {
        const id = item.id?.videoId || "";
        const snippet = item.snippet || {};
        return {
          id,
          title: snippet.title || "YouTube Videosu",
          channelTitle: snippet.channelTitle || "YouTube",
          thumbnail:
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            snippet.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          durationMs: 200000,
          durationFormatted: "03:20",
        };
      });
      return NextResponse.json({ tracks: fallbackTracks });
    }

    const detailsData = await detailsRes.json();
    const detailItems = detailsData.items || [];

    // Detayları haritala
    const detailsMap = new Map<string, any>();
    detailItems.forEach((item: any) => {
      detailsMap.set(item.id, item);
    });

    const tracks: YouTubeTrack[] = items
      .map((item: any) => {
        const id = item.id?.videoId;
        if (!id) return null;

        const detail = detailsMap.get(id);
        const snippet = detail?.snippet || item.snippet || {};
        const contentDetails = detail?.contentDetails;

        const durationMs = contentDetails?.duration
          ? parseISO8601Duration(contentDetails.duration)
          : 200000;

        // HTML karakterlerini decode et (&amp; -> &, &quot; -> ", &#39; -> ')
        const cleanTitle = (snippet.title || "YouTube Videosu")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");

        const thumbnail =
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

        return {
          id,
          title: cleanTitle,
          channelTitle: snippet.channelTitle || "YouTube",
          thumbnail,
          durationMs,
          durationFormatted: formatDuration(durationMs),
        };
      })
      .filter(Boolean) as YouTubeTrack[];

    return NextResponse.json({ tracks });
  } catch (err: any) {
    console.error("YouTube search route catch:", err);
    return NextResponse.json({ tracks: [], error: err.message }, { status: 500 });
  }
}
