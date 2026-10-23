# 🚀 Voxa - Gelecek Geliştirme Yol Haritası ve Yapılacaklar (Roadmap & To-Do)

Bu belge, projeye daha sonra devam edildiğinde sırasıyla hayata geçirilecek yeni özellikleri, teknik uygulama adımlarını ve kontrol listesini (checklist) içerir.

---

## 📌 Öncelikli Yapılacaklar Listesi (Sprint 1)

### 1. 🔍 Sohbette Görsellere Tıklayınca Büyütme (Lightbox Modal)
- [ ] **Durum:** Bekliyor
- **Hedef:** Sohbet akışında paylaşılan görsellere veya küçük resimlere (thumbnails) tıklandığında tam ekran, karartmalı bir Lightbox modalı açılması.
- **Teknik Adımlar:**
  1. `src/app/[roomName]/page.tsx` içerisine `selectedPreviewImage: string | null` state'i ekleyin.
  2. Sohbetteki resim kartına `onClick={() => setSelectedPreviewImage(msg.thumbnail || msg.fileUrl)}` ekleyin.
  3. Açılan modalda:
     - `fixed inset-0 z-50 bg-black/85 backdrop-blur-md` ile şık bir arka plan karartması.
     - Sağ üstte kapatma butonu (`X`) ve `Escape` tuşu dinleyicisi.
     - Resmi orijinal en-boy oranıyla ortalama (`max-h-[90vh] max-w-[90vw] object-contain`).
     - Altta "Orijinalini İndir" butonu.

---

### 2. 🛑 P2P Dosya İndirmesini İptal Etme (Cancel Ongoing Download)
- [ ] **Durum:** Bekliyor
- **Hedef:** Kullanıcı yüksek boyutlu bir dosyayı indirmeye başladıktan sonra vazgeçtiğinde transferi tek tıkla durdurabilmesi.
- **Teknik Adımlar:**
  1. `src/lib/p2p-file-transfer.ts` içine `cancelTransfer(fileId: string)` metodunu ekleyin:
     ```typescript
     export function cancelTransfer(fileId: string) {
       const peer = activePeers[fileId];
       if (peer) {
         peer.dataChannel?.close();
         peer.pc.close();
         delete activePeers[fileId];
       }
       // Bellekte biriken chunk dizisini temizle
       delete downloadBuffers[fileId];
     }
     ```
  2. Karşı tarafa LiveKit üzerinden `{ type: "p2p-cancel", fileId }` sinyali göndererek göndericinin veri basmasını durdurun.
  3. `[roomName]/page.tsx` içindeki indirme ilerleme çubuğunun yanına kırmızı bir "İptal Et" (`X`) butonu ekleyin.
  4. İptal edildiğinde transfer durumunu `"cancelled"` yapıp kullanıcıya "İndirme iptal edildi" uyarısı verin.

---

### 3. 👤 Kullanıcı Avatar Sistemi (Avatar Selection & Badges)
- [ ] **Durum:** Bekliyor
- **Hedef:** Kullanıcıların rumuzlarının yanına anime, 3D, retro veya sevimli ikonlardan oluşan bir avatar seçebilmesi; bu avatarın hem sol katılımcı listesinde hem de sohbette görünmesi.
- **Teknik Adımlar:**
  1. **Avatar Kütüphanesi:**
     - `public/avatars/` klasörüne hazır 8-12 adet SVG/PNG avatar yerleştirin (veya DiceBear SVG URL motoru kullanın: `https://api.dicebear.com/7.x/bottts/svg?seed=...`).
  2. **Ana Sayfa Seçici:**
     - `src/app/page.tsx` giriş formunda Rumuz kutusunun yanına mini avatar önizleme dairesi ve tıklanınca açılan avatar seçim ızgarası ekleyin.
     - Seçilen avatar ID'sini `localStorage.setItem('voxa_user_avatar', avatarId)` ile saklayın.
  3. **Oda İçi Senkronizasyon:**
     - Kullanıcı odaya bağlandığında LiveKit LocalParticipant metadata'sını güncelleyin:
       ```typescript
       room.localParticipant.setMetadata(JSON.stringify({
         avatar: userAvatar,
         joinedAt: Date.now()
       }));
       ```
  4. **Arayüzde Gösterme:**
     - `[roomName]/page.tsx` içerisindeki katılımcı kartlarında ve sohbet balonlarında baş harf yerine `<img src={participantMetadata.avatar} />` bileşenini render edin.

---

## 🔮 Orta & Uzun Vadeli Yapılacaklar (Sprint 2)

### 4. 🖼️ Yüzen Yayın Penceresi (Picture-in-Picture / Floating Window)
- [ ] **Durum:** Bekliyor
- **Hedef:** Oyun oynarken veya tarayıcı simge durumundayken arkadaşının ekran yayınını ekranın köşesinde küçük, her zaman üstte bir pencerede izleme.
- **Uygulama:**
  - **Web:** `documentPictureInPicture.requestWindow({ width: 420, height: 240 })`.
  - **Electron:** `BrowserWindow` (`alwaysOnTop: true, frame: false`).

---

### 5. 📊 Anlık Ağ ve Yayın İstatistikleri (Diagnostics Overlay)
- [ ] **Durum:** Bekliyor
- **Hedef:** Ping (ms), FPS, Paket Kaybı (Packet Loss) ve Bitrate gösteren yarı saydam HUD rozeti.
- **Uygulama:** LiveKit `participant.getPublisherStats()` ve WebRTC `getStats()` verilerini 2 saniyede bir poll etme.

---

### 6. 🎙️ Bas-Konuş (Push-to-Talk) Modu
- [ ] **Durum:** Bekliyor
- **Hedef:** Mikrofonun sadece belirlenen tuşa (Örn: `Space` veya `V`) basılı tutulduğunda açılması.
- **Uygulama:** Web için `keydown`/`keyup` event listener; Electron masaüstü için arka planda çalışan global kısayol (`globalShortcut`).

---

### 7. 👑 Oda Yöneticisi & Moderasyon Yetkileri (Host Controls)
- [ ] **Durum:** Bekliyor
- **Hedef:** Odayı kuran kişinin diğer katılımcıları susturabilmesi (Server Mute) veya odadan atabilmesi (Kick).
- **Uygulama:** LiveKit Server SDK `RoomServiceClient.mutePublishedTrack()` ve `RoomServiceClient.removeParticipant()`.

---

### 8. 🎨 Özel Tema Seçenekleri (Theme Switcher)
- [ ] **Durum:** Bekliyor
- **Hedef:** Midnight Dark, Cyberpunk Neon, Emerald Green renk paletleri arasında geçiş yapabilme.
- **Uygulama:** Tailwind / CSS Custom Variables tabanlı tema sağlayıcı (`ThemeProvider`).

---

### 9. 🔒 Uçtan Uca Şifreleme (E2EE)
- [ ] **Durum:** Bekliyor
- **Hedef:** Sıfır bilgi prensibiyle WebRTC paketlerinin LiveKit sunucusu tarafından bile çözülemeyeceği tam şifreleme.
- **Uygulama:** `@livekit/client` yerleşik E2EE Web Worker motoru.
