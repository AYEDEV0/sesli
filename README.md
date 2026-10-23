# 🎙️ Voxa - Yapay Zekâ Destekli Sesli Görüşme ve Ekran Paylaşım Platformu

**Voxa**, Next.js 14, LiveKit Cloud, Krisp AI ve Electron altyapısı kullanılarak geliştirilmiş; modern tarayıcılar (Web) ve Masaüstü Uygulaması (`.exe`) üzerinden kesintisiz sesli görüşme, HD/2K 60 FPS ekran & uygulama yayıncılığı, sistem sesi aktarımı, oda kilitleme, kişi bazlı bağımsız ses kontrolü, AI gürültü engelleme, 0-bayt sunucu maliyetli P2P dosya/görsel transferi ve anlık mesajlaşma sunan yeni nesil hibrit iletişim platformudur.

---

## 📌 Projenin Amacı ve Temel Odak Noktaları

- **Hızlı ve Üyeliksiz Katılım:** Kullanıcıların hesap oluşturma veya karmaşık kayıt süreçleriyle uğraşmadan yalnızca Rumuz (Kullanıcı Adı) ve Oda İsmi ile anında sesli kanallara katılabilmesi.
- **Kesintisiz Çoklu API Havuzu:** Ücretsiz LiveKit kotalarının (100 GB / ay) aniden tükenmesini önleyen çoklu hesap havuzu ve oda bazlı sabitleme (Room Pinning) mimarisi.
- **0 Bayt Sunucu Maliyetli P2P Dosya Transferi:** Sohbet üzerinden paylaşılan dosyaların ve resimlerin LiveKit veya barındırma sunucusuna yük bindirmeden doğrudan WebRTC DataChannel üzerinden aktarılması.
- **Yapay Zekâ Gürültü Engelleme (Krisp AI):** Arka plan gürültülerini, klavye seslerini, fan gürültüsünü ve yankıyı WebAssembly ortamında otomatik olarak filtreleme.
- **2K 60 FPS Ekran Paylaşımı & Sistem Sesi:** 720p, 1080p ve 2K (1440p 60 FPS) çözünürlüğe kadar yüksek kaliteli ekran/pencere yayını ve oyun/sistem sesi aktarımı (Desktop Audio Loopback).
- **Discord Tarzı Masaüstü Uygulaması (Electron v44):** Engelsiz masaüstü deneyimi, pencere seçici modalı, sistem genelinde ses yakalama ve panoya güvenli kopya alma desteği.
- **Kişiselleştirilmiş Ses Kontrolü:** Odadaki diğer katılımcıların ses seviyelerini bağımsız olarak (%0 - %200) kısabilme, artırabilme veya bireysel sessize alma (Mute).
- **Güvenli Oda Kilitleme (Room Lock):** Odadaki katılımcıların tek tıkla odayı kilitleyebilmesi ve kilitli odalara dışarıdan yetkisiz katılımı API seviyesinde engelleme.
- **Otomatik Güncelleme (Auto-Updater) & CI/CD Pipeline:** GitHub Actions ile otomatik derleme (`.exe`), GitHub Releases üzerinde versiyon yayınlama ve masaüstü uygulamasının kendini otomatik güncelleyebilmesi.

---

## 🛠️ Kullanılan Teknolojiler

| Bileşen                   | Teknolojiler                                                                          |
| :------------------------ | :------------------------------------------------------------------------------------ |
| **Framework**             | Next.js 14 (App Router), React 18                                                     |
| **Masaüstü Altyapısı**    | Electron 44, Electron Builder, `electron-updater`                                     |
| **Programlama Dili**      | TypeScript, JavaScript (ES6+)                                                         |
| **Stil & Tasarım**        | Tailwind CSS, Lucide Icons, Custom CSS, Glassmorphism                                 |
| **Canlı Medya Altyapısı** | LiveKit Web SDK (`@livekit/components-react`, `livekit-client`, `livekit-server-sdk`) |
| **P2P Dosya Transferi**   | WebRTC `RTCPeerConnection`, `RTCDataChannel`, Google STUN                             |
| **Dağıtık Önbellek (KV)** | Upstash Redis REST API (Vercel KV uyumlu, harici bağımlılıksız yerel HTTP istemcisi)  |
| **Gürültü Filtresi**      | `@livekit/krisp-noise-filter` (Krisp WebAssembly AI Noise Suppression)                |
| **Ses Sentezleme**        | Web Audio API (Sentetik osilatörler ile harici ses dosyası olmadan bildirim sesleri)  |
| **CI/CD & Release**       | GitHub Actions (`build-electron.yml`), `softprops/action-gh-release@v2`               |

