import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, codeVerifier, redirectUri, refreshToken } = body;

    const clientId =
      process.env.SPOTIFY_CLIENT_ID ||
      process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
      body.clientId;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId) {
      return NextResponse.json(
        { error: "SPOTIFY_CLIENT_ID bulunamadı." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();

    if (refreshToken) {
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", refreshToken);
      params.append("client_id", clientId);
      if (clientSecret) params.append("client_secret", clientSecret);
    } else if (code && redirectUri) {
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", redirectUri);
      params.append("client_id", clientId);
      if (codeVerifier) params.append("code_verifier", codeVerifier);
      if (clientSecret) params.append("client_secret", clientSecret);
    } else {
      return NextResponse.json(
        { error: "Eksik parametreler (code, codeVerifier, redirectUri veya refreshToken gereklidir)." },
        { status: 400 }
      );
    }

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error_description || data.error || "Token değişimi başarısız oldu" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Bilinmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}

