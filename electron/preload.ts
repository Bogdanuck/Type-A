import { contextBridge, ipcRenderer } from 'electron';

export type AudioSource = 'system' | 'microphone';
export type ActivationMode = 'toggle' | 'hold';
export type ThemeMode = 'dark' | 'light';
export type IdleUnloadMinutes = 1 | 5 | 15 | 30 | 0;
export type HistoryRetentionHours = 1 | 6 | 24 | 72 | 168 | 240 | 720 | 0;
export type LanguageMode =
  | 'auto'
  | 'ru'
  | 'en'
  | 'es'
  | 'sr'
  | 'he'
  | 'be'
  | 'uk'
  | 'kk'
  | 'ky'
  | 'uz'
  | 'tg'
  | 'hy'
  | 'az'
  | 'ro'
  | 'tk';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface AppSettings {
  systemEnabled: boolean;
  microphoneEnabled: boolean;
  microphoneDeviceId: string;
  activeModelId: string;
  hotkey: string;
  activationMode: ActivationMode;
  autoType: boolean;
  autoCopy: boolean;
  idleUnloadMinutes: IdleUnloadMinutes;
  historyRetentionHours: HistoryRetentionHours;
  launchToTray: boolean;
  theme: ThemeMode;
  language: LanguageMode;
}

export interface ModelCatalogItem {
  id: string;
  title: string;
  description: string;
  languages: string[];
  approxSizeMb: number;
  license: string;
  source: string;
}

export interface ModelStatus {
  status: 'missing' | 'ready' | 'downloading' | 'corrupted' | 'error';
  modelId: string;
  modelDir: string;
  title: string;
  approxSizeMb: number;
  error?: string;
}

export interface ModelProgressEvent {
  modelId: string;
  type: 'progress' | 'done' | 'error';
  stage: string;
  progress: number;
  error?: string;
}

export interface SttChunkPayload {
  source: AudioSource;
  samples: Float32Array | number[];
  sampleRate: number;
  segmentId: string;
  sequence: number;
  final: boolean;
  startedAt: number;
  endedAt: number;
}

export interface SttEvent {
  type: 'partial' | 'final' | 'error' | 'status';
  source?: AudioSource;
  segmentId?: string;
  sequence?: number;
  text?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  status?: string;
}

export interface TranscriptSegment {
  id: string;
  source: AudioSource;
  text: string;
  startedAt: number;
  endedAt: number;
}

export interface HistoryRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  modelId: string;
  sources: AudioSource[];
  text: string;
  segments: TranscriptSegment[];
  starred?: boolean;
}

export interface HotkeyRegistrationPayload {
  accelerator: string;
  mode: ActivationMode;
}

export interface HotkeyStatus {
  ok: boolean;
  mode: ActivationMode;
  accelerator: string;
  error?: string;
}

export interface TrayState {
  isRecording: boolean;
  settings: AppSettings;
  modelStatus: ModelStatus;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  | 'unsupported';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  error?: string;
}

