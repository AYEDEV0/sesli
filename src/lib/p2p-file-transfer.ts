/**
 * Voxa P2P Dosya ve Görsel Transfer Yöneticisi (WebRTC DataChannel)
 * Dosyalar hiçbir sunucudan veya LiveKit kotasından geçmez.
 * Doğrudan Gönderici <-> Alıcı tarayıcıları arasında (P2P) şifreli olarak akar.
 */

export interface SharedFileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  thumbnail?: string;
  senderIdentity: string;
  senderName: string;
  timestamp: number;
}

// Gönderilen yerel dosyaların bellekteki önbelleği
const localFilesStore = new Map<string, File>();

export function registerLocalFile(
  file: File,
  senderIdentity: string,
  senderName: string,
  thumbnail?: string
): SharedFileMeta {
  const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localFilesStore.set(id, file);

  const isImage = file.type.startsWith("image/");

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    isImage,
    thumbnail,
    senderIdentity,
    senderName,
    timestamp: Date.now(),
  };
}

export function getLocalFile(id: string): File | undefined {
  return localFilesStore.get(id);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Resimler için hafif ve net bir base64 küçük önizleme (thumbnail) üretir.
 */
export async function generateImageThumbnail(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64 KB per WebRTC packet

/**
 * İndirilen dosyayı hem masaüstü (Electron - Windows Gezgini Farklı Kaydet)
 * hem de standart web tarayıcılarında (File System Access API & Blob) kullanıcıya nereye kaydedeceğini sorarak güvenle kaydeder.
 */
export async function saveBlobToDisk(blob: Blob, filename: string): Promise<boolean> {
  // 1. Masaüstü (Electron) Ortamı: Yerel Windows "Farklı Kaydet" Penceresi
  if (typeof window !== "undefined" && (window as any).electronAPI?.saveFile) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const res = await (window as any).electronAPI.saveFile({
        buffer: arrayBuffer,
        filename,
      });

      if (res?.canceled) {
        return false;
      }
      return Boolean(res?.success);
    } catch (err) {
      console.error("[P2P] Electron dosya kaydetme hatası:", err);
    }
  }

  // 2. Modern Chromium Tarayıcıları (Chrome, Edge, Opera, Brave)
  // Windows "Farklı Kaydet" penceresini doğrudan tarayıcı üzerinden açar
  if (typeof window !== "undefined" && typeof (window as any).showSaveFilePicker === "function") {
    try {
      const dotIndex = filename.lastIndexOf(".");
      const ext = dotIndex !== -1 ? filename.slice(dotIndex + 1).toLowerCase() : "";
      const pickerOptions: any = {
        suggestedName: filename,
      };
      if (ext) {
        pickerOptions.types = [
          {
            description: `${ext.toUpperCase()} Dosyası`,
            accept: {
              [blob.type || "application/octet-stream"]: [`.${ext}`],
            },
          },
        ];
      }
      const handle = await (window as any).showSaveFilePicker(pickerOptions);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Kullanıcı kaydet penceresinde İptal butonuna bastı
        return false;
      }
      console.warn("[P2P] showSaveFilePicker başarısız, standart indirmeye dönülüyor:", err);
    }
  }

  // 3. Standart Web Tarayıcısı Fallback (<a> tag & createObjectURL)
  try {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return true;
  } catch (err) {
    console.error("[P2P] Web dosya indirme hatası:", err);
    return false;
  }
}

export class P2PTransferManager {
  private activePeerConnections = new Map<string, RTCPeerConnection>();
  private activeDataChannels = new Map<string, RTCDataChannel>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private activeWatchdogs = new Map<string, NodeJS.Timeout>();
  private isCancelledMap = new Map<string, boolean>();

  constructor(
    private sendSignal: (targetIdentity: string, payload: any) => void
  ) {}