---

## 🧠 Mimari ve Çalışma Mantığı (Deep Dive)

### 1. Çoklu LiveKit API Havuzu & Failover Mantığı (`src/lib/livekit-pool.ts`)
LiveKit Cloud ücretsiz paketinde hesap başına aylık 100 GB kota ve 100 eşzamanlı bağlantı sınırı bulunur. Voxa, birden fazla hesabı (`LIVEKIT_API_KEY_1`, `_2`, `_3`) tek bir havuzda yönetir:

```
[Kullanıcı Odaya Girer: 'oda-1']
             │
             ▼
[API Token Endpoint: /api/token]
             │
             ├─► 1. Upstash KV / Redis Kontrolü:
             │      'room_assigned:oda-1' anahtarı var mı?
             │      ├─► EVET: Odaya daha önce atanmış hesabı al (Örn: account_2)
             │      └─► HAYIR: Aktif odaları tara veya Consistent Hash ile sağlıklı bir hesap seç
             │
             ├─► 2. Kilit Kontrolü:
             │      Oda kilitli mi? Kilitliyse ve kullanıcı içeride değilse -> 403 Forbidden
             │
             ├─► 3. Token Üretimi & 429 Kota Hatası Yakalama:
             │      LiveKit 429 (Kota Doldu) dönerse:
             │      - Hesabı bellekte ve KV'de 'quota_exhausted:account_x' olarak işaretle
             │      - Otomatik olarak sıradaki sağlıklı hesaba geç
             │
             └─► 4. Yanıt:
                    { token: "...", wsUrl: "wss://...", accountId: "account_2" }
```

#### Kritik Kurallar:
1. **Oda Bazlı Sabitleme (Room Pinning):** Aynı odaya giren tüm kullanıcılar **kesinlikle aynı LiveKit hesabına** bağlanır. Farklı LiveKit sunucularına bağlanan kullanıcılar birbirini göremez ve duyamaz. Bu durum Upstash Redis (`room_assigned:<oda_adi>`) ve `consistentHash()` algoritması ile garanti altına alınmıştır.
2. **Statik Ortam Değişkenleri:** Next.js/Webpack serverless derlemesinde dinamik döngü `process.env[`KEY_${i}`]` undefined döner. Bu yüzden `LIVEKIT_API_KEY_1`, `_2`, `_3` değişkenleri kodda açıkça statik yazılmıştır.
3. **Gizli Anahtar Güvenliği:** Kod içine asla gerçek API anahtarı string olarak yazılmaz; Netlify'ın gizli anahtar tarayıcısı (Secret Scanner) derlemeyi engeller.

---

### 2. P2P Dosya & Görsel Transferi Mimarisi (`src/lib/p2p-file-transfer.ts`)
Sohbet üzerinden yüksek boyutlu dosyalar veya ekran alıntıları gönderildiğinde LiveKit sunucusunun kotasını tüketmemek için **doğrudan WebRTC DataChannel (Peer-to-Peer)** kullanılır:

