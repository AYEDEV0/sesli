# 🎙️ Voxa - Yapay Zekâ Destekli Sesli Görüşme ve Ekran Paylaşım Platformu

**Voxa**, Next.js 14, LiveKit, Krisp AI ve Electron altyapısı kullanılarak geliştirilmiş, tarayıcı ve masaüstü uygulaması üzerinden yüksek kaliteli sesli görüşme, kamera yayını, 2K ekran paylaşımı, oda kilitleme, kişi bazlı ses kontrolü ve anlık mesajlaşma sunan modern bir hibrit platformdur.

---

## 📌 Projenin Amacı ve Temel Odak Noktaları

- **Hızlı ve Kolay Bağlantı:** Kullanıcıların herhangi bir kayıt/üyelik gereksinimi olmadan sadece kullanıcı adı ve oda ismi girerek anında sesli kanallara katılabilmesi.
- **Yapay Zekâ Gürültü Engelleme (Krisp AI):** Görüşme esnasındaki arka plan gürültülerini, klavye seslerini, fan gürültüsünü ve yankıyı tarayıcı tarafında (WebAssembly) otomatik olarak filtreleme.
- **2K 60 FPS Ekran Paylaşımı & Sistem Sesi:** 720p, 1080p ve 2K (1440p 60 FPS) çözünürlüğe kadar yüksek kaliteli ekran paylaşımı ve sekme/sistem sesi yayınlama.
- **Discord Tarzı Masaüstü Uygulaması (Electron):** Hem Web tarayıcısından hem de bilgisayara kurulan masaüstü uygulaması (`.exe`) üzerinden engelsiz ekran ve oyun içi ses paylaşımı yapabilme.
- **Kişiselleştirilmiş Ses Kontrolü:** Odadaki diğer kullanıcıların seslerini kişisel olarak bağımsız şekilde (%0 - %200) kısabilme, artırabilme veya kapatabilme.
- **Güvenli Oda Kilitleme (Room Lock):** Odadaki katılımcıların isteğe bağlı olarak odayı kilitleyebilmesi ve kilitli odalara dışarıdan rastgele katılımı engelleme.
- **Modern ve Koyu Tema (Discord Style UI):** Kullanıcı dostu, göz yormayan, dinamik ve estetik kullanıcı arayüzü.

---

## 🛠️ Kullanılan Teknolojiler

| Bileşen                   | Teknolojiler                                                                          |
| :------------------------ | :------------------------------------------------------------------------------------ |
| **Framework**             | Next.js 14 (App Router), React 18                                                     |
| **Masaüstü Altyapısı**    | Electron 44, Electron Builder                                                         |
| **Programlama Dili**      | TypeScript, JavaScript (ES6+)                                                         |
| **Stil & Tasarım**        | Tailwind CSS, Lucide Icons, Custom CSS                                                |
| **Canlı Medya Altyapısı** | LiveKit Web SDK (`@livekit/components-react`, `livekit-client`, `livekit-server-sdk`) |
| **Gürültü Filtresi**      | `@livekit/krisp-noise-filter` (Krisp WebAssembly AI Noise Suppression)                |
| **Dağıtım (Deployment)**  | Netlify (GitHub CI/CD otomatik yayına alma)                                           |

---

## 🌟 Tamamlanan Özellikler ve Güncel Durum

### 1. 🔊 Kullanıcı Bazlı Ses Kontrolü (Per-User Volume Control & Mute)

- Katılımcı panelindeki her kullanıcı kartı altında yer alan **Ses Sürgüsü (%0 - %200)** ile her kişinin sesi bireysel olarak ayarlanabilir.
- Tek tıkla herhangi bir uzak katılımcının sesini sessize alma (Mute) / sesini açma.

### 2. 🖥️ Ultra HD 2K 60 FPS Ekran Paylaşımı & Yayın Sesi