export type AppCommand =
  | 'toggle-recording'
  | 'start-recording'
  | 'stop-recording'
  | 'open-settings'
  | 'toggle-system'
  | 'toggle-microphone'
  | 'toggle-auto-type'
  | 'toggle-auto-copy'
  | 'unload-model';

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', settings),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on('settings:changed', listener);
    return () => {
      ipcRenderer.removeListener('settings:changed', listener);
    };
  },

  listInputDevices: async (): Promise<AudioInputDevice[]> => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audioinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
  },
  startSystemLoopback: (): Promise<boolean> => ipcRenderer.invoke('audio:startSystemLoopback'),
  stopSystemLoopback: (): Promise<boolean> => ipcRenderer.invoke('audio:stopSystemLoopback'),

  listModels: (): Promise<ModelCatalogItem[]> => ipcRenderer.invoke('stt:listModels'),
  getModelStatus: (modelId?: string): Promise<ModelStatus> => ipcRenderer.invoke('stt:getStatus', modelId),
  downloadModel: (modelId?: string): Promise<ModelStatus> => ipcRenderer.invoke('stt:download', modelId),
  cancelModelDownload: (): Promise<ModelStatus> => ipcRenderer.invoke('stt:cancelDownload'),
  deleteModel: (modelId?: string): Promise<ModelStatus> => ipcRenderer.invoke('stt:delete', modelId),
  setActiveModel: (modelId: string): Promise<ModelStatus> => ipcRenderer.invoke('stt:setActive', modelId),
  startStt: (): Promise<boolean> => ipcRenderer.invoke('stt:start'),
  pushSttChunk: (payload: SttChunkPayload): Promise<boolean> => ipcRenderer.invoke('stt:pushChunk', payload),
  stopStt: (): Promise<boolean> => ipcRenderer.invoke('stt:stop'),
  unloadStt: (): Promise<ModelStatus> => ipcRenderer.invoke('stt:unload'),
  onModelProgress: (callback: (event: ModelProgressEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ModelProgressEvent) => callback(payload);
    ipcRenderer.on('stt:modelProgress', listener);
    return () => ipcRenderer.removeListener('stt:modelProgress', listener);
  },
  onSttEvent: (callback: (event: SttEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SttEvent) => callback(payload);
    ipcRenderer.on('stt:event', listener);
    return () => ipcRenderer.removeListener('stt:event', listener);
  },

  registerHotkey: (payload: HotkeyRegistrationPayload): Promise<HotkeyStatus> =>
    ipcRenderer.invoke('hotkey:register', payload),
  unregisterHotkey: (): Promise<boolean> => ipcRenderer.invoke('hotkey:unregister'),
  onHotkeyToggle: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('hotkey:toggle', listener);
    return () => ipcRenderer.removeListener('hotkey:toggle', listener);
  },
  onHoldStart: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('hotkey:holdStart', listener);
    return () => ipcRenderer.removeListener('hotkey:holdStart', listener);
  },
  onHoldStop: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('hotkey:holdStop', listener);
    return () => ipcRenderer.removeListener('hotkey:holdStop', listener);
  },

  updateTray: (payload: TrayState): Promise<boolean> => ipcRenderer.invoke('tray:update', payload),
  onAppCommand: (callback: (command: AppCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: AppCommand) => callback(command);
    ipcRenderer.on('app:command', listener);
    return () => ipcRenderer.removeListener('app:command', listener);
  },

  listHistory: (): Promise<HistoryRecord[]> => ipcRenderer.invoke('history:list'),
  addHistory: (record: HistoryRecord): Promise<HistoryRecord> => ipcRenderer.invoke('history:add', record),
  deleteHistory: (id: string): Promise<boolean> => ipcRenderer.invoke('history:delete', id),
  copyHistory: (id: string): Promise<boolean> => ipcRenderer.invoke('history:copy', id),
  toggleHistoryStar: (id: string): Promise<HistoryRecord | null> => ipcRenderer.invoke('history:toggleStar', id),
  typeText: (text: string): Promise<boolean> => ipcRenderer.invoke('input:typeText', text),
  writeClipboard: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:writeText', text),

  showOverlay: (theme: ThemeMode): Promise<boolean> => ipcRenderer.invoke('overlay:show', theme),
  updateOverlayLevel: (level: number): Promise<boolean> => ipcRenderer.invoke('overlay:updateLevel', level),
  hideOverlay: (): Promise<boolean> => ipcRenderer.invoke('overlay:hide'),
  onOverlayTheme: (callback: (theme: ThemeMode) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: ThemeMode) => callback(theme);
    ipcRenderer.on('overlay:theme', listener);
    return () => ipcRenderer.removeListener('overlay:theme', listener);
  },
  onOverlayLevel: (callback: (level: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, level: number) => callback(level);
    ipcRenderer.on('overlay:level', listener);
    return () => ipcRenderer.removeListener('overlay:level', listener);
  },

  minimizeWindow: (): Promise<boolean> => ipcRenderer.invoke('window:minimize'),
  closeWindow: (): Promise<boolean> => ipcRenderer.invoke('window:close'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:openExternal', url),
  getSystemLocale: (): Promise<string> => ipcRenderer.invoke('app:getLocale'),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:getStatus'),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:check'),
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on('updates:status', listener);
    return () => {
      ipcRenderer.removeListener('updates:status', listener);
    };
  },
};

contextBridge.exposeInMainWorld('typeA', api);

declare global {
  interface Window {
    typeA: typeof api;
  }
}
