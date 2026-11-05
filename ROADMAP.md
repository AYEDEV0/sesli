# 🚀 Voxa - Geliştirme Durumu, Yapılanlar ve Gelecek Yol Haritası (Roadmap)

Bu belge; Voxa projesinde bugüne kadar tamamlanan tüm mimari yenilikleri, teknik çözümleri ve projeye devam edildiğinde sırasıyla hayata geçirilecek yeni özellikleri, teknik uygulama adımlarını ve kontrol listesini (checklist) içerir.

---

## ✅ Tamamlanan Özellikler ve Hata Çözümleri (Son Güncelleme)

### 1. 🔊 Ekran ve Pencere Yayınlarında Ses İletimi Düzeltildi
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - **Tarayıcı Tarafı:** `getDisplayMedia` parametrelerine `systemAudio: "include"` ve `suppressLocalAudioPlayback: false` eklendi.
  - **Ayrı HTMLAudioElement:** `RoomAudioRenderer`'a bağımlı kalmadan, `ScreenShareAudio` track'ini doğrudan gizli bir `<audio ref={screenShareAudioElRef} playsInline autoPlay />` elementine `track.attach()` ile bağlayan özel bir dinleme mekanizması kuruldu.
  - **Abonelik Garantisi:** Uzak ekran ses track'i odaya düştüğü anda `setSubscribed(true)` tetiklenerek sesin beklemeden çalması sağlandı.
  - **Yankı Koruması:** Yayın açan kişinin kendi ekran sesini kendi hoparlöründen tekrar duymaması için `isLocal` filtrelemesi uygulandı.

### 2. 💻 Masaüstü (Electron) Belirli Pencere/Uygulama Paylaşımında Ses Aktarımı
- [x] **Durum:** Tamamlandı
- **Sorun:** Masaüstü uygulamasında kullanıcı tam ekran yerine belirli bir pencereyi (Spotify, oyun, VLC, YouTube penceresi vb.) paylaştığında ses karşıya gitmiyordu (`audio: undefined` oluyordu) ve seçilen pencere yerine varsayılan ilk monitör paylaşılıyordu.
- **Yapılanlar:**
  - `electron/preload.js` içine `selectDesktopSource(sourceId)` IPC köprüsü eklendi.
  - `electron/main.js` içine `pendingDesktopSourceId` hafızası eklendi. Kullanıcı arayüzde hangi pencereye tıklarsa Electron `desktopCapturer` tam olarak o pencereyi yakalar.
  - `setDisplayMediaRequestHandler` içerisinde ekran veya pencere fark etmeksizin `audio: "loopback"` her zaman aktif kılındı. Windows'un WASAPI loopback ses sistemi sayesinde paylaşılan uygulamanın/pencerenin sesi karşıya eksiksiz iletiliyor.

### 3. 📺 Çoklu Yayın Desteği & "Yayını İzle / Yayından Ayrıl" Seçenekleri
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - Odada birden fazla kişi aynı anda ekran paylaşabilir hale getirildi (`screenShareTracks`).
  - Sahnede yayıncıların isimleriyle şık bir sekme çubuğu eklendi; kullanıcılar tek tıkla yayınlar arasında geçiş yapabilir.
  - **Yayından Ayrıl Butonu:** Sahnede ve katılımcı kartında yer alan butonla kullanıcı sesli odadan kopmadan video akışını durdurarak sadece ses moduna geçebilir (bilgisayar donanımını yormaz, kota tasarrufu sağlar).
  - **Yayını İzle Butonu:** Yayını izlemeyen kullanıcılara sahnede yüzen *"1 Aktif Yayın Var — Yayını İzle"* hap bildirimi ve katılımcı listesinde *"İzle"* butonu eklendi.

### 4. ⚡ AV1 Video Codec Entegrasyonu (Kota Tasarrufu)
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - Hem `<LiveKitRoom>`'un `publishDefaults` ayarlarına hem de `toggleScreenShare` ekran paylaşım seçeneklerine `videoCodec: "av1"` ve `backupCodec: true` (VP8 geri dönüş desteği) tanımlandı.
  - AV1, VP8 ve H.264'e göre %30-%50 daha az bant genişliği tüketir. LiveKit Cloud aylık kota tüketimini ciddi oranda geciktirir.