- **Yayın Kalitesi Seçici (Quality Presets):**
  - ⚡ **Performans Modu:** 720p @ 30 FPS (1.5 Mbps)
  - 🎬 **Standart Mod:** 1080p @ 30 FPS (3.0 Mbps)
  - 🚀 **Yüksek Hız Modu:** 1080p @ 60 FPS (4.5 Mbps)
  - 🔥 **Ultra 2K Sinematik Mod:** 2K (1440p) @ 60 FPS (7.0 Mbps)
- **Ekran Sesi Yayınlama:** Sekme ve sistem seslerini canlı yayına dahil edebilme.
- **Ekran Sesi Kontrolü:** Ana sahne (Stage) üzerinde yayın sesini kısma/açma ve kapatabilme (%0 - %200).

### 3. 🔒 Güvenli Oda Kilitleme (Room Lock)

- Header üzerindeki **"Odayı Kilitle / Kilitli Oda"** butonu ile oda anında kilitlenebilir.
- Oda kilitlendiğinde yeni katılan kullanıcılar için `/api/token` servisi `403 Forbidden` engeli uygular.
- Tüm katılımcılar arasında oda kilit durumu gerçek zamanlı olarak senkronize edilir.

### 4. 🎙️ Yapay Zekâ Gürültü Engelleme (Krisp AI)

- Odaya girildiğinde ve mikrofon açıldığında AI Gürültü Filtresi **otomatik olarak AÇIK** olarak başlatılır.
- **Ayarlar Menüsü:** Alt bar üzerindeki **Ayarlar (Gear/Sliders)** ikonu üzerinden Krisp filtresi ve yayın kalite tercihleri yönetilebilir.

### 5. 💻 Masaüstü Uygulaması & Doğrudan İndirme (Electron & Web Hybrid)

- Ana sayfa ve ayarlar menüsünde yer alan **"Masaüstü Uygulamasını İndir (.exe)"** butonu ile doğrudan güncel sürüm indirilebilir.
- Masaüstü uygulaması açıldığında ortamı otomatik algılar ve güncellik durumunu ayarlar menüsünde bildirir.
- Üretim modunda otomatik olarak canlı Netlify sunucusuna (`https://ekkran.netlify.app`) bağlanır.

### 6. 💬 Sohbet Mesajı Seçme ve Kopyalama

- Oda içi sohbet paneli metin seçilebilir (`select-text`) hale getirilmiştir.
- Kullanıcılar mesajları fare ile seçebilir, doğrudan kopyalayabilir veya tarayıcıda aratabilir.

---

## 🔮 Gelecek Sürümlerde Eklenecek Özellikler (Planlanan Yol Haritası)

### 1. 🖥️ Masaüstü Ekran Paylaşımı Seçim Modalı (Desktop Screen/Window & Sound Picker)

- **Kaynak Seçim Menüsü:** Masaüstü uygulamasında ekran paylaşımı butonuna basıldığında doğrudan tüm ekranı vermek yerine Discord benzeri bir seçim penceresi (Modal) açılacaktır.
- **Ekran vs Pencere Seçimi:** Kullanıcıya _"Tüm Ekran (Entire Screen)"_ mi yoksa _"Spesifik Uygulama / Oyun Penceresi (Application Window)"_ mi yayınlamak istediği sorulacaktır.
- **Sesli / Sessiz Yayın Tercihi:** Yayın başlatılmadan önce ekran sesinin de aktarılıp aktarılmayacağı _"Sesli / Sessiz"_ olarak kullanıcıya sorulacaktır.

  ** masaüstü uygulamada tam ekran çalışmıyor
  ** masaüstü uygulamada link paylaşma davet çalışmıyor

### 2. 🎧 Gelişmiş Ses ve Aygıt Yönetimi (Audio & Device Settings)

