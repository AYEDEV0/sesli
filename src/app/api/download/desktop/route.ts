import { NextResponse } from "next/server";

export async function GET() {
  // Masaüstü kurulum dosyası indirme yönlendirmesi
  const downloadUrl =
    process.env.DESKTOP_DOWNLOAD_URL ||
    "https://github.com/AYEDEV0/sesli/releases/latest/download/Voxa.Desktop.Setup.1.0.0.exe";

  return NextResponse.redirect(downloadUrl);
}