```
[Gönderici: Alice]                                                [Alıcı: Bob]
        │                                                               │
        ├─► 1. Resim/Dosya Seçilir & 160px Canvas Küçük Resim Üretilir   │
        ├─► 2. LiveKit Chat Üzerinden Teklif Gönderilir (<1 KB JSON):   │
        │      { type: "p2p-file-offer", fileId, name, size, thumbnail }│
        │──────────────────────────────────────────────────────────────►│
        │                                                               │ (Sohbette görsel kartı
        │                                                               │  ve 'İndir' butonu çıkar)
        │                                                               │
        │   ◄───────────────────────────────────────────────────────────┤ Bob 'İndir'e basar:
        │          { type: "p2p-file-request", fileId }                 │
        │                                                               │
        ├─► 3. Doğrudan WebRTC Bağlantısı Kurulur (Google STUN):         │
        │      SDP Offer / Answer ve ICE Adayları LiveKit üzerinden iletilir
        │   ◄══════════════════════════════════════════════════════════►│
        │                                                               │
        ├─► 4. Dosya 64 KB Binary Paketler Halinde P2P RTCDataChannel   │
        │      üzerinden akar (%0 - %100 Canlı İlerleme Çubuğu)         │
        │══════════════════════════════════════════════════════════════►│
        │                                                               │
        │                                                               └─► Dosya Bob'un tarayıcısına
        │                                                                   otomatik indirilir.
```
- **LiveKit Sunucu Maliyeti: 0 Bayt!** Sadece birkaç baytlık sinyalizasyon JSON'ı geçer; dosyanın kendisi asla sunucuya uğramaz.
- **Pano Entegrasyonu:** Sohbet kutusuna `Ctrl + V` ile ekran alıntısı veya resim doğrudan yapıştırılabilir.

---

### 3. Dağıtık Önbellek: Upstash Redis / Vercel KV REST İstemcisi (`src/lib/kv.ts`)
Harici ağır npm kütüphanelerine (`@upstash/redis`, `ioredis`) gerek kalmadan, doğrudan Node.js yerel `fetch` API'si ile Upstash REST API'sine konuşan hafif bir REST istemcisi yazılmıştır:
- `kvGet(key)`: JSON komut dizisi (`["GET", key]`) gönderir.
- `kvSet(key, value, exSeconds)`: Veriyi belirtilen TTL (ömür) ile kaydeder.
- `kvDel(key)`: Anahtarı siler.
- `KV_REST_API_URL` ve `KV_REST_API_TOKEN` tanımlanmadığında uygulama çökmez; bellek içi (in-memory) güvenli fallback modunda çalışmaya devam eder.

---

### 4. Sentetik Ses Sentezleyici (`src/lib/sounds.ts`)
Dışarıdan MP3 dosyası indirmeye gerek kalmadan, tarayıcının yerel `AudioContext` osilatörleri kullanılarak matematiksel frekans dalgalarıyla Discord tarzı yumuşak ses efektleri üretilir:
- **Join Chime:** D5 (587.33 Hz) -> A5 (880.00 Hz) yükselen yumuşak sinüs tonu.
- **Leave Chime:** A5 (880.00 Hz) -> D5 (587.33 Hz) azalan sinüs tonu.
- **Mute / Unmute Clicks:** Yüksek frekanslı mikro tıklama tonları.

---

## 🌟 Tamamlanan Özellikler (v1.0.3)

1. **Çoklu LiveKit Havuzu & Oda Sabitleme:** API 1, API 2 ve API 3 arasında otomatik geçiş; aynı odadaki kişilerin aynı sunucuya bağlanması.
2. **P2P WebRTC Sohbet Dosya/Resim Paylaşımı:** Sınırsız dosya paylaşımı, canlı küçük resim önizlemesi, `Ctrl + V` ekran görüntüsü yapıştırma, canlı indirme ilerleme çubuğu.
3. **Web Audio Bildirim Sesleri:** Giriş, çıkış, mute/unmute sesleri.
4. **Beni Hatırla & Hızlı Oda Geçmişi:** Kullanıcı adını ve son girilen 3 odayı `localStorage`'da saklama.
5. **Masaüstü Ekran Paylaşım Seçici (Desktop Source Picker):** Electron v44 ile ekran ve pencereleri önizlemeli kartlarla seçebilme.
6. **Windows Sistem Sesi Yakalama:** Ekran paylaşırken sistem sesini (oyun/video sesi) karşıya aktarma (Loopback Audio).
7. **Kişi Bazlı Ses Kontrolü:** Odadaki her katılımcının ses seviyesini ayrı ayrı %0 - %200 arasında ayarlama.
8. **Klavye Kısayolları:** `M` (Mute), `D` (Deafen), `F` (Full Screen).
9. **Oda Kilitleme:** Kilitli odalara yetkisiz girişi engelleme.
10. **GitHub Actions CI/CD:** Her `main` push işleminde otomatik `.exe` derleme ve GitHub Releases'a yükleme.

