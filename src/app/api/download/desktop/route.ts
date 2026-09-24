import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const url = new URL(request.url);

  // 1. Ortam değişkeninde tanımlı özel indirme bağlantısı (DESKTOP_DOWNLOAD_URL) varsa yönlendir
  if (process.env.DESKTOP_DOWNLOAD_URL) {
    return NextResponse.redirect(process.env.DESKTOP_DOWNLOAD_URL);
  }

  // 2. Projenin public/downloads/Voxa-Setup-1.0.0.exe altında yerel dosya varsa doğrudan sun
  const localFilePath = path.join(process.cwd(), "public", "downloads", "Voxa-Setup-1.0.0.exe");
  if (fs.existsSync(localFilePath)) {
    return NextResponse.redirect(`${url.origin}/downloads/Voxa-Setup-1.0.0.exe`);
  }

  // 3. Dosya yoksa kırık 404 sayfası vermek yerine doğrudan projenin GitHub Releases / indirme sayfasına yönlendir
  const githubReleaseUrl = "https://github.com/AYEDEV0/sesli/releases";
  return NextResponse.redirect(githubReleaseUrl);
}
