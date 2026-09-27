import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawRoom = searchParams.get("room");
    const rawUsername = searchParams.get("username");

    if (!rawRoom || !rawUsername) {
      return NextResponse.json(
        { error: "Lütfen 'room' (oda) ve 'username' (kullanıcı adı) parametrelerini sağlayın." },
        { status: 400 }
      );
    }

    const room = rawRoom.trim().toLowerCase();
    const username = rawUsername.trim();

    if (!room || !username) {
      return NextResponse.json(
        { error: "Geçerli bir oda ismi ve kullanıcı adı girin." },
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

    // Kilitli oda kontrolü
    try {
      const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      const rooms = await roomService.listRooms([room]);

      if (rooms && rooms.length > 0) {
        const activeRoom = rooms[0];
        if (activeRoom.metadata) {
          const parsedMeta = JSON.parse(activeRoom.metadata);
          if (parsedMeta.locked) {
            // Kullanıcı zaten odada var mı kontrol edelim
            const participants = await roomService.listParticipants(room);
            const alreadyInRoom = participants.some((p) => p.name === username || p.identity.startsWith(`${username}#`));
            if (!alreadyInRoom) {
              return NextResponse.json(
                { error: "🔒 Bu oda kilitlenmiştir! Odaya bağlı katılımcılar oda kilidini açana kadar yeni giriş yapılamaz." },
                { status: 403 }
              );
            }
          }
        }
      }
    } catch (e) {
      // Oda henüz oluşturulmamış veya kilit metadata kontrol hatası yok sayılır
    }

    // Çakışmaları engellemek için benzersiz `identity` üretimi, görüntülenen isim `name` olur
    const uniqueTag = Math.floor(1000 + Math.random() * 9000);
    const participantIdentity = `${username}#${uniqueTag}`;

    // AccessToken üretimi (ttl: 24 saat)
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
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