---

## 🔮 Gelecek Sürümlerde Eklenecek Özellikler (Yol Haritası & Uygulama Rehberi)

Gelecekte projeye devam ederken aşağıdaki sıralamayla geliştirmeler yapılabilir:

### 1. 🖼️ Yüzen Yayın Penceresi (Picture-in-Picture / Floating Window)
- **Amaç:** Kullanıcı oyun oynarken veya başka bir uygulamadayken arkadaşının ekran yayınını ekranın bir köşesinde küçük, her zaman üstte (Always-on-top) bir pencerede izleyebilsin.
- **Uygulama Yöntemi:**
  - **Web Tarafı:** Modern tarayıcılarda `documentPictureInPicture.requestWindow({ width: 400, height: 225 })` API'si kullanılarak yayın video elementi yeni küçük bir pencereye taşınır.
  - **Electron Tarafı:** `electron/main.js` içinde `createPiPWindow(streamUrl)` fonksiyonu tanımlanır:
    ```javascript
    const pipWin = new BrowserWindow({
      width: 420,
      height: 240,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    ```

### 2. 📊 Anlık Ağ ve Yayın İstatistikleri (Diagnostics Overlay)
- **Amaç:** Bağlantı kalitesi, gecikme (Ping), FPS ve veri akışını gösteren küçük bir HUD paneli.
- **Uygulama Yöntemi:**
  - LiveKit `Room` nesnesi üzerinden WebRTC istatistikleri dinlenir:
    ```typescript
    const stats = await participant.getPublisherStats(); // veya getSubscriberStats()
    // RTT (Ping), Packet Loss, Current Bitrate, Resolution, FrameRate
    ```
  - Sağ üst köşeye yarı saydam bir FPS/Ping rozeti eklenir.

### 3. 🎙️ Bas-Konuş (Push-to-Talk) Modu & Global Tuş Dinleyici
- **Amaç:** Mikrofonun sürekli açık kalması yerine belirli bir tuşa basılı tutulduğunda ses iletmesi.
- **Uygulama Yöntemi:**
  - Web'de `window.addEventListener('keydown')` ve `'keyup'` ile tuş basılı tutma kontrolü.
  - Masaüstünde (Electron) oyun oynarken pencere odakta olmasa bile çalışabilmesi için `globalShortcut.register('Space', ...)` veya `uIOhook` kütüphanesi ile global kısayol desteği.

### 4. 👑 Oda Yöneticisi & Moderasyon Yetkileri (Host / Moderator)
- **Amaç:** Odayı ilk açan kişinin veya yönetici olarak yetkilendirilen kişinin diğer kullanıcıları uzaktan susturabilmesi (Server Mute) veya odadan atabilmesi (Kick).
- **Uygulama Yöntemi:**
  - `src/app/api/room/moderate/route.ts` endpoint'i açılır.
  - LiveKit Server SDK `RoomServiceClient.mutePublishedTrack(room, identity, trackSid, true)` ve `RoomServiceClient.removeParticipant(room, identity)` fonksiyonları kullanılır.
  - Katılımcı kartına yöneticiye özel "Sustur" ve "Odadan Çıkar" menüsü eklenir.

