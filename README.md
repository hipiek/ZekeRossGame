# ZekeRossGame

A mobile game about Zeke Ross (otherwise known as ZGross).

This repo contains **SNAP SQUAD: Clout Empire** — a tap / idle / collection game
starring the crew as 20 collectible characters. It runs as an installable web app
(PWA) and is packaged as a native **Android app** you can download and sideload.

## 📲 Download the Android app

Grab the latest `SnapSquad-*.apk` from the
[**Releases**](../../releases) page, then on your phone:

1. Download the `.apk`.
2. Open it — if prompted, allow **"Install unknown apps"** for your browser/file manager.
3. Tap **Install**, then launch **SNAP SQUAD** from your app drawer.

> The APK is debug-signed for easy sideloading, so Android may warn about an
> "unknown developer." That's expected for apps installed outside the Play Store.

## 🎮 Play in a browser

The game is a self-contained PWA in [`game/`](game/). Serve it and open it:

```bash
cd game
python3 -m http.server 8000
# visit http://localhost:8000
```

See [`game/README.md`](game/README.md) for the full feature list.

## 🛠️ How the Android build works

The APK is produced by wrapping the `game/` web app with
[Capacitor](https://capacitorjs.com/), which embeds all assets so the game works
fully offline with no server.

- [`capacitor.config.json`](capacitor.config.json) — app id, name, and `webDir: game`.
- [`scripts/gen_android_icons.py`](scripts/gen_android_icons.py) — regenerates the
  branded launcher icons in [`resources/android-res/`](resources/android-res/) from
  the game's app icon.
- [`.github/workflows/android-release.yml`](.github/workflows/android-release.yml) —
  builds the APK in CI and publishes a Release.

### Cut a release

CI builds the APK and publishes a GitHub Release when any of these happen:

- a `v*` tag is pushed (e.g. `v1.0.0`), **or**
- a commit message contains `[release]`, **or**
- the **"Build Android APK & Release"** workflow is run manually from the Actions tab.

The release version comes from the tag, the manual input, or the `version`
field in [`package.json`](package.json) (→ `v<version>`). The release tag is
created by CI, so no local tag push is required:

```bash
git commit -m "Ship the build [release]"
git push
```

### Build the APK locally

Requires Node 20+, JDK 17, and the Android SDK (platform 34, build-tools 34).

```bash
npm ci
npx cap add android
cp -R resources/android-res/. android/app/src/main/res/
npx cap sync android
cd android && ./gradlew assembleDebug
# APK -> android/app/build/outputs/apk/debug/app-debug.apk
```
