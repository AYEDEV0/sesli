import { NextResponse } from "next/server";

export async function GET() {
  // Masaüstü kurulum dosyası indirme yönlendirmesi
  const downloadUrl =
    process.env.DESKTOP_DOWNLOAD_URL ||
    "https://github.com/AYEDEV0/indirme/releases/download/v1Ses/Voxa.Desktop.Setup.1.0.0.exe";

  return NextResponse.redirect(downloadUrl);
}
