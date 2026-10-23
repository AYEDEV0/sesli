/**
 * Voxa Avatar Yönetimi ve Hazır Avatar Kitaplığı
 * Yerel görsel yükleme (Canvas ile 128x128 optimize etme) ve
 * LocalStorage'da kalıcı olarak hatırlama desteği.
 */

// Hazır Modern SVG Avatarları (Data URL formatında)
export const PRESET_AVATARS: Array<{ id: string; name: string; url: string }> = [
  {
    id: "bot_blue",
    name: "Siber Mavi",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="25" fill="%235865F2"/><circle cx="50" cy="42" r="22" fill="%23FFFFFF"/><circle cx="43" cy="40" r="4" fill="%231E1F22"/><circle cx="57" cy="40" r="4" fill="%231E1F22"/><path d="M42 52c2.5 3 13.5 3 16 0" stroke="%231E1F22" stroke-width="3" stroke-linecap="round"/><rect x="25" y="72" width="50" height="28" rx="14" fill="%23FFFFFF"/></svg>`,
  },
  {
    id: "bot_emerald",
    name: "Zümrüt Yeşil",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="25" fill="%2323A55A"/><circle cx="50" cy="42" r="22" fill="%23FFFFFF"/><circle cx="43" cy="40" r="4" fill="%231E1F22"/><circle cx="57" cy="40" r="4" fill="%231E1F22"/><path d="M44 51c2 2 10 2 12 0" stroke="%231E1F22" stroke-width="3" stroke-linecap="round"/><rect x="25" y="72" width="50" height="28" rx="14" fill="%23FFFFFF"/></svg>`,
  },
  {
    id: "bot_amber",
    name: "Alev Turuncu",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="25" fill="%23FEE75C"/><circle cx="50" cy="42" r="22" fill="%231E1F22"/><circle cx="43" cy="40" r="4" fill="%23FEE75C"/><circle cx="57" cy="40" r="4" fill="%23FEE75C"/><path d="M44 51c2 2 10 2 12 0" stroke="%23FEE75C" stroke-width="3" stroke-linecap="round"/><rect x="25" y="72" width="50" height="28" rx="14" fill="%231E1F22"/></svg>`,
  },
  {
    id: "bot_crimson",
    name: "Kızıl Gece",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="25" fill="%23F23F43"/><circle cx="50" cy="42" r="22" fill="%23FFFFFF"/><circle cx="43" cy="40" r="4" fill="%231E1F22"/><circle cx="57" cy="40" r="4" fill="%231E1F22"/><path d="M43 51h14" stroke="%231E1F22" stroke-width="3" stroke-linecap="round"/><rect x="25" y="72" width="50" height="28" rx="14" fill="%23FFFFFF"/></svg>`,
  },
  {
    id: "bot_purple",
    name: "Neon Mor",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="25" fill="%239B59B6"/><circle cx="50" cy="42" r="22" fill="%23FFFFFF"/><circle cx="43" cy="39" r="4" fill="%231E1F22"/><circle cx="57" cy="39" r="4" fill="%231E1F22"/><path d="M42 50c3 3 13 3 16 0" stroke="%231E1F22" stroke-width="3" stroke-linecap="round"/><rect x="25" y="72" width="50" height="28" rx="14" fill="%23FFFFFF"/></svg>`,
  },
  {
    id: "bot_dark",
    name: "Gizemli Gölge",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="25" fill="%232B2D31"/><circle cx="50" cy="42" r="22" fill="%235865F2"/><circle cx="43" cy="40" r="4" fill="%23FFFFFF"/><circle cx="57" cy="40" r="4" fill="%23FFFFFF"/><path d="M44 52c2 2 10 2 12 0" stroke="%23FFFFFF" stroke-width="3" stroke-linecap="round"/><rect x="25" y="72" width="50" height="28" rx="14" fill="%235865F2"/></svg>`,
  },
];

const STORAGE_KEY = "voxa_user_avatar";

/**
 * Tarayıcı LocalStorage'dan kayıtlı avatarı çeker.
 */
export function getStoredAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Avatarı LocalStorage'a kalıcı olarak kaydeder.
 */
export function storeAvatar(avatarUrl: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, avatarUrl);
  } catch {}
}

/**
 * Kayıtlı avatarı siler.
 */
export function clearStoredAvatar(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Kullanıcının yüklediği görseli kare (128x128) formatında kırpar ve optimize dataURL'e çevirir.
 */
export async function compressAndCropAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Lütfen geçerli bir resim dosyası seçin."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas oluşturulamadı."));
          return;
        }

        // Kare merkezleme ve kırpma (Aspect fill)
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        // WebP desteği varsa WebP, yoksa JPEG formatında 0.82 kalite
        try {
          const webpData = canvas.toDataURL("image/webp", 0.82);
          if (webpData.startsWith("data:image/webp")) {
            resolve(webpData);
            return;
          }
        } catch {}

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Görsel yüklenemedi."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}
