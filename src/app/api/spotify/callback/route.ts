import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Spotify Yetkilendirme - Voxa</title>
        <style>
          body {
            background-color: #121212;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .box {
            padding: 30px;
            border-radius: 16px;
            background: #18181b;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .green { color: #1db954; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>Voxa Spotify Bağlantısı</h2>
          ${
            error
              ? `<p style="color: #ef4444;">Yetkilendirme hatası: ${error}</p>`
              : `<p class="green">Yetkilendirme başarılı! Bu pencere birazdan kapanacaktır...</p>`
          }
        </div>
        <script>
          const code = "${code || ""}";
          const error = "${error || ""}";
          if (window.opener) {
            window.opener.postMessage({ type: "VOXA_SPOTIFY_AUTH_CALLBACK", code, error }, "*");
            setTimeout(() => window.close(), 1200);
          } else {
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

