import { app } from 'electron';
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UpdateStatus } from './preload';

const { autoUpdater } = electronUpdater;
const startupDelayMs = 15_000;
const checkIntervalMs = 6 * 60 * 60 * 1_000;

let status: UpdateStatus = {
  state: 'idle',
  currentVersion: app.getVersion(),
};
let startupTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;
let initialized = false;
let sendStatus: ((value: UpdateStatus) => void) | null = null;

function publish(patch: Partial<UpdateStatus>): UpdateStatus {
  status = { ...status, ...patch, currentVersion: app.getVersion() };
  sendStatus?.(status);
  return status;
}

function macUpdatesEnabled(): boolean {
  if (process.platform !== 'darwin') return true;
  try {
    const packageJson = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as {
      typeAAutoUpdateEnabled?: unknown;
    };
    return packageJson.typeAAutoUpdateEnabled !== false;
  } catch {
    return false;
  }
}

function updateAvailable(info: UpdateInfo): void {
  publish({ state: 'available', availableVersion: info.version, progress: 0, error: undefined });
}

function updateProgress(progress: ProgressInfo): void {
  publish({
    state: 'downloading',
    availableVersion: status.availableVersion,
    progress: Math.max(0, Math.min(100, Math.round(progress.percent))),
    error: undefined,
  });
}

function friendlyError(error: Error): string {
  const message = error.message.replace(/\s+/g, ' ').trim();
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

export function initializeUpdater(sender: (value: UpdateStatus) => void): void {
  if (initialized) return;
  initialized = true;
  sendStatus = sender;

  if (!app.isPackaged || !macUpdatesEnabled()) {
    publish({ state: 'unsupported', progress: undefined, error: undefined });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => publish({ state: 'checking', error: undefined }));
  autoUpdater.on('update-available', updateAvailable);
  autoUpdater.on('update-not-available', (info) => publish({
    state: 'up-to-date',
    availableVersion: info.version,
    progress: undefined,
    error: undefined,
  }));
  autoUpdater.on('download-progress', updateProgress);
  autoUpdater.on('update-downloaded', (info) => publish({
    state: 'downloaded',
    availableVersion: info.version,
    progress: 100,
    error: undefined,
  }));
  autoUpdater.on('error', (error) => publish({ state: 'error', error: friendlyError(error) }));

  startupTimer = setTimeout(() => void checkForUpdates(), startupDelayMs);
  intervalTimer = setInterval(() => void checkForUpdates(), checkIntervalMs);
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged || !macUpdatesEnabled()) {
    return publish({ state: 'unsupported', progress: undefined, error: undefined });
  }
  if (status.state === 'checking' || status.state === 'downloading' || status.state === 'downloaded') {
    return status;
  }
  try {
    publish({ state: 'checking', error: undefined });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publish({ state: 'error', error: friendlyError(error instanceof Error ? error : new Error(String(error))) });
  }
  return status;
}

export function installDownloadedUpdate(): boolean {
  if (status.state !== 'downloaded') return false;
  autoUpdater.quitAndInstall(false, true);
  return true;
}

export function shutdownUpdater(): void {
  if (startupTimer) clearTimeout(startupTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  startupTimer = null;
  intervalTimer = null;
}
