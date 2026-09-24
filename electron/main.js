const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

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

  // Display Media (Ekran Paylaşımı) İşleyicisi - Electron ortamında getDisplayMedia çağrısını aktifleştirir
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ["screen", "window"] })
      .then((sources) => {
        if (sources.length > 0) {
          // Windows'ta sistem ses aktarımı (loopback) "screen" türündeki kaynaklarda çalışır.
          const screenSource = sources.find((s) => s.id.startsWith("screen:")) || sources[0];
          const isScreenSource = screenSource.id.startsWith("screen:");
          
          callback({
            video: screenSource,
            audio: isScreenSource ? "loopback" : undefined,
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
