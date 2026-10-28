const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell, dialog, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

// IPC Handler: Panoya Metin Yazma (Davet Linkleri vb.)
ipcMain.handle("clipboard-write-text", async (event, text) => {
  if (typeof text === "string") {
    clipboard.writeText(text);
    return true;
  }
  return false;
});

// IPC Handler: Dosyayı Windows Gezgini / Farklı Kaydet Penceresi ile Diske Kaydetme
ipcMain.handle("save-file", async (event, { buffer, filename }) => {
  try {
    if (!buffer) {
      return { success: false, error: "Kaydedilecek dosya verisi boş." };
    }

    const downloadsFolder = app.getPath("downloads");
    const safeFilename = filename || `voxa_dosya_${Date.now()}`;
    const defaultSavePath = path.join(downloadsFolder, safeFilename);

    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win && !win.isDestroyed()) {
      win.focus();
    }

    const ext = path.extname(safeFilename).replace(".", "");
    const filters = [];
    if (ext) {
      filters.push({
        name: `${ext.toUpperCase()} Dosyası (*.${ext})`,
        extensions: [ext],
      });
    }
    filters.push({ name: "Tüm Dosyalar (*.*)", extensions: ["*"] });

    const dialogOptions = {
      title: "Dosyayı Kaydet - Voxa",
      defaultPath: defaultSavePath,
      buttonLabel: "Kaydet",
      filters,
    };

    // Windows native dosya kaydetme diyaloğu (Farklı Kaydet)
    const { canceled, filePath } = win && !win.isDestroyed()
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    let nodeBuffer;
    if (Buffer.isBuffer(buffer)) {
      nodeBuffer = buffer;
    } else if (buffer instanceof ArrayBuffer) {
      nodeBuffer = Buffer.from(buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      nodeBuffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer && buffer.data && Array.isArray(buffer.data)) {
      nodeBuffer = Buffer.from(buffer.data);
    } else {
      nodeBuffer = Buffer.from(buffer);
    }

    await fs.promises.writeFile(filePath, nodeBuffer);

    // Kaydedilen dosyayı Windows Gezgini'nde göster ve seçili yap
    try {
      shell.showItemInFolder(filePath);
    } catch (e) {
      console.warn("Dosya gezginde gösterilemedi:", e);
    }

    return { success: true, filePath };
  } catch (err) {
    console.error("Electron save-file hatası:", err);
    return { success: false, error: err ? err.message : "Bilinmeyen bir hata oluştu" };
  }
});

// Ekran ve Ses Yakalama için Chromium Flag'leri
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
app.commandLine.appendSwitch("allow-http-screen-capture");
app.commandLine.appendSwitch("enable-audio-service-sandbox", "false");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: "Voxa - Sesli Görüşme ve Ekran Paylaşımı",
    backgroundColor: "#1e1f22",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Otomatik Medya İzinleri (Mikrofon, Kamera, Ekran Paylaşımı)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "display-capture", "notifications"];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Tarayıcı içi doğrudan indirmelerde Windows Farklı Kaydet penceresi aç
  session.defaultSession.on("will-download", (event, item, webContents) => {
    const downloadsFolder = app.getPath("downloads");
    item.setSaveDialogOptions({
      title: "Dosyayı Kaydet - Voxa",
      defaultPath: path.join(downloadsFolder, item.getFilename()),
    });
    item.once("done", (event, state) => {
      if (state === "completed") {
        try {
          shell.showItemInFolder(item.getSavePath());
        } catch {}
      }
    });
  });

let pendingDesktopSourceId = null;

// IPC Handler: Kullanıcının Seçtiği Masaüstü Ekran veya Pencere Kaynağını Kaydetme
ipcMain.handle("select-desktop-source", async (event, sourceId) => {
  pendingDesktopSourceId = sourceId;
  return true;
});

  // Display Media (Ekran Paylaşımı) İşleyicisi - Electron ortamında getDisplayMedia çağrısını aktifleştirir
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ["screen", "window"] })
      .then((sources) => {
        if (sources.length > 0) {
          let chosenSource = null;
          if (pendingDesktopSourceId) {
            chosenSource = sources.find((s) => s.id === pendingDesktopSourceId);
          }
          if (!chosenSource) {
            chosenSource = sources.find((s) => s.id.startsWith("screen:")) || sources[0];
          }
          pendingDesktopSourceId = null;

          // Hem tam ekran hem de belirli uygulama/pencerelerde Windows loopback sesini eksiksiz aktar
          callback({
            video: chosenSource,
            audio: "loopback",
          });
        } else {
          callback(null);
        }
      })
      .catch((err) => {
        console.error("Display media handler hatası:", err);
        callback(null);
      });
  });

  // Geliştirme modunda (npm run electron:dev) -> http://localhost:3000
  // Üretim modunda (.exe çalıştırıldığında) -> Canlı Netlify web uygulaması adresi
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  const defaultLiveUrl = process.env.LIVE_APP_URL || "https://ses.app.noticq.com";
  const startUrl = process.env.ELECTRON_START_URL || (isDev ? "http://localhost:3000" : defaultLiveUrl);

  mainWindow.loadURL(startUrl);

  // Yükleme hatası durumunda (örneğin internet kopukluğunda) canlı adrese düşme / yeniden deneme
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.warn("Sayfa yükleme başarısız oldu, yeniden deneniyor...", errorDescription);
    if (startUrl !== defaultLiveUrl) {
      mainWindow.loadURL(defaultLiveUrl);
    } else {
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(startUrl);
      }, 3000);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Auto-Updater Konfigürasyonu
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;

  autoUpdater.on("update-available", () => {
    if (mainWindow) {
      mainWindow.webContents.send("update-available");
    }
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Voxa Güncellemesi Hazır",
        message: "Voxa'nın yeni bir sürümü indirildi. Yeniden başlatarak güncelleyebilirsiniz.",
        buttons: ["Şimdi Yeniden Başlat", "Sonra"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn("Otomatik güncelleme kontrol hatası:", err);
  });
}

// IPC Handler: Masaüstü Ekran & Pencere Kaynaklarını Getirme
ipcMain.handle("get-desktop-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error("Desktop sources alma hatası:", err);
    return [];
  }
});

// IPC Handler: Tam Ekran Modu Geçişi
ipcMain.handle("toggle-fullscreen", async () => {
  if (!mainWindow) return false;
  const isFull = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFull);
  return !isFull;
});

// IPC Handler: Harici Bağlantı Açma
ipcMain.handle("open-external", async (event, url) => {
  if (url && typeof url === "string") {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// IPC Handler: Güncelleme Kontrolü
ipcMain.handle("check-for-updates", async () => {
  if (app.isPackaged) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return !!result;
    } catch (e) {
      return false;
    }
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
