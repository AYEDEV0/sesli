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

  // 1. Hesap (Eski Hesap - Kotası Dolu)
  const k1 = clean(process.env.LIVEKIT_API_KEY_1 || process.env.LIVEKIT_API_KEY);
  const s1 = clean(process.env.LIVEKIT_API_SECRET_1 || process.env.LIVEKIT_API_SECRET);
  const u1 = clean(process.env.LIVEKIT_URL_1 || process.env.NEXT_PUBLIC_LIVEKIT_URL_1 || process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const isDead1 =
    clean(process.env.LIVEKIT_EXHAUSTED_1) === "true" ||
    clean(process.env.LIVEKIT_EXHAUSTED) === "true";

  if (k1 && s1 && u1) {
    accounts.push({
      id: "account_1",
      name: "LiveKit API #1",
      apiKey: k1,
      apiSecret: s1,
      wsUrl: u1,
      httpUrl: u1.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      isExhausted: isDead1 || !!inMemoryExhaustedState["account_1"],
    });
  }

  // 2. Hesap (Aktif)
  const k2 = clean(process.env.LIVEKIT_API_KEY_2);
  const s2 = clean(process.env.LIVEKIT_API_SECRET_2);
  const u2 = clean(process.env.LIVEKIT_URL_2 || process.env.NEXT_PUBLIC_LIVEKIT_URL_2);
  const isDead2 = clean(process.env.LIVEKIT_EXHAUSTED_2) === "true";

  if (k2 && s2 && u2) {
    accounts.push({
      id: "account_2",
      name: "LiveKit API #2",
      apiKey: k2,
      apiSecret: s2,
      wsUrl: u2,
      httpUrl: u2.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      isExhausted: isDead2 || !!inMemoryExhaustedState["account_2"],
    });
  }

  // 3. Hesap (Aktif)
  const k3 = clean(process.env.LIVEKIT_API_KEY_3);
  const s3 = clean(process.env.LIVEKIT_API_SECRET_3);
  const u3 = clean(process.env.LIVEKIT_URL_3 || process.env.NEXT_PUBLIC_LIVEKIT_URL_3);
  const isDead3 = clean(process.env.LIVEKIT_EXHAUSTED_3) === "true";

  if (k3 && s3 && u3) {
    accounts.push({
      id: "account_3",
      name: "LiveKit API #3",
      apiKey: k3,
      apiSecret: s3,
      wsUrl: u3,
      httpUrl: u3.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      isExhausted: isDead3 || !!inMemoryExhaustedState["account_3"],
    });
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
        canUpdateOwnMetadata: true,
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
