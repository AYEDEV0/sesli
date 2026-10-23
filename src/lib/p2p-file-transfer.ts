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

export function registerLocalFile(file: File, senderIdentity: string, senderName: string, thumbnail?: string): SharedFileMeta {
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
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64 KB per WebRTC packet

export class P2PTransferManager {
  private activePeerConnections = new Map<string, RTCPeerConnection>();

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
    const connectionKey = `${fileMeta.id}_${fileMeta.senderIdentity}`;
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      this.activePeerConnections.set(connectionKey, pc);

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
        channel.binaryType = "arraybuffer";

        channel.onmessage = (msgEvent) => {
          if (typeof msgEvent.data === "string") {
            try {
              const meta = JSON.parse(msgEvent.data);
              if (meta.type === "EOF") {
                const blob = new Blob(receivedChunks, { type: fileMeta.type || "application/octet-stream" });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = fileMeta.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                onComplete();
                pc.close();
                this.activePeerConnections.delete(connectionKey);
              }
            } catch {
              // ignore
            }
            return;
          }

          receivedChunks.push(msgEvent.data);
          receivedBytes += msgEvent.data.byteLength;
          const progress = Math.min(100, Math.round((receivedBytes / fileMeta.size) * 100));
          onProgress(progress);
        };

        channel.onerror = () => {
          onError("P2P veri aktarımı sırasında bağlantı koptu.");
          pc.close();
          this.activePeerConnections.delete(connectionKey);
        };
      };

      // 1. Göndericiye dosya istek sinyali at
      this.sendSignal(fileMeta.senderIdentity, {
        type: "P2P_FILE_REQUEST",
        fileId: fileMeta.id,
      });
    } catch (err: any) {
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
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.activePeerConnections.set(connectionKey, pc);

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
    dataChannel.binaryType = "arraybuffer";

    dataChannel.onopen = () => {
      let offset = 0;
      dataChannel.bufferedAmountLowThreshold = 8 * CHUNK_SIZE;

      const sendNextSlice = () => {
        if (offset >= file.size) {
          dataChannel.send(JSON.stringify({ type: "EOF" }));
          return;
        }

        while (offset < file.size && dataChannel.bufferedAmount <= dataChannel.bufferedAmountLowThreshold) {
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const reader = new FileReader();
          reader.onload = (e) => {
            if (dataChannel.readyState !== "open") return;
            const buffer = e.target?.result as ArrayBuffer;
            dataChannel.send(buffer);
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

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignal(requesterIdentity, {
      type: "P2P_OFFER",
      fileId,
      sdp: offer,
    });
  }

  /**
   * Alıcı: Gelen Offer'ı kabul edip Answer üretir.
   */
  async handleOffer(fileId: string, senderIdentity: string, sdp: RTCSessionDescriptionInit) {
    const connectionKey = `${fileId}_${senderIdentity}`;
    const pc = this.activePeerConnections.get(connectionKey);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal(senderIdentity, {
      type: "P2P_ANSWER",
      fileId,
      sdp: answer,
    });
  }

  /**
   * Gönderici: Alıcıdan gelen Answer'ı set eder.
   */
  async handleAnswer(fileId: string, requesterIdentity: string, sdp: RTCSessionDescriptionInit) {
    const connectionKey = `${fileId}_${requesterIdentity}`;
    const pc = this.activePeerConnections.get(connectionKey);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  /**
   * ICE Candidate sinyallerini eşler.
   */
  async handleCandidate(fileId: string, peerIdentity: string, candidate: RTCIceCandidateInit) {
    const connectionKey = `${fileId}_${peerIdentity}`;
    const pc = this.activePeerConnections.get(connectionKey);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore
    }
  }

  cleanup() {
    this.activePeerConnections.forEach((pc) => pc.close());
    this.activePeerConnections.clear();
  }
}
