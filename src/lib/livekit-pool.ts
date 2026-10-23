import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { kvGet, kvSet, kvDel } from "./kv";

export interface LiveKitAccount {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
  httpUrl: string;
  isExhausted: boolean;
}

// In-memory kota durumu önbelleği (Serverless yaşam döngüsü boyunca)
const inMemoryExhaustedState: Record<string, boolean> = {};

/**
 * Ortam değişkenlerinden LiveKit hesap havuzunu yükler.
 * LIVEKIT_API_KEY_1, LIVEKIT_API_KEY_2 veya LIVEKIT_API_KEY formatlarını otomatik tanır.
 */
const clean = (val?: string) => (val ? val.replace(/^["']|["']$/g, "").trim() : "");

export function getLiveKitAccounts(): LiveKitAccount[] {
  const accounts: LiveKitAccount[] = [];

  // 1. Numaralandırılmış hesapları tara (1'den 10'a kadar)
  for (let i = 1; i <= 10; i++) {
    const rawApiKey = process.env[`LIVEKIT_API_KEY_${i}`];
    const rawApiSecret = process.env[`LIVEKIT_API_SECRET_${i}`];
    const rawWsUrl = process.env[`LIVEKIT_URL_${i}`] || process.env[`NEXT_PUBLIC_LIVEKIT_URL_${i}`];
    const isExhaustedEnv = clean(process.env[`LIVEKIT_EXHAUSTED_${i}`]) === "true";

    const apiKey = clean(rawApiKey);
    const apiSecret = clean(rawApiSecret);
    const wsUrl = clean(rawWsUrl);

    if (apiKey && apiSecret && wsUrl) {
      const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      accounts.push({
        id: `account_${i}`,
        name: `LiveKit API #${i}`,
        apiKey,
        apiSecret,
        wsUrl,
        httpUrl,
        isExhausted: isExhaustedEnv || !!inMemoryExhaustedState[`account_${i}`],
      });
    }
  }

  // 2. Eğer numaralandırılmış bulunamazsa varsayılan tekil env'leri yükle
  if (accounts.length === 0) {
    const rawApiKey = process.env.LIVEKIT_API_KEY;
    const rawApiSecret = process.env.LIVEKIT_API_SECRET;
    const rawWsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    const apiKey = clean(rawApiKey);
    const apiSecret = clean(rawApiSecret);
    const wsUrl = clean(rawWsUrl);

    const isExhaustedEnv =
      clean(process.env.LIVEKIT_EXHAUSTED) === "true" ||
      clean(process.env.LIVEKIT_EXHAUSTED_1) === "true" ||
      apiKey === "APIMeQAiA25GGbH" ||
      wsUrl.includes("sesli-rq0ve8k0");

    if (apiKey && apiSecret && wsUrl) {
      const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      accounts.push({
        id: "account_default",
        name: "LiveKit Varsayılan API",
        apiKey,
        apiSecret,
        wsUrl,
        httpUrl,
        isExhausted: isExhaustedEnv || !!inMemoryExhaustedState["account_default"],
      });
    }
  }

  return accounts;
}

/**
 * Hatayı analiz edip LiveKit kota aşımı veya limit hatası olup olmadığını tespit eder.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("limit") ||
    msg.includes("exceeded") ||
    msg.includes("too many requests") ||
    msg.includes("resource exhausted") ||
    msg.includes("429") ||
    msg.includes("credit") ||
    msg.includes("max participant") ||
    msg.includes("bandwidth")
  );
}

/**
 * Bir hesabı kota tükenmiş olarak işaretler (Hem bellekte hem de varsa KV'de 24 saat süreyle).
 */
export async function markAccountAsExhausted(accountId: string) {
  inMemoryExhaustedState[accountId] = true;
  await kvSet(`quota_exhausted:${accountId}`, "true", 86400); // 24 saat
  console.warn(`[LiveKit Pool] ${accountId} kotası doldu olarak işaretlendi, diğer hesaba geçiliyor.`);
}

/**
 * Bir hesabın anlık durumunu (KV ve bellek kontrolüyle) doğrular.
 */
async function isAccountHealthy(account: LiveKitAccount): Promise<boolean> {
  if (account.isExhausted || inMemoryExhaustedState[account.id]) {
    return false;
  }
  const kvState = await kvGet(`quota_exhausted:${account.id}`);
  if (kvState === "true") {
    inMemoryExhaustedState[account.id] = true;
    return false;
  }
  return true;
}

/**
 * Metin tabanlı tutarlı hash (Consistent Hashing) algoritması
 * Oda ismini sağlıklı hesaplar arasında eşit ve deterministik dağıtır.
 */
function consistentHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Verilen oda için doğru LiveKit hesabını bulur / atar.
 * 1. Odanın daha önce hangi hesaba atandığını KV'den kontrol eder.
 * 2. Odada halihazırda katılımcı var mı diye LiveKit hesaplarını sorgular.
 * 3. Yeni oda ise sağlıklı hesaplar arasında tutarlı dağıtım yapar.
 */
export async function getAssignedAccountForRoom(roomName: string): Promise<{
  account: LiveKitAccount;
  roomService: RoomServiceClient;
}> {
  const allAccounts = getLiveKitAccounts();
  if (allAccounts.length === 0) {
    throw new Error("Hiçbir LiveKit API hesabı konfigüre edilmemiş.");
  }

  const cleanRoom = roomName.trim().toLowerCase();

  // 1. Adım: Varsa KV / Redis önbelleğinden odanın bağlı olduğu hesabı kontrol et
  const cachedAccountId = await kvGet(`room_assigned:${cleanRoom}`);
  if (cachedAccountId) {
    const cachedAcc = allAccounts.find((a) => a.id === cachedAccountId);
    if (cachedAcc && (await isAccountHealthy(cachedAcc))) {
      return {
        account: cachedAcc,
        roomService: new RoomServiceClient(cachedAcc.httpUrl, cachedAcc.apiKey, cachedAcc.apiSecret),
      };
    }
  }

  // 2. Adım: Sağlıklı hesapları filtrele
  const healthyAccounts: LiveKitAccount[] = [];
  for (const acc of allAccounts) {
    if (await isAccountHealthy(acc)) {
      healthyAccounts.push(acc);
    }
  }

  // 2.1 Adım: Eğer 2 ve 3 de dahil tüm hesaplar dolu görünüyorsa,
  // pes etmeden önce 1. hesap dahil tüm havuzu canlı teste tabi tut (Ay başı yenilenmiş olabilir)
  if (healthyAccounts.length === 0) {
    console.log("[LiveKit Pool] Tüm hesaplar dolu görünüyor. Hesap canlandırma taraması yapılıyor...");
    for (const acc of allAccounts) {
      try {
        const testClient = new RoomServiceClient(acc.httpUrl, acc.apiKey, acc.apiSecret);
        await testClient.listRooms();
        // 429 veya kota hatası vermeden listRooms başarılı olduysa kotası yenilenmiştir!
        inMemoryExhaustedState[acc.id] = false;
        await kvDel(`quota_exhausted:${acc.id}`);
        healthyAccounts.push({ ...acc, isExhausted: false });
        console.log(`[LiveKit Pool] ${acc.name} kotasının sıfırlandığı doğrulandı ve tekrar havuza alındı!`);
        break; // İlk çalışan hesabı bulduğumuzda hemen devreye al
      } catch (err) {
        // Hâlâ 429 ise sonraki hesaba bak
      }
    }
  }

  if (healthyAccounts.length === 0) {
    throw new Error("Tüm LiveKit hesaplarının kotası dolmuş görünüyor. Lütfen yeni bir API anahtarı ekleyin veya hesapların yenilenmesini bekleyin.");
  }

  // 3. Adım: Bu oda halihazırda bir hesapta aktif mi diye kontrol et
  for (const acc of healthyAccounts) {
    try {
      const client = new RoomServiceClient(acc.httpUrl, acc.apiKey, acc.apiSecret);
      const existingRooms = await client.listRooms([cleanRoom]);
      if (existingRooms && existingRooms.length > 0) {
        // Oda bu hesapta aktif! Yeni kullanıcıyı da kesinlikle buraya bağlamalıyız.
        await kvSet(`room_assigned:${cleanRoom}`, acc.id, 7200); // 2 saat geçerli
        return { account: acc, roomService: client };
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        await markAccountAsExhausted(acc.id);
      }
    }
  }

  // 4. Adım: Oda hiçbir hesapta henüz aktif değil (yeni açılıyor).
  // Güncel sağlıklı hesaplar arasından tutarlı hash ile birini seç.
  const activeHealthy = healthyAccounts.filter((a) => !inMemoryExhaustedState[a.id]);
  const fallbackList = activeHealthy.length > 0 ? activeHealthy : healthyAccounts;

  const chosenIndex = consistentHash(cleanRoom) % fallbackList.length;
  const chosenAccount = fallbackList[chosenIndex];

  // Atamayı önbelleğe yaz
  await kvSet(`room_assigned:${cleanRoom}`, chosenAccount.id, 7200);

  return {
    account: chosenAccount,
    roomService: new RoomServiceClient(chosenAccount.httpUrl, chosenAccount.apiKey, chosenAccount.apiSecret),
  };
}

/**
 * Bir oda ve kullanıcı için token üretir.
 * Kilitli oda kontrolünü yapar, kota hatası alırsa otomatik sıradaki hesaba aktarır.
 */
export async function createRoomToken(roomName: string, username: string) {
  const cleanRoom = roomName.trim().toLowerCase();
  const cleanUser = username.trim();

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    const { account, roomService } = await getAssignedAccountForRoom(cleanRoom);

    try {
      // 1. Kilitli oda kontrolü
      const rooms = await roomService.listRooms([cleanRoom]);
      if (rooms && rooms.length > 0) {
        const activeRoom = rooms[0];
        if (activeRoom.metadata) {
          try {
            const parsedMeta = JSON.parse(activeRoom.metadata);
            if (parsedMeta.locked) {
              const participants = await roomService.listParticipants(cleanRoom);
              const alreadyInRoom = participants.some(
                (p) => p.name === cleanUser || p.identity.startsWith(`${cleanUser}#`)
              );
              if (!alreadyInRoom) {
                return {
                  error: "🔒 Bu oda kilitlenmiştir! Odaya bağlı katılımcılar oda kilidini açana kadar yeni giriş yapılamaz.",
                  status: 403,
                };
              }
            }
          } catch {
            // metadata parse hatası yok sayılır
          }
        }
      }

      // 2. Çakışmaları engellemek için benzersiz `identity` üretimi
      const uniqueTag = Math.floor(1000 + Math.random() * 9000);
      const participantIdentity = `${cleanUser}#${uniqueTag}`;

      // 3. Token oluşturma (ttl: 24 saat)
      const at = new AccessToken(account.apiKey, account.apiSecret, {
        identity: participantIdentity,
        name: cleanUser,
        ttl: "24h",
      });

      at.addGrant({
        roomJoin: true,
        room: cleanRoom,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      return {
        token,
        wsUrl: account.wsUrl,
        accountId: account.id,
        accountName: account.name,
      };
    } catch (err) {
      if (isQuotaExceededError(err)) {
        await markAccountAsExhausted(account.id);
        // Döngü sonraki sağlıklı hesabı deneyecek
        continue;
      }
      throw err;
    }
  }

  throw new Error("Uygun LiveKit bağlantısı kurulamadı. Lütfen kısa süre sonra tekrar deneyin.");
}