### 5. 👤 Kullanıcı Avatar Sistemi (Kalıcı LocalStorage + Gerçek Zamanlı Senkronizasyon)
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - `src/lib/avatars.ts` yardımcı modülü oluşturuldu: 6 modern SVG hazır avatar + HTML5 Canvas ile seçilen fotoğrafları 128x128 WebP/JPEG formatında sıkıştıran fonksiyon (`compressAndCropAvatar`).
  - Avatar kullanıcının cihazında `localStorage` (`voxa_user_avatar`) içinde saklanır; sayfa yenilense de uygulama kapatılsa da kullanıcı hatırlanır.
  - **Yetki Çözümü:** `livekit-pool.ts` içinde `AccessToken` grants alanına `canUpdateOwnMetadata: true` yetkisi eklendi (bu yetki olmadan LiveKit Cloud istemci metadata güncellemelerini reddediyordu).
  - **0 Gecikmeli Senkronizasyon:** Avatar seçildiği an ("Kaydet" butonuna basmaya gerek kalmadan) hem LiveKit metadata'sına yazılır hem de DataChannel (`VOXA_AVATAR`) ile anında tüm katılımcılara fırlatılır. Yeni katılanlar için `VOXA_AVATAR_REQ` otomatik talep döngüsü kuruldu.
  - Katılımcı kartlarında, sol alttaki kullanıcı profil çubuğunda ve sohbet mesaj balonlarında dinamik avatar gösterimi sağlandı.

### 6. 🔍 Sohbette Görsellere Tıklayınca Büyütme (Lightbox Modal)
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - Sohbette paylaşılan veya panodan yapıştırılan (Ctrl+V) resimlerin küçük önizlemesine tıklandığında tam ekran, kararık arka planlı (`backdrop-blur-md`) bir Lightbox modalı açılması sağlandı.
  - Modal üzerinde orijinal görseli indirme butonu, kapatma (`X`) butonu ve `Esc` tuşu ile kapatma desteği entegre edildi.

### 7. 🛑 P2P Dosya İndirmesini İptal Etme
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - `src/lib/p2p-file-transfer.ts` içine `cancelTransfer(fileId, peerIdentity)` metodu eklendi.
  - Karşı tarafa `P2P_CANCEL` sinyali gönderilerek gönderim durdurulur ve WebRTC PeerConnection ile tampon bellekler serbest bırakılır.
  - Sohbette devam eden indirme kartının yanına kırmızı renkli bir İptal (`X`) butonu eklendi.

### 8. 🩹 Yerel (Aynı Bilgisayarda) P2P Dosya İndirme Hata Çözümü
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - Aynı bilgisayarda iki sekme ile test edildiğinde WebRTC host ICE adaylarının 5-10 ms içinde gelmesi nedeniyle `pc.remoteDescription` hazır olmadan çağrılan `addIceCandidate` çağrılarının düşmesi engellendi (`pendingCandidates` tampon kuyruğu).
  - Aynı tarayıcı oturumunda yapılan testler için anında yerel bellekten (`localFilesStore`) doğrudan indirme (Blob fallback) eklendi.