- **Giriş ve Çıkış Aygıtı Seçimi (Media Device Selectors):**
  - Kullanıcının kullanmak istediği **Mikrofon Aygıtını (Input Device)** Ayarlar menüsünden değiştirebilmesi.
  - Sesteki çıkışın verileceği **Hoparlör / Kulaklık Aygıtını (Output Device)** dinamik seçebilmesi.
- **Kendi Ses Seviyesi ve Yan Ton (Mic Gain & Side Tone / Test):**
  - Kullanıcının kendi mikrofon kazancını (Input Volume) ayarlayabilmesi.
  - Mikrofon test alanı ve kendi sesini kulaklığa geri alma (Mic Feedback / Side Tone) kontrolü.

### 💡 Antigravity AI Tarafından Önerilen Ek Özellikler

- 🔇 **Sağırlaştırma (Deafen) Butonu:** Tek tıkla hem mikrofonu hem de odadaki tüm diğer katılımcıların sesini anında kapatabilme (Discord Deafen tarzı).
- 🎙️ **Bas-Konuş (Push-to-Talk) & Kısayol Tuşları (Keybindings):** Bas-konuş modu ve sistem genelinde çalışan global kısayol tuşları (Mute/Deafen toggle).
- 🖼️ **Yüzen Yayın Penceresi (Picture-in-Picture / Floating Window):** Başka işlerle uğraşırken arkadaşınızın yayınını ekranın bir köşesinde küçük yüzen pencerede izleme.
- 📊 **Anlık Ağ ve Yayın İstatistikleri (Ping, FPS, Bitrate Panel):** Bağlantı gecikmesini (Ping ms), yayın çözünürlüğünü, FPS değerini ve anlık bant genişliğini gösteren istatistik paneli.
- 🔄 **Masaüstü Otomatik Güncelleme (Electron Auto-Updater):** Masaüstü uygulamasının yeni sürümlerini açılışta otomatik denetleyip arka planda güncelleyen altyapı.

---

## 🗺️ Proje Bağlantı Mantığı ve Düzeltme Yol Haritası

### 🔗 Bağlantı & Çalışma Mantığı

1. **Giriş ve Yönlendirme (`/`):** Kullanıcı adı ve oda adı alınıp URL parametreleriyle `/[roomName]?username=...` rotasına yönlendirilir.
2. **Token Oluşturma (`/api/token`):** Oda yüklenirken sunucu tarafında LiveKit API Key ve Secret kullanılarak güvenli JWT Token üretilir. Oda kilitli ise `403 Forbidden` ile katılım engellenir.
3. **Canlı Odaya Bağlantı (`LiveKitRoom`):** Token ile LiveKit WebSocket sunucusuna bağlanılır. Sesli iletişim, video, ekran paylaşımı ve sohbet kanalları aktif edilir.
4. **Ekran & Ses Akışı:** WebRTC `getDisplayMedia` protokolü üzerinden 2K 60 FPS'e kadar görüntü ve sistem/sekme sesi yayınlanır.

### 🛠️ Yapılan Düzeltmeler Yol Haritası

- [x] **Masaüstü & Web Ekran Paylaşımı Ses Aktarımı Düzeltmesi:** Masaüstü uygulamasında ekran paylaşımı yaparken sistem sesi (loopback) aktarma sorunu ve WebRTC yayın ses kanalı bağlama hataları giderildi (`electron/main.js`).
- [x] **Masaüstü Ekran & Pencere Seçim Modalı (Desktop Source Picker):** Masaüstü uygulamasında ekran paylaşımına basıldığında tüm aktif pencerelerin ve ekranların önizlemeli görsel listesini sunan seçim penceresi entegre edildi.
- [x] **Aygıt Yönetimi (Mikrofon ve Hoparlör Seçicileri):** Ayarlar menüsüne kullanıcının mikrofonunu (Input Device) ve kulaklığını/hoparlörünü (Output Device) dinamik olarak değiştirebileceği seçiciler eklendi (`useMediaDeviceSelect`).
- [x] **Sağırlaştırma (Deafen) Butonu:** Discord tarzı tek tıkla hem mikrofonu kapatan hem de gelen tüm oda seslerini tamamen sessize alan buton eklendi (Kısayol: `D`).
- [x] **Kısayol Tuşları (Keybindings):** Mikrofon açma/kapatma (`M`), Sağırlaştırma (`D`) ve Tam Ekran (`F`) klavye kısayolları eklendi.
- [x] **Davet Linki Kopyalama Düzeltmesi:** Masaüstü ve Web ortamında oda davet linklerinin doğru yönlendirme adresi ile panoya kopyalanması sağlandı.
- [x] **Masaüstü Otomatik Güncelleme (Electron Auto-Updater):** GitHub Releases entegrasyonu ve `electron-updater` ile yeni `.exe` sürümlerini otomatik kontrol edip sessiz indiren altyapı kuruldu.

