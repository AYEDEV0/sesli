import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const room = searchParams.get("room");
    const username = searchParams.get("username");

    if (!room || !username) {
      return NextResponse.json(
        { error: "Lütfen 'room' (oda) ve 'username' (kullanıcı adı) parametrelerini sağlayın." },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "Sunucu konfigürasyonu eksik: LIVEKIT_API_KEY, LIVEKIT_API_SECRET veya NEXT_PUBLIC_LIVEKIT_URL tanımlanmamış." },
        { status: 500 }
      );
    }

    // AccessToken üretimi (ttl: 24 saat)
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
      ttl: "24h",
    });

    // Kullanıcıya odaya katılım, ses/video yayınlama, ekran paylaşımı ve veri iletimi tam yetkisi verilir
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      wsUrl,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    return NextResponse.json(
      { error: `Token üretilirken hata oluştu: ${errorMessage}` },
      { status: 500 }
    );
  }
}
