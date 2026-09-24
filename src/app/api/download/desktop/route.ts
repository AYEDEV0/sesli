import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const downloadUrl = process.env.DESKTOP_DOWNLOAD_URL || `${url.origin}/downloads/Voxa-Setup-1.0.0.exe`;
  
  return NextResponse.redirect(downloadUrl);
}
