# 🎙️ Voxa - Yapay Zekâ Destekli Sesli Görüşme ve Ekran Paylaşım Platformu

**Voxa**, Next.js 14, LiveKit ve Krisp AI altyapısı kullanılarak geliştirilmiş, tarayıcı üzerinden yüksek kaliteli sesli görüşme, kamera yayını, 2K ekran paylaşımı, oda kilitleme, kişi bazlı ses kontrolü ve anlık mesajlaşma sunan modern bir web uygulamasıdır.

---

## 📌 Projenin Amacı ve Temel Odak Noktaları

- **Hızlı ve Kolay Bağlantı:** Kullanıcıların herhangi bir kayıt/üyelik gereksinimi olmadan sadece kullanıcı adı ve oda ismi girerek anında sesli kanallara katılabilmesi.
- **Yapay Zekâ Gürültü Engelleme (Krisp AI):** Görüşme esnasındaki arka plan gürültülerini, klavye seslerini, fan gürültüsünü ve yankıyı tarayıcı tarafında (WebAssembly) otomatik olarak filtreleme.
- **2K 60 FPS Ekran Paylaşımı & Sistem Sesi:** 720p, 1080p ve 2K (1440p 60 FPS) çözünürlüğe kadar yüksek kaliteli ekran paylaşımı ve sekme/sistem sesi yayınlama.
- **Kişiselleştirilmiş Ses Kontrolü:** Odadaki diğer kullanıcıların seslerini kişisel olarak bağımsız şekilde (%0 - %200) kısabilme, artırabilme veya kapatabilme.
- **Güvenli Oda Kilitleme (Room Lock):** Odadaki katılımcıların isteğe bağlı olarak odayı kilitleyebilmesi ve kilitli odalara dışarıdan rastgele katılımı engelleme.
- **Modern ve Koyu Tema (Discord Style UI):** Kullanıcı dostu, göz yormayan, dinamik ve estetik kullanıcı arayüzü.

---

## 🛠️ Kullanılan Teknolojiler

| Bileşen | Teknolojiler |
| :--- | :--- |
| **Framework** | Next.js 14 (App Router), React 18 |
| **Programlama Dili** | TypeScript |
| **Stil & Tasarım** | Tailwind CSS, Lucide Icons, Custom CSS |
| **Canlı Medya Altyapısı**| LiveKit Web SDK (`@livekit/components-react`, `livekit-client`, `livekit-server-sdk`) |
| **Gürültü Filtresi** | `@livekit/krisp-noise-filter` (Krisp WebAssembly AI Noise Suppression) |
| **Dağıtım (Deployment)** | Netlify (GitHub CI/CD otomatik yayına alma) |

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

---

## 📁 Proje Klasör Yapısı

```
ses/
├── public/
├── src/
│   ├── app/
│   │   ├── [roomName]/
│   │   │   └── page.tsx        # Canlı görüşme odası UI, LiveKit, 2K Yayın, Ses Kontrolü
│   │   ├── api/
│   │   │   ├── room/
│   │   │   │   └── lock/
│   │   │   │       └── route.ts# Oda kilit durumunu güncelleyen API endpoint'i
│   │   │   └── token/
│   │   │       └── route.ts    # LiveKit JWT Token üreten & Oda kilit kontrolü yapan endpoint
│   │   ├── globals.css         # Global stiller ve Tailwind importları
│   │   ├── icon.svg            # Özel Voxa Favicon ikonu
│   │   ├── layout.tsx          # Root layout ve Voxa metadata başlığı
│   │   └── page.tsx            # Ana sayfa odaya katılma/oluşturma formu
├── .env.local                  # LiveKit API Key & Secret ortam değişkenleri
├── netlify.toml                # Netlify deployment konfigürasyonu
├── package.json                # Proje bağımlılıkları ve npm komutları
└── README.md                   # Proje dokümantasyonu (Bu dosya)
```

---

## ⚙️ Ortam Değişkenleri (.env.local)

Projenin çalışması için kök dizinde `.env.local` dosyasının aşağıdaki anahtarları içermesi gerekir:

```env
LIVEKIT_API_KEY=APIMeQAiA25GGbH
LIVEKIT_API_SECRET=TZ3Nz3EafbzhOr5NQnHQ5v3EKO1xRiQMjMSvlm6D7BU
NEXT_PUBLIC_LIVEKIT_URL=wss://sesli-rq0ve8k0.livekit.cloud
```

---

## 🚀 Geliştirme ve Çalıştırma

### 1. Bağımlılıkları Yükleme
```bash
npm install
```

### 2. Geliştirme Sunucusunu Başlatma
```bash
npm run dev
```
Uygulamaya tarayıcıdan `http://localhost:3000` adresinden erişebilirsiniz.

### 3. Production Build Testi
```bash
npm run build
```