### 9. 💾 Masaüstü (Electron) ve Web Windows Gezgini ile Dosya & Görsel Kaydetme (Farklı Kaydet)
- [x] **Durum:** Tamamlandı
- **Yapılanlar:**
  - **%100 Takılı Kalma (EOF) Hatası Düzeltildi:** `p2p-file-transfer.ts` içerisinde gönderici döngüsünün dosya sonuna ulaştığında `onbufferedamountlow` eşiğini atlaması nedeniyle `EOF` mesajının karşıya hiç iletilmemesi ve alıcı tarafın %100'de takılı kalarak dosya kaydetme diyaloğunu tetikleyememesi kökten çözüldü.
  - **Sıralı Async Gönderim & Backpressure:** Asenkron `FileReader` yerine `slice.arrayBuffer()` ile paketlerin sıralı gitmesi ve DataChannel tamponu (`bufferedAmount`) boşalana kadar beklenip sonrasında güvenle `EOF` fırlatılması sağlandı.
  - **Çift Koruma (Otomatik Finalize):** Alıcı tarafta `receivedBytes >= fileMeta.size` olduğunda EOF sinyali düşse bile 400ms içinde aktarım otomatik tamamlanıp Windows Farklı Kaydet diyaloğu açılır.
  - **Windows Gezgini Native Kaydetme (Electron):** `electron/main.js` içine `save-file` IPC işleyicisi entegre edilerek `dialog.showSaveDialog` ile yerel "Farklı Kaydet" penceresi açılır, dosya uzantı filtreleri eklenir ve dosya diske yazıldıktan sonra `shell.showItemInFolder` ile Windows Gezgini'nde otomatik gösterilir.
  - **Web Chromium File System Access API:** Standart tarayıcılarda (Chrome, Edge vb.) `window.showSaveFilePicker` ile kullanıcının dosyanın kaydedileceği klasörü ve ismi bizzat seçebilmesi sağlandı.
  - **Lightbox Orijinal Görsel İndirme:** Lightbox büyütme penceresindeki indirme butonu, 320px önizleme yerine tam boyutlu orijinal görseli indirecek şekilde güncellendi.


---

## 🔮 Gelecek Geliştirme Yol Haritası ve Yapılacaklar (Sprint 2 & 3)

Projeye bir sonraki aşamada devam edildiğinde sırasıyla uygulanacak özellikler:

---

### 1. 🖼️ Yüzen Yayın Penceresi (Picture-in-Picture / Floating Window)
- [ ] **Durum:** Bekliyor
- **Hedef:** Kullanıcı başka bir uygulamada veya oyundayken arkadaşının ekran yayınını ekranın sağ alt köşesinde her zaman üstte (Always on Top) küçük bir pencerede izleyebilmesi.
- **Uygulama Adımları:**
  - **Web:** Modern tarayıcılar için `documentPictureInPicture.requestWindow({ width: 420, height: 240 })` API'si.
  - **Electron:** `electron/main.js` içinde `createPiPWindow(videoTrack)` fonksiyonu; `BrowserWindow({ width: 420, height: 240, alwaysOnTop: true, frame: false })`.
  - **UI Butonu:** Sahne araç çubuğuna bir "Resim İçinde Resim (PiP)" butonu eklenecek.

---

### 2. 🎙️ Bas-Konuş (Push-to-Talk) Modu ve Kısayol Tuşu
- [ ] **Durum:** Bekliyor
- **Hedef:** Kullanıcıların açık mikrofon yerine belirledikleri bir tuşa (Örn: `Space`, `V` veya fare yan tuşu) basılı tuttukları sürece mikrofonlarının açık kalması.
- **Uygulama Adımları:**
  - **Web:** `window.addEventListener('keydown', ...)` ve `keyup` ile bas-konuş tuşu takibi.
  - **Electron (Masaüstü):** Oyun oynarken pencere odakta olmasa bile bas-konuşun çalışabilmesi için `electron/main.js` içine `globalShortcut.register(...)` veya `uIOhook` kütüphanesi entegrasyonu.
  - **Ayarlar Menüsü:** Ayarlar penceresine "Giriş Modu: Açık Mikrofon / Bas-Konuş" seçeneği ve tuş atama alanı.

---

### 3. 📊 Anlık Ağ ve Yayın İstatistikleri (Diagnostics HUD)
- [ ] **Durum:** Bekliyor
- **Hedef:** Kullanıcıların görüşme kalitesini görebilmesi için ping (ms), FPS, paket kaybı (% packet loss) ve anlık bitrate değerlerini gösteren yarı saydam bir HUD rozeti.
- **Uygulama Adımları:**
  - LiveKit `room.engine.client.on('connectionQualityChanged', ...)` ve WebRTC `peerConnection.getStats()` verilerini 2 saniyede bir okuma.
  - Sahnenin sağ üst köşesine tıklanabilir küçük bir ağ çubuğu ikonu ekleme; tıklandığında açılan mini istatistik paneli.

---

