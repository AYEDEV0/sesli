# 🎙️ Voxa - Yapay Zekâ Destekli Sesli Görüşme ve Ekran Paylaşım Platformu

**Voxa**, Next.js 14, LiveKit, Krisp AI ve Electron altyapısı kullanılarak geliştirilmiş; tarayıcı (Web) ve Masaüstü Uygulaması (`.exe`) üzerinden kesintisiz sesli görüşme, HD/2K 60 FPS ekran & uygulama yayıncılığı, sistem sesi aktarımı, oda kilitleme, kişi bazlı bağımsız ses kontrolü, AI gürültü engelleme ve anlık mesajlaşma sunan modern bir hibrit iletişim platformudur.

---

## 📌 Projenin Amacı ve Temel Odak Noktaları

- **Hızlı ve Üyeliksiz Katılım:** Kullanıcıların karmaşık kayıt süreçleriyle uğraşmadan yalnızca Rumuz (Kullanıcı Adı) ve Oda İsmi ile anında sesli kanallara katılabilmesi.
- **Yapay Zekâ Gürültü Engelleme (Krisp AI):** Görüşme esnasındaki arka plan gürültülerini, klavye seslerini, fan gürültüsünü ve yankıyı tarayıcı/uygulama tarafında (WebAssembly) otomatik olarak filtreleme.
- **2K 60 FPS Ekran Paylaşımı & Sistem Sesi:** 720p, 1080p ve 2K (1440p 60 FPS) çözünürlüğe kadar yüksek kaliteli ekran/pencere paylaşımı ve oyun/sistem sesi yayınlama (Desktop Loopback).
- **Discord Tarzı Masaüstü Uygulaması (Electron v44):** Engelsiz masaüstü deneyimi, otomatik pencere seçici modalı, sistem genelinde ses yakalama ve panoya güvenli kopya alma desteği.
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
| **Gürültü Filtresi**      | `@livekit/krisp-noise-filter` (Krisp WebAssembly AI Noise Suppression)                |
| **CI/CD & Release**       | GitHub Actions (`build-electron.yml`), `softprops/action-gh-release@v2`               |

---

## 🌟 Tamamlanan Özellikler ve Güncel Durum (v1.0.2)

### 1. 🖥️ Masaüstü Ekran Paylaşım Seçici Modalı (Desktop Source Picker)
- Masaüstü uygulamasında ekran paylaşımına basıldığında tüm aktif pencereler ve ekranlar canlı önizlemeli kartlar olarak listelenir.
- Kullanıcı _"Tüm Ekran (Entire Screen)"_ veya _"Spesifik Uygulama / Oyun Penceresi"_ arasında seçim yapabilir.
- Windows işletim sisteminde ekran sesi (loopback audio) otomatik yakalanır.

### 2. 🎧 Gelişmiş Aygıt Seçimi & Ses Kontrolü
- **Aygıt Seçicileri (Media Device Selectors):** Kullanıcının kullanmak istediği **Mikrofon Aygıtını (Input Device)** ve **Hoparlör / Kulaklık Aygıtını (Output Device)** canlı görüşme esnasında değiştirebilmesi (`useMediaDeviceSelect`).
- **Kişi Bazlı Ses Kontrolü:** Katılımcı kartındaki ses sürgüsü (%0 - %200) ile her kullanıcının sesi bağımsız ayarlanabilir.
- **Sağırlaştırma (Deafen) Butonu:** Tek tıkla hem kendi mikrofonunu kapatıp hem de gelen tüm oda seslerini tamamen sessize alan buton (Kısayol: `D`).

### 3. ⌨️ Klavye Kısayolları (Keybindings)
- `M`: Mikrofon Aç / Kapat (Toggle Mute)
- `D`: Kulaklık / Gelen Sesleri Aç / Kapat (Toggle Deafen)
- `F`: Tam Ekran Moduna Geç / Çık (Full Screen Toggle)

### 4. 🔗 Kesintisiz Davet Linki Kopyalama
- Hem Web hem Electron ortamında `https://ses.app.noticq.com/[roomName]` formatındaki oda davet linki güvenli IPC ve clipboard API'leri ile sorunsuz kopyalanır.

### 5. 💬 Anlık Sohbet & Okunmamış Mesaj Rozet Bildirimi
- Seçilebilir sohbet metni (`select-text`).
- Sohbet çekmecesi kapalıyken gelen yeni mesajlar için dinamik **Okunmamış Mesaj Sayacı (Badge Count)**. Sohbet açıldığında sayaç otomatik sıfırlanır.

### 6. 🚀 Otomatik Güncelleme & Dinamik İndirme API'si (`/api/download/desktop`)
- `/api/download/desktop` rotası GitHub Releases API'sini (`AYEDEV0/sesli`) canlı sorgulayarak her zaman en son yayınlanan `.exe` kurulum dosyasının doğrudan indirme bağlantısını döner.
- Masaüstü uygulaması `electron-updater` ile arka planda yeni versiyonları denetler.

---

## 🔮 Gelecek Sürümlerde Eklenecek Özellikler (Yol Haritası)

### 1. 🖼️ Yüzen Yayın Penceresi (Picture-in-Picture / Floating Window)
- Başka uygulamalarla veya oyunlarla ilgilenirken arkadaşınızın ekran yayınını veya kamerasını ekranın bir köşesinde küçük, her zaman üstte (Always-on-top) yüzen pencerede izleyebilme.

### 2. 📊 Anlık Ağ ve Yayın İstatistikleri (Ping, FPS, Bitrate Panel)
- Bağlantı kalitesini ve gecikmeyi gösteren canlı gösterge (Ping ms, Packet Loss, Resolution, Frame Rate).

### 3. 🎙️ Bas-Konuş (Push-to-Talk) Modu
- Sabit mikrofon açık kalması yerine basılı tutulduğunda konuşmayı sağlayan Bas-Konuş mod tuşu desteği.

### 4. 👑 Oda Yöneticisi Rolleri (Host / Moderator Controls)
- Odayı oluşturan kişinin diğer katılımcıları susturabilmesi (Server Mute) veya odadan çıkarabilmesi (Kick).

### 5. 🎨 Özel Tema Seçenekleri ve Profil Özelleştirme
- Kullanıcı avatarı seçimi, renk temaları (Cyberpunk, Midnight Dark, Neon Blue) ve kişisel durum mesajı.

---

## 💻 Masaüstü Uygulaması (Electron) Çalıştırma ve Build

### 1. Masaüstü Uygulamasını Geliştirme Modunda Çalıştırma
```bash
npm run electron:dev
```

### 2. Windows Installer (.exe) Paketlemesi Üretme
```bash
npm run electron:build
```
*Üretilen kurulum dosyası `dist/` klasörüne kaydedilir (`Voxa Desktop Setup 1.0.2.exe`).*

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
│   │   │   └── page.tsx        # Canlı görüşme odası UI, LiveKit, 2K Yayın, Source Picker, Sohbet
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
├── .env.local                  # LiveKit API Key & Secret ortam değişkenleri
├── package.json                # Proje bağımlılıkları, Electron ve npm komutları
└── README.md                   # Proje dokümantasyonu
```

---

## ⚙️ Ortam Değişkenleri (.env.local)

```env
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
```
