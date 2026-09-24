import { NextResponse } from "next/server";

export async function GET() {
  try {
    // GitHub API üzerinden en güncel yayınlanmış sürüm bilgilerini dinamik olarak çekiyoruz
    const res = await fetch("https://api.github.com/repos/AYEDEV0/sesli/releases/latest", {
      headers: {
        "User-Agent": "Voxa-App",
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 30 }, // 30 saniye önbellek
    });

    if (res.ok) {
      const data = await res.json();
      const exeAsset = data.assets?.find((asset: { name: string; browser_download_url: string }) =>
        asset.name.endsWith(".exe")
      );
      if (exeAsset?.browser_download_url) {
        return NextResponse.redirect(exeAsset.browser_download_url);
      }
    }
  } catch (err) {
    console.warn("Dinamik GitHub release bilgisi alınamadı, fallback kullanılıyor:", err);
  }

  // Özel indirme bağlantısı tanımlıysa veya API erişilemezse fallback adresi
  const fallbackUrl =
    process.env.DESKTOP_DOWNLOAD_URL || "https://github.com/AYEDEV0/sesli/releases";

  return NextResponse.redirect(fallbackUrl);
}