### 4. 👑 Oda Yöneticisi & Moderasyon Yetkileri (Host / Admin Controls)
- [ ] **Durum:** Bekliyor
- **Hedef:** Odayı ilk açan veya yönetici olan kullanıcının odadaki diğer kişileri toplu susturabilmesi (Server Mute) veya odadan çıkarabilmesi (Kick).
- **Uygulama Adımları:**
  - `src/app/api/room/admin/route.ts` oluşturulacak.
  - `livekit-server-sdk` içindeki `RoomServiceClient.mutePublishedTrack()` ve `RoomServiceClient.removeParticipant()` metotları kullanılacak.
  - Katılımcı kartına yöneticiye özel üç nokta menüsü ("Sustur", "Odadan At") eklenecek.

---

### 5. 🎨 Özel Tema Seçenekleri (Theme Switcher)
- [ ] **Durum:** Bekliyor
- **Hedef:** Kullanıcıların arayüzü Discord Dark (`#1e1f22`), Midnight AMOLED (`#000000`), Cyberpunk Purple (`#0f051d`) veya Emerald Dark temaları arasında kişiselleştirebilmesi.
- **Uygulama Adımları:**
  - CSS değişkenleri tabanlı tema sistemi (`--bg-primary`, `--bg-secondary`, `--accent`).
  - Ayarlar menüsüne tema önizleme kartları ekleme ve `localStorage.setItem('voxa_theme', ...)` ile kaydetme.

---

### 6. 🔒 Uçtan Uca Şifreleme (E2EE)
- [ ] **Durum:** Bekliyor
- **Hedef:** Hassas görüşmeler için LiveKit Cloud sunucusu dahil hiç kimsenin ses ve video paketlerini araya girip dinleyemeyeceği istemciden istemciye şifreleme.
- **Uygulama Adımları:**
  - `@livekit/client` yerleşik `E2EEManager` ve Web Worker motoru kullanılacak.
  - Odaya girişte opsiyonel bir "Şifreleme Parolası (Passphrase)" alanı eklenecek.

---

### 7. 🎵 Spotify Birlikte Şarkı Dinleme (Spotify Jam & Voxa DJ Altyapısı - Model 3 Akıllı Hibrit)
- [x] **Durum:** Tamamlandı (Model 3: Akıllı Hibrit Model Entegre Edildi)
- **Hedef:** Odadaki kullanıcıların Voxa uygulamasından çıkmadan, tıpkı Spotify Jam veya Discord müzik botu gibi birlikte senkronize müzik dinleyebilmesi; ortak çalma listesi (kuyruk) oluşturabilmesi, şarkı arayabilmesi, oylamayla şarkı geçebilmesi ve müzik sesini bağımsız ayarlayabilmesi.
- **Yapılanlar:**
  - `src/types/spotify.ts` ve `src/lib/spotify.ts` ile tam tip güvenliği, PKCE OAuth yardımcıları, zengin demo şarkı kütüphanesi ve anında arama mekanizması kuruldu.
  - `/api/spotify/search` ve `/api/spotify/token` ile sunucu taraflı Client Credentials arama & token değişimi rotaları eklendi.
  - `/api/spotify/callback` ile güvenli açılır pencere (popup) yetkilendirme sayfası oluşturuldu.
  - `src/components/SpotifyPlayer.tsx` ile Glassmorphism mini player, canlı süre ve seek bar, ortak kuyruk yönetimi, oylama ("Vote-to-Skip"), Web Audio API tabanlı yumuşak ses kontrolü ve **Akıllı Ses Kısma (Audio Ducking - birisi konuştuğunda müziğin sesini otomatik kısma)** eksiksiz entegre edildi.
  - LiveKit DataChannel (`VOXA_SPOTIFY_*`) üzerinden odadaki tüm katılımcılar arasında milisaniyelik gecikme telafili eşzamanlı dinleme sağlandı.

#### 🎛️ Seçilebilecek 3 Mimari Model (Karar Matrisi):
1. **Model 1: "Voxa DJ / Sanal Stereo Track" (WebRTC Audio Stream — En Kapsayıcı):**
   - *Çalışma Prensibi:* Odanın Host/DJ kullanıcısı Spotify'ı başlatır. Parçanın sesi LiveKit odasına ayrı bir `LocalAudioTrack` (High-Fidelity Stereo Opus 128-192 kbps, gürültü filtresiz) olarak basılır.
   - *Artıları:* Odadaki dinleyicilerin **Spotify hesabı olmasına veya Premium üyeliğe kesinlikle ihtiyacı yoktur**. Herkes Voxa içinden doğrudan ve anında duyar.
   - *Gereksinim:* Müzik sesi LiveKit üzerinden aktığı için sunucu bant genişliği kotası harcar (~55 MB/saat).
