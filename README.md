# 🎙️ Voxa - Yapay Zekâ Destekli Sesli Görüşme ve Ekran Paylaşım Platformu

**Voxa**, Next.js 14, LiveKit ve Krisp AI altyapısı kullanılarak geliştirilmiş, tarayıcı üzerinden yüksek kaliteli sesli görüşme, kamera yayını, ekran paylaşımı ve anlık mesajlaşma sunan modern bir web uygulamasıdır.

---

## 📌 Projenin Amacı ve Temel Odak Noktaları

- **Hızlı ve Kolay Bağlantı:** Kullanıcıların herhangi bir kayıt/üyelik gereksinimi olmadan sadece kullanıcı adı ve oda ismi girerek anında sesli kanallara katılabilmesi.
- **Yapay Zekâ Gürültü Engelleme (Krisp AI):** Görüşme esnasındaki arka plan gürültülerini, klavye seslerini, fan gürültüsünü ve yankıyı tarayıcı tarafında (WebAssembly) otomatik olarak filtreleme.
- **Kesintisiz Ekran Paylaşımı & Kamera:** Yüksek çözünürlüklü ekran ve kamera yayını.
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

### 1. Ses & Filtre Özellikleri
- **Varsayılan Krisp AI Filtresi:** Odaya girildiğinde ve mikrofon açıldığında AI Gürültü Filtresi **otomatik olarak AÇIK** olarak başlatılır.
- **Ayarlar Menüsü:** Alt bar üzerindeki **Dişli (Gear / Settings)** ikonu ile açılan Ses Ayarları penceresi üzerinden Krisp filtresi istenildiği an kapatılabilir veya tekrar açılabilir.
- **Görsel Durum Göstergesi:** Ayarlar butonunun üzerinde filtenin aktifliğini belirten canlı yeşil rozet ve durum yazısı.

### 2. Görüşme ve Medya Kontrolleri
- **Mikrofon & Kamera Geçişi:** Tek tıkla kapatıp açabilme.
- **Ekran Paylaşımı:** Tek tıkla ekran veya uygulama penceresi paylaşabilme.
- **Tam Ekran Modu:** Seçilen ekran yayınını veya katılımcıyı tam ekranda izleme.
- **Davet Bağlantısı Kopyalama:** Oda ismini ve katılımcı linkini panoya tek tıkla kopyalama.

### 3. Kullanıcı Arayüzü ve Sohbet
- **Varsayılan Kapalı Metin Sohbeti:** Sağ paneldeki sohbet ekranı odaya girildiğinde kapalı başlar, istendiğinde `Sohbet` butonuna basılarak açılır.
- **Marka & Favicon:** Sade **Voxa** ismi ve özel olarak oluşturulmuş SVG tarayıcı ikonu (favicon).

---

## 📁 Proje Klasör Yapısı

```
ses/
├── public/
├── src/
│   ├── app/
│   │   ├── [roomName]/
│   │   │   └── page.tsx        # Canlı görüşme odası UI, LiveKit & Krisp AI kontrolü
│   │   ├── api/
│   │   │   └── token/
│   │   │       └── route.ts    # LiveKit JWT Token üreten sunucu endpoint'i
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

---

## 🔮 Gelecek Geliştirme Önerileri (Roadmap)

İleride projeye eklenebilecek olası geliştirmeler:
1. **Bireysel Ses Düzeyi Sürgüsü:** Katılımcı listesinde her kullanıcının sesini ayrı ayrı artırıp azaltabilme.
2. **Bas-Konuş (Push-to-Talk):** Belirli bir tuşa basılı tutulduğunda mikrofonun açılması.
3. **Kullanıcı Avatarları:** Giriş ekranında profil resmi/avatar seçme opsiyonu.
4. **Ses Seviyesi Göstergesi (Audio Indicator):** Konuşan kişinin etrafında yeşil harelenme efekti.
