import { RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room, locked } = body;

    if (!room || typeof locked !== "boolean") {
      return NextResponse.json(
        { error: "Lütfen 'room' (oda ismi) ve 'locked' (boolean) parametrelerini gönderin." },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "Sunucu konfigürasyonu eksik." },
        { status: 500 }
      );
    }

    const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

    // LiveKit Odasının metadata alanına kilit durumunu yazıyoruz
    const metadataString = JSON.stringify({ locked });
    await roomService.updateRoomMetadata(room, metadataString);

    return NextResponse.json({
      success: true,
      room,
      locked,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    return NextResponse.json(
      { error: `Oda kilit durumu güncellenirken hata oluştu: ${errorMessage}` },
      { status: 500 }
    );
  }
}