  /**
   * Alıcı: Dosya İndirme Talebini Başlatır
   */
  async requestDownload(
    fileMeta: SharedFileMeta,
    onProgress: (percent: number) => void,
    onComplete: () => void,
    onError: (err: string) => void
  ) {
    this.isCancelledMap.set(fileMeta.id, false);

    // 1. Durum: Dosya yerel bellekte mevcutsa (kullanıcı kendi dosyasını indiriyorsa veya aynı sekmedeyse)
    const local = getLocalFile(fileMeta.id);
    if (local) {
      try {
        await saveBlobToDisk(local, fileMeta.name);
        onProgress(100);
        onComplete();
        return;
      } catch (err: any) {
        console.warn("[P2P] Yerel dosya indirme hatası:", err);
      }
    }

    const connectionKey = `${fileMeta.id}_${fileMeta.senderIdentity}`;
    try {
      // Varsa eski bağlantıyı temizle
      this.closeConnection(connectionKey);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      this.activePeerConnections.set(connectionKey, pc);
      this.pendingCandidates.set(connectionKey, []);

      // 20 saniye zaman aşımı kontrolü
      const watchdog = setTimeout(() => {
        if (!this.isCancelledMap.get(fileMeta.id)) {
          onError("P2P dosya aktarımı zaman aşımına uğradı. Karşı taraf çevrimdışı olabilir.");
          this.closeConnection(connectionKey);
        }
      }, 20000);
      this.activeWatchdogs.set(fileMeta.id, watchdog);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendSignal(fileMeta.senderIdentity, {
            type: "P2P_CANDIDATE",
            fileId: fileMeta.id,
            candidate: e.candidate,
          });
        }
      };

      const receivedChunks: ArrayBuffer[] = [];
      let receivedBytes = 0;
      let isTransferFinalized = false;

