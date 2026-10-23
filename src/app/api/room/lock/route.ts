import { NextRequest, NextResponse } from "next/server";
import { getAssignedAccountForRoom } from "@/lib/livekit-pool";

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

    const cleanRoom = room.trim().toLowerCase();
    const { roomService } = await getAssignedAccountForRoom(cleanRoom);

    // LiveKit Odasının metadata alanına kilit durumunu yazıyoruz
    const metadataString = JSON.stringify({ locked });
    await roomService.updateRoomMetadata(cleanRoom, metadataString);

    return NextResponse.json({
      success: true,
      room: cleanRoom,
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
