import { NextRequest, NextResponse } from "next/server";
import { createRoomToken } from "@/lib/livekit-pool";

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

    const result = await createRoomToken(room, username);

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json({
      token: result.token,
      wsUrl: result.wsUrl,
      accountId: result.accountId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    return NextResponse.json(
      { error: `Token üretilirken hata oluştu: ${errorMessage}` },
      { status: 500 }
    );
  }
}