      const finalizeTransfer = async () => {
        if (isTransferFinalized) return;
        isTransferFinalized = true;
        this.clearWatchdog(fileMeta.id);

        try {
          const blob = new Blob(receivedChunks, {
            type: fileMeta.type || "application/octet-stream",
          });

          // İndirilen dosyayı yerel önbelleğe de kaydet
          try {
            const cachedFile = new File([blob], fileMeta.name, {
              type: fileMeta.type || "application/octet-stream",
            });
            localFilesStore.set(fileMeta.id, cachedFile);
          } catch {}

          onProgress(100);
          await saveBlobToDisk(blob, fileMeta.name);
          onComplete();
        } catch (err: any) {
          console.error("[P2P] Dosya tamamlama/kaydetme hatası:", err);
          onError("Dosya diske kaydedilemedi.");
        } finally {
          this.closeConnection(connectionKey);
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        this.activeDataChannels.set(connectionKey, channel);
        channel.binaryType = "arraybuffer";

        channel.onmessage = async (msgEvent) => {
          if (this.isCancelledMap.get(fileMeta.id)) {
            this.closeConnection(connectionKey);
            return;
          }

          if (typeof msgEvent.data === "string") {
            try {
              const meta = JSON.parse(msgEvent.data);
              if (meta.type === "EOF") {
                await finalizeTransfer();
              } else if (meta.type === "P2P_CANCEL") {
                this.clearWatchdog(fileMeta.id);
                onError("İndirme karşı tarafça iptal edildi.");
                this.closeConnection(connectionKey);
              }
            } catch {
              // ignore
            }
            return;
          }

          // Gelen binary chunk'ları topla
          this.clearWatchdog(fileMeta.id);
          receivedChunks.push(msgEvent.data);
          receivedBytes += msgEvent.data.byteLength;
          const progress = Math.min(100, Math.round((receivedBytes / fileMeta.size) * 100));
          onProgress(progress);

          // Çift Güvenlik: Tüm baytlar eksiksiz ulaştıysa (%100) ve 400ms içinde EOF gelmezse transferi tamamla
          if (receivedBytes >= fileMeta.size && !isTransferFinalized) {
            setTimeout(() => {
              if (!isTransferFinalized) {
                finalizeTransfer();
              }
            }, 400);
          }
        };

        channel.onerror = () => {
          if (!this.isCancelledMap.get(fileMeta.id)) {
            onError("P2P veri aktarımı sırasında bağlantı koptu.");
          }
          this.closeConnection(connectionKey);
        };

        channel.onclose = () => {
          this.closeConnection(connectionKey);
        };
      };

      // 1. Göndericiye dosya istek sinyali ilet
      this.sendSignal(fileMeta.senderIdentity, {
        type: "P2P_FILE_REQUEST",
        fileId: fileMeta.id,
      });
    } catch (err: any) {
      this.clearWatchdog(fileMeta.id);
      onError(err?.message || "P2P bağlantısı kurulamadı.");
    }
  }

  /**
   * Gönderici: Gelen indirme isteğini işler ve P2P kanalından dosyayı parça parça gönderir.
   */
  async handleFileRequest(fileId: string, requesterIdentity: string) {
    const file = getLocalFile(fileId);
    if (!file) return;

    const connectionKey = `${fileId}_${requesterIdentity}`;
    this.closeConnection(connectionKey);
    this.isCancelledMap.set(fileId, false);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.activePeerConnections.set(connectionKey, pc);
    this.pendingCandidates.set(connectionKey, []);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(requesterIdentity, {
          type: "P2P_CANDIDATE",
          fileId,
          candidate: e.candidate,
        });
      }
    };

    const dataChannel = pc.createDataChannel("voxa-file-transfer", {
      ordered: true,
    });
    this.activeDataChannels.set(connectionKey, dataChannel);
    dataChannel.binaryType = "arraybuffer";

    dataChannel.onopen = async () => {
      dataChannel.bufferedAmountLowThreshold = 8 * CHUNK_SIZE;
      let offset = 0;

      try {
        while (offset < file.size) {
          if (this.isCancelledMap.get(fileId) || dataChannel.readyState !== "open") {
            this.closeConnection(connectionKey);
            return;
          }

          // Backpressure: DataChannel tamponu dolduğunda boşalmasını bekle
          if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
            await new Promise<void>((resolve) => {
              let resolved = false;
              const handleLow = () => {
                if (resolved) return;
                resolved = true;
                dataChannel.onbufferedamountlow = null;
                resolve();
              };
              dataChannel.onbufferedamountlow = handleLow;
              // 500ms güvenlik zaman aşımı
              setTimeout(handleLow, 500);
            });
          }

          if (this.isCancelledMap.get(fileId) || dataChannel.readyState !== "open") {
            this.closeConnection(connectionKey);
            return;
          }

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();

          if (this.isCancelledMap.get(fileId) || dataChannel.readyState !== "open") {
            this.closeConnection(connectionKey);
            return;
          }

          dataChannel.send(buffer);
          offset += CHUNK_SIZE;
        }

        // Tüm binary parçaların ağ katmanına yazılmasını bekle
        while (dataChannel.bufferedAmount > 0) {
          if (this.isCancelledMap.get(fileId) || dataChannel.readyState !== "open") {
            return;
          }
          await new Promise((r) => setTimeout(r, 40));
        }

        // Bütün veriler eksiksiz gönderildi; EOF sinyalini ilet
        if (dataChannel.readyState === "open" && !this.isCancelledMap.get(fileId)) {
          dataChannel.send(JSON.stringify({ type: "EOF" }));
        }
      } catch (err) {
        console.error("[P2P] Dosya gönderim hatası:", err);
      }
    };

    dataChannel.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === "P2P_CANCEL") {
            this.isCancelledMap.set(fileId, true);
            this.closeConnection(connectionKey);
          }
        } catch {}
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignal(requesterIdentity, {
      type: "P2P_OFFER",
      fileId,
      sdp: offer,
    });
  }

  /**
   * Alıcı: Gelen Offer'ı kabul edip Answer üretir ve bekleyen ICE adaylarını ekler.
   */
  async handleOffer(fileId: string, senderIdentity: string, sdp: RTCSessionDescriptionInit) {
    const connectionKey = `${fileId}_${senderIdentity}`;
    const pc = this.activePeerConnections.get(connectionKey);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Bekleyen ICE adaylarını ekle
    await this.flushPendingCandidates(connectionKey, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal(senderIdentity, {
      type: "P2P_ANSWER",
      fileId,
      sdp: answer,
    });
  }

  /**
   * Gönderici: Alıcıdan gelen Answer'ı set eder ve bekleyen ICE adaylarını ekler.
   */
  async handleAnswer(fileId: string, requesterIdentity: string, sdp: RTCSessionDescriptionInit) {
    const connectionKey = `${fileId}_${requesterIdentity}`;
    const pc = this.activePeerConnections.get(connectionKey);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Bekleyen ICE adaylarını ekle
    await this.flushPendingCandidates(connectionKey, pc);
  }

  /**
   * ICE Candidate sinyallerini işler. Remote description henüz hazır değilse kuyruğa alır.
   */
  async handleCandidate(fileId: string, peerIdentity: string, candidate: RTCIceCandidateInit) {
    const connectionKey = `${fileId}_${peerIdentity}`;
    const pc = this.activePeerConnections.get(connectionKey);
    if (!pc) return;

    if (!pc.remoteDescription) {
      const queue = this.pendingCandidates.get(connectionKey) || [];
      queue.push(candidate);
      this.pendingCandidates.set(connectionKey, queue);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[P2P] ICE adayı eklenirken hata:", e);
    }
  }

  /**
   * Bir transferi anında iptal eder.
   */
  cancelTransfer(fileId: string, peerIdentity?: string) {
    this.isCancelledMap.set(fileId, true);
    this.clearWatchdog(fileId);

    // Varsa karşı tarafa iptal sinyali gönder
    if (peerIdentity) {
      this.sendSignal(peerIdentity, {
        type: "P2P_CANCEL",
        fileId,
      });
    }

    // Bu fileId ile başlayan tüm aktif bağlantıları kapat
    this.activePeerConnections.forEach((pc, key) => {
      if (key.startsWith(`${fileId}_`)) {
        try {
          const dc = this.activeDataChannels.get(key);
          if (dc && dc.readyState === "open") {
            dc.send(JSON.stringify({ type: "P2P_CANCEL", fileId }));
          }
        } catch {}
        this.closeConnection(key);
      }
    });
  }

  /**
   * Karşı taraftan gelen iptal sinyalini işler.
   */
  handleCancelSignal(fileId: string, peerIdentity: string) {
    this.isCancelledMap.set(fileId, true);
    this.clearWatchdog(fileId);
    const connectionKey = `${fileId}_${peerIdentity}`;
    this.closeConnection(connectionKey);
  }

  private async flushPendingCandidates(connectionKey: string, pc: RTCPeerConnection) {
    const queued = this.pendingCandidates.get(connectionKey) || [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn("[P2P] Kuyruktaki ICE adayı işlenemedi:", err);
      }
    }
    this.pendingCandidates.set(connectionKey, []);
  }

  private clearWatchdog(fileId: string) {
    const wd = this.activeWatchdogs.get(fileId);
    if (wd) {
      clearTimeout(wd);
      this.activeWatchdogs.delete(fileId);
    }
  }

  private closeConnection(connectionKey: string) {
    const dc = this.activeDataChannels.get(connectionKey);
    if (dc) {
      try {
        dc.close();
      } catch {}
      this.activeDataChannels.delete(connectionKey);
    }

    const pc = this.activePeerConnections.get(connectionKey);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.activePeerConnections.delete(connectionKey);
    }

    this.pendingCandidates.delete(connectionKey);
  }

  cleanup() {
    this.activeWatchdogs.forEach((wd) => clearTimeout(wd));
    this.activeWatchdogs.clear();
    this.activeDataChannels.forEach((dc) => {
      try {
        dc.close();
      } catch {}
    });
    this.activeDataChannels.clear();
    this.activePeerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.activePeerConnections.clear();
    this.pendingCandidates.clear();
    this.isCancelledMap.clear();
  }
}
