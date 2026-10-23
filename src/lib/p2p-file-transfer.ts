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
        const blobUrl = URL.createObjectURL(local);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileMeta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
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

      // 15 saniye zaman aşımı kontrolü
      const watchdog = setTimeout(() => {
        if (!this.isCancelledMap.get(fileMeta.id)) {
          onError("P2P dosya aktarımı zaman aşımına uğradı. Karşı taraf çevrimdışı olabilir.");
          this.closeConnection(connectionKey);
        }
      }, 15000);
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

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        this.activeDataChannels.set(connectionKey, channel);
        channel.binaryType = "arraybuffer";

        channel.onmessage = (msgEvent) => {
          if (this.isCancelledMap.get(fileMeta.id)) {
            this.closeConnection(connectionKey);
            return;
          }

          if (typeof msgEvent.data === "string") {
            try {
              const meta = JSON.parse(msgEvent.data);
              if (meta.type === "EOF") {
                this.clearWatchdog(fileMeta.id);
                const blob = new Blob(receivedChunks, {
                  type: fileMeta.type || "application/octet-stream",
                });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = fileMeta.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                onProgress(100);
                onComplete();
                this.closeConnection(connectionKey);
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
          this.clearWatchdog(fileMeta.id); // İlk paket geldiğinde watchdog'u temizle
          receivedChunks.push(msgEvent.data);
          receivedBytes += msgEvent.data.byteLength;
          const progress = Math.min(100, Math.round((receivedBytes / fileMeta.size) * 100));
          onProgress(progress);
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

    dataChannel.onopen = () => {
      let offset = 0;
      dataChannel.bufferedAmountLowThreshold = 8 * CHUNK_SIZE;

      const sendNextSlice = () => {
        if (this.isCancelledMap.get(fileId)) {
          this.closeConnection(connectionKey);
          return;
        }

        if (offset >= file.size) {
          try {
            dataChannel.send(JSON.stringify({ type: "EOF" }));
          } catch {}
          return;
        }

        while (
          offset < file.size &&
          dataChannel.bufferedAmount <= dataChannel.bufferedAmountLowThreshold
        ) {
          if (this.isCancelledMap.get(fileId) || dataChannel.readyState !== "open") {
            return;
          }

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const reader = new FileReader();
          reader.onload = (e) => {
            if (dataChannel.readyState !== "open") return;
            try {
              const buffer = e.target?.result as ArrayBuffer;
              dataChannel.send(buffer);
            } catch {}
          };
          reader.readAsArrayBuffer(slice);
          offset += CHUNK_SIZE;
        }

        if (offset < file.size) {
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            sendNextSlice();
          };
        }
      };

      sendNextSlice();
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
