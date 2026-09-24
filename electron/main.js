const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require("electron");
const path = require("path");

// Ekran ve Ses Yakalama için Chromium Flag'leri
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
app.commandLine.appendSwitch("allow-http-screen-capture");

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
          callback({ video: sources[0], audio: "loopback" });
        } else {
          callback(null);
        }
      })
      .catch((err) => {
        console.error("Display media handler hatası:", err);
        callback(null);
      });
  });

  // Geliştirme modunda localhost, prodüksiyonda yerel veya yayınlanan URL
  const startUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
  mainWindow.loadURL(startUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
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

app.whenReady().then(createWindow);

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