### 5. 👤 Kullanıcı Avatar Sistemi & Profil Kartları (Avatar System)
- **Amaç:** Kullanıcıların giriş ekranında veya görüşme sırasında kendine özel bir avatar (anime, 3D, minimalist ikonlar veya yerel görsel) seçebilmesi; bu avatarın hem oda katılımcı kartında hem de sohbette mesajların yanında görünmesi.
- **Uygulama Yöntemi:**
  - Ana sayfada rumuz kutusunun yanına **Avatar Seçici (Avatar Picker)** galerisi eklenir (SVG / DiceBear veya yerel ikon havuzu).
  - Seçilen avatar `localStorage.setItem('voxa_avatar', avatarId)` ile kaydedilir.
  - Odaya girerken LiveKit Token metadata'sına veya `room.localParticipant.setMetadata(JSON.stringify({ avatar: avatarId }))` ile odaya yayınlanır.
  - Sol taraftaki katılımcı kartlarında ve sohbet balonlarında kullanıcı baş harfi yerine bu avatar gösterilir.

### 6. 🔍 Sohbette Görsellere Tıklayınca Büyütme (Lightbox / Fullscreen Preview Modal)
- **Amaç:** Sohbet akışında paylaşılan küçük resimlere (thumbnails) tıklandığında ekranı kaplayan karartmalı bir Lightbox modalında görseli tam boyutta ve orijinal en-boy oranıyla inceleyebilme.
- **Uygulama Yöntemi:**
  - `src/app/[roomName]/page.tsx` içerisine `activePreviewImage: string | null` state'i eklenir.
  - Sohbetteki resim kartına tıklandığında (`onClick={() => setActivePreviewImage(msg.thumbnail)}`) tam ekran modal tetiklenir:
    - Esc tuşu veya modal dışına tıklama ile kapatma.
    - Orijinal resmi yeni sekmede açma veya tek tıkla doğrudan bilgisayara kaydetme butonu.
    - İnceleme esnasında zoom/scale kontrolleri.

### 7. 🛑 P2P Dosya İndirmesini İptal Etme (Cancel Ongoing Download)
- **Amaç:** Kullanıcı büyük boyutlu bir dosyayı indirmeye başladıktan sonra vazgeçerse devam eden transferi durdurup bağlantıyı kapatabilmeli.
- **Uygulama Yöntemi:**
  - `src/lib/p2p-file-transfer.ts` içine `cancelTransfer(fileId: string)` fonksiyonu eklenir.
  - Alıcı indirme ilerleme çubuğunun yanına bir **"İptal Et (X)"** butonu yerleştirilir.
  - İptale basıldığında:
    - Gönderici tarafa LiveKit üzerinden `{ type: "p2p-cancel", fileId }` sinyali iletilir.
    - WebRTC `RTCDataChannel` ve `RTCPeerConnection` kapatılır (`pc.close()`).
    - Alıcının RAM'indeki `receivedChunks` dizisi sıfırlanarak bellek serbest bırakılır.
    - Arayüzde "İndirme İptal Edildi" bildirimi gösterilir.

### 8. 🎨 Özel Tema Seçenekleri (Cyberpunk Neon, Midnight Dark, Emerald)
- **Amaç:** Kullanıcıların sohbet ve oda arayüzü renk paletini kişiselleştirebilmesi.
- **Uygulama Yöntemi:**
  - CSS değişkenleri tabanlı tema motoru (`--bg-primary`, `--accent-glow`).

### 9. 🔒 Uçtan Uca Şifreleme (E2EE)
- **Amaç:** Ses ve video paketlerinin LiveKit sunucusu tarafından bile çözülemeyeceği sıfır bilgi (Zero-Knowledge) şifreleme.
- **Uygulama Yöntemi:**
  - `@livekit/client` kütüphanesinin yerleşik `E2EEOptions` ve Web Worker tabanlı Cryptor altyapısı aktifleştirilir.

---

## 💻 Masaüstü Uygulaması (Electron) Çalıştırma ve Build

### 1. Geliştirme Modunda Çalıştırma
```bash
npm run electron:dev
```

### 2. Windows Installer (.exe) Paketlemesi Üretme
```bash
npm run electron:build
```
*Üretilen kurulum dosyası `dist/` klasörüne kaydedilir (`Voxa Desktop Setup 1.0.3.exe`).*

---

## 📁 Proje Klasör Yapısı