2. **Model 2: "Resmi Spotify Jam Klonu" (Web Playback SDK & DataChannel Senkronizasyonu):**
   - *Çalışma Prensibi:* Odadaki herkes Spotify Premium hesabıyla bağlanır. Tarayıcı/Electron içi `Spotify.Player` başlatılır. Şarkı LiveKit DataChannel üzerinden anlık timestamp ile senkronize edilir (`action: "PLAY" | "SEEK"`).
   - *Artıları:* **0 Bayt Sunucu Kotası!** Müzik doğrudan Spotify CDN'inden 320 kbps saf kalitede çalar.
   - *Kısıtı:* Dinleyicilerin tamamının Spotify Premium abonesi olması zorunludur.
3. **Model 3: "Akıllı Hibrit Model" (Önerilen En Gelişmiş Çözüm):**
   - *Çalışma Prensibi:* Odada tek bir modern müzik konsolu açılır. Premium olanlar doğrudan Spotify CDN'inden dinlemeyi seçebilir (kotasız & 320 kbps), hesabı olmayan veya Free hesabı olanlar içinse Host'un canlı stereo ses akışı devreye girer.

#### 🛠️ Detaylı Uygulama Adımları & Dosya Planı:
- [ ] **Aşama 1: Spotify Geliştirici & OAuth 2.0 PKCE Entegrasyonu:**
  - `src/lib/spotify.ts`: Spotify Web API istemcisi (Arama, Cihaz Yönetimi, Şarkı Bilgisi alma).
  - `src/app/api/spotify/login/route.ts` & `/callback/route.ts`: PKCE akışıyla güvenli token alımı.
- [ ] **Aşama 2: LiveKit DataChannel Senkronizasyon Protokolü:**
  - `src/app/[roomName]/page.tsx` içerisine yeni mesajlaşma aksiyonları:
    ```json
    {
      "type": "VOXA_SPOTIFY_ACTION",
      "action": "PLAY" | "PAUSE" | "SEEK" | "QUEUE_ADD" | "VOTE_SKIP",
      "track": { "id": "...", "name": "...", "artists": "...", "albumArt": "...", "durationMs": 0 },
      "positionMs": 45000,
      "sentAt": 1718000000000,
      "sender": "Halil"
    }
    ```
  - Drift (zaman kayması) telafi formülü: `(Date.now() - sentAt)` ağ gecikmesini hesaba katarak milisaniye sapmalarını otomatik düzeltme.
- [ ] **Aşama 3: Müzik Çalar Konsolu UI (`src/components/SpotifyPlayer.tsx`):**
  - Odada sahne altında veya sağ tarafta cam efektli (Glassmorphism) mini player.
  - Dönen albüm kapağı, anlık süre ilerleme çubuğu (Seek Bar), Play/Pause/Next kontrolleri.
  - Canlı ses spektrum/equalizer animasyonu.
- [ ] **Aşama 4: Ortak Müzik Kuyruğu & Şarkı Arama Modalı:**
  - Herkesin şarkı adı/sanatçı aratıp tek tıkla ortak listeye şarkı ekleyebilmesi (`QUEUE_ADD`).
  - Şarkı Geçme Oylaması ("Vote to Skip"): Katılımcıların %50'si oy verdiğinde şarkının otomatik atlanması.
- [ ] **Aşama 5: Akıllı Ses Yönetimi (Audio Ducking) & Bağımsız Ses Ayarı:**
  - Her katılımcının müzik sesini konuşma seslerinden ayrı (%0 - %200) ayarlayabilmesi.
  - **Audio Ducking:** Odada bir katılımcı konuştuğunda müziğin sesinin otomatik %20'ye inmesi, konuşma bitince yumuşakça (fade-in) eski seviyeye dönmesi.
