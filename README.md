<p align="center">
  <img src="./Type-A.svg" width="72" alt="Type-A logo" />
</p>

<h1 align="center">Type-A</h1>

<p align="center">
  Free, local-first voice typing for desktop.
</p>

<p align="center">
  <a href="https://type-a.ru/download/windows-x64"><strong>Download for Windows</strong></a>
  ·
  <a href="https://type-a.ru">Website</a>
  ·
  <a href="https://t.me/assist_group_dev">Telegram</a>
</p>

## What it does

Type-A captures microphone or system audio, recognizes speech with a local model, and types the result into the active text field. It can also keep the result in the clipboard.

- Toggle and hold-to-record hotkey modes.
- Direct typing into the focused application.
- Microphone and system-audio capture.
- Local transcription history with configurable automatic cleanup (three days by default).
- On-demand Parakeet, GigaAM, and Whisper models.
- Tray controls, recording indicator, and automatic updates.
- Russian, English, and system-language UI localization.

## Platforms

| Platform | Status | Package |
| --- | --- | --- |
| Windows x64 | Stable | NSIS installer |
| macOS Intel / Apple Silicon | Beta | DMG and ZIP |
| Linux x64 | Beta | AppImage and DEB |

Direct typing and system-audio capture are currently considered stable on Windows. macOS and Linux builds require additional platform QA.

## Privacy

Speech recognition runs on the user's computer. Audio and transcripts are not sent to Assist Group. Network access is used to download selected models and application updates. Local history is kept for three days by default; the retention period can be changed in Settings from one hour to unlimited storage.

## Development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

```bash
npm run lint
npm run build
npm run package
```

Platform distributions are built with `npm run dist:win`, `npm run dist:mac`, and `npm run dist:linux`. Tags matching `vX.Y.Z` run the GitHub Actions release matrix.

## Stack

Electron, TypeScript, React, electron-vite, electron-builder, sherpa-onnx-node.

## License

Type-A source code is available under the [MIT License](./LICENSE). Downloaded speech-recognition models retain their own licenses.