```
ses/
├── .github/
│   └── workflows/
│       └── build-electron.yml  # GitHub Actions CI/CD otomatik .exe derleme & release workflow'u
├── electron/
│   ├── main.js                 # Electron ana süreci, IPC handler'ları, ekran/pencere yakalama
│   └── preload.js              # IPC ve webContext izolasyon scripti
├── src/
│   ├── app/
│   │   ├── [roomName]/
│   │   │   └── page.tsx        # Canlı görüşme odası UI, LiveKit, 2K Yayın, P2P Dosya & Resim, Sohbet
│   │   ├── api/
│   │   │   ├── download/
│   │   │   │   └── desktop/
│   │   │   │       └── route.ts# En güncel .exe indirme yönlendirme endpoint'i
│   │   │   ├── room/
│   │   │   │   └── lock/
│   │   │   │       └── route.ts# Oda kilit durumunu güncelleyen API endpoint'i
│   │   │   └── token/
│   │   │       └── route.ts    # LiveKit JWT Token üreten & Oda kilit kontrolü yapan endpoint
│   │   ├── globals.css         # Global stiller ve Tailwind importları
│   │   ├── layout.tsx          # Root layout ve Voxa metadata başlığı
│   │   └── page.tsx            # Ana sayfa odaya katılma/oluşturma ve indirme alanı
│   └── lib/
│       ├── kv.ts               # Upstash Redis / Vercel KV REST istemcisi (harici bağımlılıksız)
│       ├── livekit-pool.ts     # Çoklu LiveKit API havuzu, kota failover & oda sabitleme motoru
│       ├── p2p-file-transfer.ts# WebRTC DataChannel P2P dosya & görsel aktarım motoru
│       └── sounds.ts           # Web Audio API sentetik ses efektleri (Join, Leave, Mute)
├── .env.example                # Örnek ortam değişkenleri şablonu
├── .env.local                  # Yerel ortam değişkenleri (Git'e atılmaz)
├── package.json                # Proje bağımlılıkları, Electron ve npm komutları
└── README.md                   # Kapsamlı proje dokümantasyonu ve mimari rehber
```

---

## ⚙️ Ortam Değişkenleri Rehberi (.env.local & Netlify)

```env
# ==========================================================
# ÇOKLU LIVEKIT HESAP HAVUZU (MULTI-ACCOUNT POOL)
# ==========================================================

# 1. LiveKit Hesabı (Kotası doluysa EXHAUSTED_1=true yapılır)
LIVEKIT_API_KEY_1=your_key_1
LIVEKIT_API_SECRET_1=your_secret_1
LIVEKIT_URL_1=wss://your-first-project.livekit.cloud
LIVEKIT_EXHAUSTED_1=true

# 2. LiveKit Hesabı (Aktif)
LIVEKIT_API_KEY_2=your_key_2
LIVEKIT_API_SECRET_2=your_secret_2
LIVEKIT_URL_2=wss://your-second-project.livekit.cloud
LIVEKIT_EXHAUSTED_2=false

# 3. LiveKit Hesabı (Aktif)
LIVEKIT_API_KEY_3=your_key_3
LIVEKIT_API_SECRET_3=your_secret_3
LIVEKIT_URL_3=wss://your-third-project.livekit.cloud
LIVEKIT_EXHAUSTED_3=false

# Varsayılan LiveKit URL
NEXT_PUBLIC_LIVEKIT_URL=wss://your-first-project.livekit.cloud

# ==========================================================
# UPSTASH REDIS / VERCEL KV (İsteğe Bağlı ama Önerilir)
# ==========================================================
# Tanımlandığında odalar ve kota durumları Redis üzerinde önbelleğe alınır.
KV_REST_API_URL=https://your-upstash-redis.upstash.io
KV_REST_API_TOKEN=your_upstash_rest_token

# ==========================================================
# UYGULAMA VE İNDİRME AYARLARI
# ==========================================================
NEXT_PUBLIC_APP_URL=https://ses.app.noticq.com
DESKTOP_DOWNLOAD_URL=https://github.com/AYEDEV0/sesli/releases
```