---

## 💻 Masaüstü Uygulaması (Electron) Çalıştırma ve Build

### 1. Masaüstü Uygulamasını Geliştirme Modunda Çalıştırma

```bash
npm run electron:dev
```

_Bu komut hem Next.js sunucusunu hem de Electron masaüstü penceresini aynı anda başlatır._

### 2. Windows Installer (.exe) Paketlemesi Üretme

```bash
npm run electron:build
```

Üretilen kurulum dosyası `dist/` klasörü altına kaydedilecektir (`Voxa Desktop Setup 1.0.0.exe`).

---

## 📁 Proje Klasör Yapısı

```
ses/
├── electron/
│   ├── main.js                 # Electron ana süreci, pencere yönetimi & medya izinleri
│   └── preload.js              # IPC ve webContext izolasyon scripti
├── public/
│   ├── downloads/              # İndirilebilir medya ve uygulama konumları
│   └── icon.svg                # Özel Voxa Favicon ikonu
├── src/
│   ├── app/
│   │   ├── [roomName]/
│   │   │   └── page.tsx        # Canlı görüşme odası UI, LiveKit, 2K Yayın, Ses Kontrolü, Sohbet
│   │   ├── api/
│   │   │   ├── download/
│   │   │   │   └── desktop/
│   │   │   │       └── route.ts# Masaüstü .exe indirme yönlendirme endpoint'i
│   │   │   ├── room/
│   │   │   │   └── lock/
│   │   │   │       └── route.ts# Oda kilit durumunu güncelleyen API endpoint'i
│   │   │   └── token/
│   │   │       └── route.ts    # LiveKit JWT Token üreten & Oda kilit kontrolü yapan endpoint
│   │   ├── globals.css         # Global stiller ve Tailwind importları
│   │   ├── layout.tsx          # Root layout ve Voxa metadata başlığı
│   │   └── page.tsx            # Ana sayfa odaya katılma/oluşturma ve indirme alanı
├── .env.local                  # LiveKit API Key & Secret & Download URL ortam değişkenleri
├── netlify.toml                # Netlify deployment konfigürasyonu
├── package.json                # Proje bağımlılıkları, Electron ve npm komutları
└── README.md                   # Proje dokümantasyonu (Bu dosya)
```

---

## ⚙️ Ortam Değişkenleri (.env.local)

Projenin çalışması için `.env.local` dosyasının veya Netlify panelinin aşağıdaki anahtarları içermesi gerekir:

```env
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
DESKTOP_DOWNLOAD_URL=https://github.com/AYEDEV0/indirme/releases/download/v1Ses/Voxa.Desktop.Setup.1.0.0.exe
```

---

## 🚀 Geliştirme ve Çalıştırma

### 1. Bağımlılıkları Yükleme

```bash
npm install
```

### 2. Geliştirme Sunucusunu Başlatma (Web)

```bash
npm run dev
```

Uygulamaya tarayıcıdan `http://localhost:3000` adresinden erişebilirsiniz.

### 3. Production Build Testi

```bash
npm run build
```
