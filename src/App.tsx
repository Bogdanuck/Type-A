import {
  AppWindow,
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  FileText,
  GitBranch,
  Globe2,
  History,
  Info,
  Keyboard,
  Mail,
  Minus,
  Moon,
  MonitorSpeaker,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  RefreshCw,
  X,
} from 'lucide-react';
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppCommand,
  AppSettings,
  AudioSource,
  HistoryRecord,
  ModelCatalogItem,
  ModelProgressEvent,
  ModelStatus,
  SttEvent,
  TranscriptSegment,
  UpdateStatus,
} from '../electron/preload';
import {
  dateLocaleFor,
  getTranslations,
  languageOptions,
  resolveLocale,
  textDirection,
  type AppTranslations,
} from './i18n';
import { useAudioCapture } from './hooks/useAudioCapture';

const logoUrl = new URL('../Type-A.svg', import.meta.url).toString();
const companyUrl = 'https://assistgroup.tech';
const telegramUrl = 'https://t.me/assist_group_dev';
const contactEmail = 'dev@assistgroup.tech';
const githubUrl = 'https://github.com/Bogdanuck/Type-A';

type SidebarSection = 'history' | 'models' | 'settings' | 'info';
type CustomSelectValue = string | number;
type CustomSelectOption = { value: CustomSelectValue; label: string };

function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  onOpen,
  placement = 'down',
}: {
  value: CustomSelectValue;
  options: CustomSelectOption[];
  onChange: (value: CustomSelectValue) => void;
  disabled?: boolean;
  onOpen?: () => void;
  placement?: 'up' | 'down';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    onOpen?.();
    setOpen(true);
  }, [disabled, onOpen]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`custom-select placement-${placement}${open ? ' open' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="custom-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onFocus={onOpen}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        <span>{selectedOption?.label ?? ''}</span>
        <ChevronDown size={15} />
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={selected ? 'custom-select-option selected' : 'custom-select-option'}
                key={`${option.value}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {selected && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingHint({ label, text }: { label: string; text: string }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const visible = hovered || pinned;

  useEffect(() => {
    if (!pinned) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pinned]);

  return (
    <span
      className={visible ? 'setting-hint open' : 'setting-hint'}
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="setting-hint-trigger"
        aria-label={label}
        aria-expanded={visible}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPinned((current) => {
            const next = !current;
            if (!next) {
              setHovered(false);
            }
            return next;
          });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setPinned(false);
            setHovered(false);
            event.currentTarget.blur();
          }
        }}
      >
        <Info aria-hidden="true" />
      </button>
      {visible && (
        <span className="setting-hint-popover" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

function SettingLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="setting-label">
      <span>{label}</span>
      <SettingHint label={label} text={hint} />
    </span>
  );
}

const fallbackSettings: AppSettings = {
  systemEnabled: true,
  microphoneEnabled: true,
  microphoneDeviceId: '',
  activeModelId: 'parakeet-tdt-0.6b-v3-int8',
  hotkey: 'CommandOrControl+Shift+Space',
  activationMode: 'toggle',
  autoType: true,
  autoCopy: false,
  idleUnloadMinutes: 5,
  launchToTray: false,
  theme: 'dark',
  language: 'auto',
};

function formatDateTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function sourceLabel(source: AudioSource, t: AppTranslations): string {
  return source === 'system' ? t.systemAudio : t.microphone;
}

function createId(): string {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function appendText(base: string, next: string): string {
  const trimmedBase = base.trim();
  const trimmedNext = next.trim();
  if (!trimmedBase) {
    return trimmedNext;
  }
  if (!trimmedNext) {
    return trimmedBase;
  }
  return `${trimmedBase} ${trimmedNext}`;
}

function statusLabel(status: ModelStatus['status'], t: AppTranslations): string {
  const labels: Record<ModelStatus['status'], string> = {
    missing: t.statusMissing,
    ready: t.statusReady,
    downloading: t.statusDownloading,
    corrupted: t.statusCorrupted,
    error: t.statusError,
  };
  return labels[status];
}

function updateStatusLabel(status: UpdateStatus | null, t: AppTranslations): string {
  if (!status) return t.updatesChecking;
  if (status.state === 'checking') return t.updatesChecking;
  if (status.state === 'available') return `${t.updatesAvailable}: ${status.availableVersion ?? ''}`.trim();
  if (status.state === 'downloading') return `${t.updatesDownloading}: ${status.progress ?? 0}%`;
  if (status.state === 'downloaded') return t.updatesDownloaded;
  if (status.state === 'up-to-date') return t.updatesUpToDate;
  if (status.state === 'error') return status.error || t.updatesError;
  if (status.state === 'unsupported') return t.updatesUnsupported;
  return t.updatesCheck;
}

function formatModelSize(sizeMb: number): string {
  if (sizeMb >= 1024) {
    return `${(sizeMb / 1024).toFixed(sizeMb % 1024 === 0 ? 0 : 1)} GB`;
  }
  return `${sizeMb} MB`;
}

function modelLanguageLabel(languages: string[], t: AppTranslations): string {
  const normalized = languages.map((language) => language.toLowerCase());
  if (normalized.includes('ru') && normalized.includes('en')) {
    return t.multilingual;
  }
  if (normalized.includes('ru')) {
    return t.russian;
  }
  if (normalized.includes('en')) {
    return t.english;
  }
  return languages.join(' / ').toUpperCase();
}

function modelDisplayDescription(model: ModelCatalogItem, t: AppTranslations): string {
  const descriptions: Record<string, string> = {
    'parakeet-tdt-0.6b-v3-int8': t.modelParakeet,
    'gigaam-v3-ctc-punct-ru': t.modelGigaCtc,
    'gigaam-v3-rnnt-ru': t.modelGigaRnnt,
    'whisper-turbo': t.modelWhisperTurbo,
    'whisper-small': t.modelWhisperSmall,
    'whisper-small-en': t.modelWhisperSmallEn,
    'whisper-base-en': t.modelWhisperBaseEn,
  };
  return descriptions[model.id] ?? model.description;
}

function hotkeyStatusLabel(ok: boolean, t: AppTranslations): string {
  return ok ? '' : t.hotkeyUnavailable;
}

function keyFromCaptureEvent(event: KeyboardEvent): string {
  const namedKeys: Record<string, string> = {
    ' ': 'Space',
    Spacebar: 'Space',
    Enter: 'Enter',
    Return: 'Enter',
    Escape: 'Esc',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Tab: 'Tab',
  };

  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3).toUpperCase();
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }
  if (/^Numpad[0-9]$/.test(event.code)) {
    return `num${event.code.slice(6)}`;
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.key)) {
    return event.key.toUpperCase();
  }
  if (namedKeys[event.key]) {
    return namedKeys[event.key];
  }
  if (event.key.length === 1) {
    return event.key === '+' ? 'Plus' : event.key.toUpperCase();
  }
  return '';
}

function acceleratorFromCaptureEvent(event: KeyboardEvent): string {
  const key = keyFromCaptureEvent(event);
  if (!key || ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    return '';
  }

  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    modifiers.push('CommandOrControl');
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }

  if (modifiers.length === 0 && !/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return '';
  }

  return [...modifiers, key].join('+');
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings);
  const [models, setModels] = useState<ModelCatalogItem[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [modelProgress, setModelProgress] = useState<ModelProgressEvent | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [activeSection, setActiveSection] = useState<SidebarSection>('history');
  const [historySearch, setHistorySearch] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [partials, setPartials] = useState<Record<string, SttEvent>>({});
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const [hotkeyStatus, setHotkeyStatus] = useState('');
  const [hotkeyCaptureActive, setHotkeyCaptureActive] = useState(false);
  const [systemLocale, setSystemLocale] = useState(() => navigator.language || 'en-US');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  const textRef = useRef('');
  const settingsRef = useRef(settings);
  const recordingRef = useRef(false);
  const recordingRequestedRef = useRef(false);
  const sessionStartedAtRef = useRef(0);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const startRecordingActionRef = useRef<() => void>(() => undefined);
  const stopRecordingActionRef = useRef<() => void>(() => undefined);
  const toggleRecordingActionRef = useRef<() => void>(() => undefined);
  const patchSettingsActionRef = useRef<(patch: Partial<AppSettings>) => void>(() => undefined);

  const onChunk = useCallback(async (chunk: Parameters<typeof window.typeA.pushSttChunk>[0]) => {
    await window.typeA.pushSttChunk(chunk);
  }, []);

  const onLevel = useCallback((level: number) => {
    if (recordingRef.current) {
      void window.typeA.updateOverlayLevel(level);
    }
  }, []);

  const capture = useAudioCapture(onChunk, onLevel);
  const recordingActive = capture.status === 'recording' || capture.status === 'starting';
  const resolvedLocale = useMemo(() => resolveLocale(settings.language, systemLocale), [settings.language, systemLocale]);
  const t = useMemo(() => getTranslations(resolvedLocale), [resolvedLocale]);
  const dateLocale = useMemo(() => dateLocaleFor(resolvedLocale), [resolvedLocale]);
  const uiDirection = textDirection(resolvedLocale);

  const showNotice = useCallback((message: string) => {
    setNotice({ message });
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (capture.error) {
      showNotice(capture.error);
    }
  }, [capture.error, showNotice]);

  useEffect(() => {
    void window.typeA.getUpdateStatus().then(setUpdateStatus);
    const unsubscribe = window.typeA.onUpdateStatus(setUpdateStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (updateStatus?.state === 'downloaded') {
      showNotice(t.updatesDownloaded);
    }
  }, [showNotice, t.updatesDownloaded, updateStatus?.state]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    recordingRef.current = recordingActive;
  }, [recordingActive]);

  useEffect(() => {
    textRef.current = transcriptText;
  }, [transcriptText]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const activeModel = useMemo(
    () => models.find((model) => model.id === settings.activeModelId) ?? models[0],
    [models, settings.activeModelId],
  );

  const livePartials = useMemo(() => Object.values(partials)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
    .map((event) => event.text)
    .filter(Boolean)
    .join('\n'), [partials]);

  const liveTranscript = useMemo(
    () => livePartials ? appendText(transcriptText, livePartials) : transcriptText,
    [livePartials, transcriptText],
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) {
      return history;
    }
    return history.filter((record) =>
      record.text.toLowerCase().includes(query) ||
      record.modelId.toLowerCase().includes(query) ||
      record.sources.some((source) => sourceLabel(source, t).toLowerCase().includes(query)),
    );
  }, [history, historySearch, t]);

  const refreshModelStatus = useCallback(async (modelId = settingsRef.current.activeModelId) => {
    const status = await window.typeA.getModelStatus(modelId);
    setModelStatuses((current) => ({ ...current, [modelId]: status }));
    if (modelId === settingsRef.current.activeModelId) {
      setModelStatus(status);
    }
    return status;
  }, []);

  const refreshModelStatuses = useCallback(async (modelIds: string[]) => {
    const statuses = await Promise.all(modelIds.map((modelId) => window.typeA.getModelStatus(modelId)));
    setModelStatuses(Object.fromEntries(statuses.map((status) => [status.modelId, status])));
    const activeStatus = statuses.find((status) => status.modelId === settingsRef.current.activeModelId);
    if (activeStatus) {
      setModelStatus(activeStatus);
    }
    return statuses;
  }, []);

  const loadHistory = useCallback(async () => {
    const records = await window.typeA.listHistory();
    setHistory(records);
  }, []);

  const patchSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await window.typeA.setSettings(patch);
    settingsRef.current = next;
    setSettings(next);
    if (patch.activeModelId) {
      await refreshModelStatus(patch.activeModelId);
    }
    return next;
  }, [refreshModelStatus]);

  useEffect(() => {
    if (!hotkeyCaptureActive) {
      return undefined;
    }

    void window.typeA.unregisterHotkey();
    setHotkeyStatus(t.hotkeyCaptureActive);

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setHotkeyCaptureActive(false);
        return;
      }

      const accelerator = acceleratorFromCaptureEvent(event);
      if (!accelerator) {
        setHotkeyStatus(t.hotkeyModifierNeeded);
        return;
      }

      void patchSettings({ hotkey: accelerator }).finally(() => {
        setHotkeyCaptureActive(false);
      });
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      void window.typeA.registerHotkey({
        accelerator: settingsRef.current.hotkey,
        mode: settingsRef.current.activationMode,
      }).then((result) => {
        setHotkeyStatus(hotkeyStatusLabel(result.ok, t));
      });
    };
  }, [hotkeyCaptureActive, patchSettings, t]);

  const saveCurrentHistory = useCallback(async () => {
    const text = textRef.current.trim();
    if (!text || sessionStartedAtRef.current === 0) {
      return;
    }
    const sources: AudioSource[] = [
      ...(settingsRef.current.systemEnabled ? ['system' as const] : []),
      ...(settingsRef.current.microphoneEnabled ? ['microphone' as const] : []),
    ];
    await window.typeA.addHistory({
      id: createId(),
      startedAt: sessionStartedAtRef.current,
      endedAt: Date.now(),
      modelId: settingsRef.current.activeModelId,
      sources,
      text,
      segments: segmentsRef.current,
    });
    await loadHistory();
  }, [loadHistory]);

  const startRecording = useCallback(async () => {
    if (recordingRequestedRef.current || recordingRef.current) {
      return;
    }
    recordingRequestedRef.current = true;
    const status = await refreshModelStatus();
    if (status.status !== 'ready') {
      recordingRequestedRef.current = false;
      showNotice(t.downloadModelBeforeRecording);
      setActiveSection('models');
      return;
    }
    if (!recordingRequestedRef.current) {
      return;
    }
    setPartials({});
    setSegments([]);
    setTranscriptText('');
    textRef.current = '';
    const startedAt = Date.now();
    sessionStartedAtRef.current = startedAt;
    await window.typeA.showOverlay(settingsRef.current.theme);
    await capture.startCapture(settingsRef.current);
  }, [capture, refreshModelStatus, showNotice, t.downloadModelBeforeRecording]);

  const applyTranscriptOutput = useCallback(async () => {
    const text = textRef.current.trim();
    if (!text || sessionStartedAtRef.current === 0) {
      return;
    }

    if (settingsRef.current.autoType) {
      try {
        await window.typeA.typeText(text);
      } catch (error) {
        showNotice(error instanceof Error ? error.message : String(error));
      }
    }

    if (settingsRef.current.autoCopy) {
      await window.typeA.writeClipboard(text);
    }
  }, [showNotice]);

  const stopRecording = useCallback(async () => {
    if (!recordingRequestedRef.current && !recordingRef.current && capture.status !== 'error') {
      return;
    }
    recordingRequestedRef.current = false;
    await capture.stopCapture();
    await window.typeA.stopStt();
    await window.typeA.hideOverlay();
    setPartials({});
    await new Promise((resolve) => setTimeout(resolve, 120));
    await applyTranscriptOutput();
    await saveCurrentHistory();
    sessionStartedAtRef.current = 0;
  }, [applyTranscriptOutput, capture, saveCurrentHistory]);

  const toggleRecording = useCallback(async () => {
    if (recordingRequestedRef.current || recordingRef.current) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [startRecording, stopRecording]);

  useEffect(() => {
    startRecordingActionRef.current = () => void startRecording();
    stopRecordingActionRef.current = () => void stopRecording();
    toggleRecordingActionRef.current = () => void toggleRecording();
    patchSettingsActionRef.current = (patch) => void patchSettings(patch);
  }, [patchSettings, startRecording, stopRecording, toggleRecording]);

  useEffect(() => {
    void (async () => {
      const [nextSettings, nextModels] = await Promise.all([
        window.typeA.getSettings(),
        window.typeA.listModels(),
      ]);
      void window.typeA.getSystemLocale().then(setSystemLocale);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      await Promise.all([
        refreshModelStatuses(nextModels.map((model) => model.id)),
        capture.refreshDevices(),
        loadHistory(),
      ]);
      setModels(nextModels);
    })();
    // Initial desktop bootstrap intentionally runs once; the called functions are stable IPC wrappers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadHistory();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadHistory]);

  useEffect(() => window.typeA.onSettingsChanged((next) => {
    settingsRef.current = next;
    setSettings(next);
  }), []);

  useEffect(() => {
    const unsubscribeProgress = window.typeA.onModelProgress((event) => {
      setModelProgress(event);
      if (event.type === 'done' || event.type === 'error') {
        void refreshModelStatus(event.modelId);
      }
    });
    const unsubscribeStt = window.typeA.onSttEvent((event) => {
      if (event.type === 'status' && event.status) {
        const message = event.status === 'model-loaded' ? t.modelLoaded : t.modelUnloaded;
        showNotice(message);
        return;
      }
      if (event.type === 'error') {
        showNotice(event.error ?? t.speechRecognitionFailed);
        return;
      }
      if (!event.text || !event.segmentId || !event.source) {
        return;
      }
      const key = `${event.source}:${event.segmentId}`;
      if (event.type === 'partial') {
        setPartials((current) => ({ ...current, [key]: event }));
        return;
      }
      setPartials((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      const segment: TranscriptSegment = {
        id: key,
        source: event.source,
        text: event.text,
        startedAt: event.startedAt ?? Date.now(),
        endedAt: event.endedAt ?? Date.now(),
      };
      setSegments((current) => [...current, segment]);
      setTranscriptText((current) => {
        const nextText = appendText(current, event.text ?? '');
        textRef.current = nextText;
        return nextText;
      });
    });
    return () => {
      unsubscribeProgress();
      unsubscribeStt();
    };
  }, [refreshModelStatus, showNotice, t.modelLoaded, t.modelUnloaded, t.speechRecognitionFailed]);

  useEffect(() => {
    void window.typeA.updateTray({
      isRecording: recordingActive,
      settings,
      modelStatus: modelStatus ?? {
        status: 'missing',
        modelId: settings.activeModelId,
        modelDir: '',
        title: activeModel?.title ?? 'Model',
        approxSizeMb: activeModel?.approxSizeMb ?? 0,
      },
    });
  }, [activeModel, modelStatus, recordingActive, settings]);

  useEffect(() => {
    void window.typeA.registerHotkey({
      accelerator: settings.hotkey,
      mode: settings.activationMode,
    }).then((result) => {
      setHotkeyStatus(hotkeyStatusLabel(result.ok, t));
    });
  }, [settings.activationMode, settings.hotkey, t]);

  useEffect(() => {
    const unsubToggle = window.typeA.onHotkeyToggle(() => {
      toggleRecordingActionRef.current();
    });
    const unsubHoldStart = window.typeA.onHoldStart(() => {
      if (settingsRef.current.activationMode === 'hold') {
        startRecordingActionRef.current();
      }
    });
    const unsubHoldStop = window.typeA.onHoldStop(() => {
      if (settingsRef.current.activationMode === 'hold') {
        stopRecordingActionRef.current();
      }
    });
    const unsubCommand = window.typeA.onAppCommand((command: AppCommand) => {
      if (command === 'toggle-recording') toggleRecordingActionRef.current();
      if (command === 'start-recording') startRecordingActionRef.current();
      if (command === 'stop-recording') stopRecordingActionRef.current();
      if (command === 'open-settings') setActiveSection('settings');
      if (command === 'toggle-system') patchSettingsActionRef.current({ systemEnabled: !settingsRef.current.systemEnabled });
      if (command === 'toggle-microphone') patchSettingsActionRef.current({ microphoneEnabled: !settingsRef.current.microphoneEnabled });
      if (command === 'toggle-auto-type') patchSettingsActionRef.current({ autoType: !settingsRef.current.autoType });
      if (command === 'toggle-auto-copy') patchSettingsActionRef.current({ autoCopy: !settingsRef.current.autoCopy });
      if (command === 'unload-model') void window.typeA.unloadStt().then(setModelStatus);
    });
    return () => {
      unsubToggle();
      unsubHoldStart();
      unsubHoldStop();
      unsubCommand();
    };
  }, []);

  useEffect(() => {
    if (recordingActive) {
      void window.typeA.showOverlay(settings.theme);
    } else {
      void window.typeA.hideOverlay();
    }
  }, [recordingActive, settings.theme]);

  const downloadSelectedModel = async (modelId = settings.activeModelId) => {
    const status = await window.typeA.downloadModel(modelId);
    setModelStatuses((current) => ({ ...current, [modelId]: status }));
    if (modelId === settingsRef.current.activeModelId) {
      setModelStatus(status);
    }
  };

  const deleteSelectedModel = async (modelId = settings.activeModelId) => {
    const status = await window.typeA.deleteModel(modelId);
    setModelStatuses((current) => ({ ...current, [modelId]: status }));
    if (modelId === settingsRef.current.activeModelId) {
      setModelStatus(status);
    }
  };

  const selectModel = async (modelId: string) => {
    const status = await window.typeA.setActiveModel(modelId);
    setModelStatus(status);
    setModelStatuses((current) => ({ ...current, [modelId]: status }));
    settingsRef.current = { ...settingsRef.current, activeModelId: modelId };
    setSettings((current) => ({ ...current, activeModelId: modelId }));
  };

  const copyHistoryRecord = async (record: HistoryRecord) => {
    await window.typeA.copyHistory(record.id);
    showNotice(t.historyCopied);
  };

  const deleteHistoryRecord = async (record: HistoryRecord) => {
    await window.typeA.deleteHistory(record.id);
    await loadHistory();
  };

  const toggleHistoryStar = async (record: HistoryRecord) => {
    const updated = await window.typeA.toggleHistoryStar(record.id);
    if (!updated) {
      return;
    }
    setHistory((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const navItems: Array<{ id: SidebarSection; label: string; icon: typeof History }> = [
    { id: 'history', label: t.navHistory, icon: History },
    { id: 'models', label: t.navModels, icon: BrainCircuit },
    { id: 'settings', label: t.navSettings, icon: Settings },
    { id: 'info', label: t.navInfo, icon: Info },
  ];

  const renderHistory = () => (
    <section className="content-panel history-view">
      <div className="content-stack">
        <div className="content-header">
          <div>
            <span className="section-index">{t.historyTitle}</span>
          </div>
        </div>

        {recordingActive && (
          <div className="live-capture-strip">
            <span className="live-dot" />
            <div>
              <strong>{t.liveCaptureTitle}</strong>
              <p>{liveTranscript || t.liveCaptureBody}</p>
            </div>
          </div>
        )}

        <div className="history-feed-shell">
          <label className="search-control history-search">
            <Search size={15} />
            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder={t.historySearch}
            />
          </label>

          <div className="transcription-feed">
            {filteredHistory.length === 0 ? (
              <div className="empty-state history-empty">
                <FileText size={26} />
                <h2>{t.historyEmptyTitle}</h2>
                <p>{t.historyEmptyBody}</p>
              </div>
            ) : filteredHistory.map((record) => (
              <article className={record.starred ? 'transcription-card starred' : 'transcription-card'} key={record.id}>
                <div className="transcription-card-head">
                  <h2>{formatDateTime(record.endedAt, dateLocale)}</h2>
                  <div className="transcription-actions">
                    <button type="button" className="history-card-action" title={t.copy} aria-label={t.copy} onClick={() => void copyHistoryRecord(record)}>
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      className={record.starred ? 'history-card-action active' : 'history-card-action'}
                      title={record.starred ? t.unstar : t.star}
                      aria-label={record.starred ? t.unstar : t.star}
                      onClick={() => void toggleHistoryStar(record)}
                    >
                      <Star size={15} fill={record.starred ? 'currentColor' : 'none'} />
                    </button>
                    <button type="button" className="history-card-action danger" title={t.delete} aria-label={t.delete} onClick={() => void deleteHistoryRecord(record)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="transcription-text">{record.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  const renderModels = () => (
    <section className="content-panel">
      <div className="content-stack">
        <div className="content-header model-section-header">
          <div>
            <span className="section-index">{t.modelsTitle}</span>
            <p>{t.modelsSubtitle}</p>
          </div>
        </div>
        <div className="model-grid">
          {models.map((model) => {
          const active = model.id === settings.activeModelId;
          const cardStatus = modelStatuses[model.id];
          const modelReady = cardStatus?.status === 'ready';
          const modelDownloading = cardStatus?.status === 'downloading';
          const progressEventActive = modelProgress?.modelId === model.id && modelProgress.type === 'progress';
          const currentProgress = progressEventActive
            ? Math.max(0, Math.min(100, Math.round(modelProgress.progress)))
            : modelDownloading ? 0 : null;
          const downloadBusy = modelProgress?.type === 'progress';
          const deleteAvailable = modelReady || cardStatus?.status === 'corrupted';
          const cardActionDisabled = recordingActive || modelDownloading || (!modelReady && downloadBusy) || active;
          const deleteDisabled = recordingActive || modelDownloading;
          const activateModelCard = (): void => {
            if (cardActionDisabled) {
              return;
            }
            if (modelReady) {
              void selectModel(model.id);
              return;
            }
            void downloadSelectedModel(model.id);
          };
          const onModelCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
            if (event.key !== 'Enter' && event.key !== ' ') {
              return;
            }
            event.preventDefault();
            activateModelCard();
          };
          const cardClassName = [
            active ? 'model-card active' : 'model-card',
            cardActionDisabled ? '' : 'clickable',
          ].filter(Boolean).join(' ');
          return (
            <article
              className={cardClassName}
              key={model.id}
              role={cardActionDisabled ? undefined : 'button'}
              tabIndex={cardActionDisabled ? undefined : 0}
              onClick={activateModelCard}
              onKeyDown={onModelCardKeyDown}
            >
              <div className="model-card-body">
                <div className="model-card-copy">
                  <strong>{model.title}</strong>
                  <p>{modelDisplayDescription(model, t)}</p>
                </div>
              </div>
              <div className={currentProgress === null ? 'model-download-progress idle' : 'model-download-progress'}>
                <div
                  className="model-progress-track"
                  role={currentProgress === null ? undefined : 'progressbar'}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={currentProgress ?? undefined}
                >
                  <span style={{ width: `${currentProgress ?? 0}%` }} />
                </div>
                <span className="model-progress-value">{currentProgress ?? 0}%</span>
              </div>
              <div className="model-card-footer">
                <div className="model-card-meta">
                  <span><Globe2 size={14} /> {modelLanguageLabel(model.languages, t)}</span>
                  <span><Download size={14} /> {formatModelSize(model.approxSizeMb)}</span>
                </div>
                <div className="model-card-actions">
                  {modelReady && active && (
                    <span className="model-in-use">
                      <Check size={14} />
                      {t.inUse}
                    </span>
                  )}
                  {deleteAvailable && (
                    <button
                      type="button"
                      className="model-action-button danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteSelectedModel(model.id);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      disabled={deleteDisabled}
                    >
                      <Trash2 size={14} />
                      {t.delete}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
          })}
        </div>
      </div>
    </section>
  );

  const renderSettings = () => (
    <section className="content-panel settings-view">
      <div className="content-header">
        <div>
          <span className="section-index">{t.settingsTitle}</span>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-group">
          <h2><MonitorSpeaker size={16} /> {t.sources}</h2>
          <div className="switch-row">
            <SettingLabel label={t.systemAudio} hint={t.systemAudioHelp} />
            <input
              type="checkbox"
              aria-label={t.systemAudio}
              checked={settings.systemEnabled}
              disabled={recordingActive}
              onChange={(event) => void patchSettings({ systemEnabled: event.target.checked })}
            />
          </div>
          <label className="switch-row">
            <span>{t.microphone}</span>
            <input
              type="checkbox"
              checked={settings.microphoneEnabled}
              disabled={recordingActive}
              onChange={(event) => void patchSettings({ microphoneEnabled: event.target.checked })}
            />
          </label>
          <label className="field-label">
            {t.microphoneDevice}
            <CustomSelect
              value={settings.microphoneDeviceId}
              disabled={recordingActive || !settings.microphoneEnabled}
              onOpen={() => void capture.refreshDevices()}
              onChange={(value) => void patchSettings({ microphoneDeviceId: String(value) })}
              options={[
                { value: '', label: t.defaultMicrophone },
                ...capture.devices.map((device) => ({ value: device.deviceId, label: device.label })),
              ]}
            />
          </label>
        </section>

        <section className="settings-group">
          <h2><Keyboard size={16} /> {t.activation}</h2>
          <div className="field-label">
            <SettingLabel label={t.hotkey} hint={t.hotkeyCaptureIdle} />
            <button
              type="button"
              className={hotkeyCaptureActive ? 'hotkey-capture active' : 'hotkey-capture'}
              onClick={() => setHotkeyCaptureActive(true)}
              disabled={recordingActive}
            >
              <Keyboard size={15} />
              <span>{hotkeyCaptureActive ? t.hotkeyCaptureActive : settings.hotkey}</span>
            </button>
          </div>
          <div className="switch-row">
            <SettingLabel
              label={t.holdModeSwitch}
              hint={`${t.holdModeEnabledHelp} ${t.holdModeDisabledHelp}`}
            />
            <input
              type="checkbox"
              aria-label={t.holdModeSwitch}
              checked={settings.activationMode === 'hold'}
              disabled={recordingActive}
              onChange={(event) => void patchSettings({ activationMode: event.target.checked ? 'hold' : 'toggle' })}
            />
          </div>
          {hotkeyStatus && <span className="hint">{hotkeyStatus}</span>}
        </section>

        <section className="settings-group">
          <h2><Clipboard size={16} /> {t.outputText}</h2>
          <label className="switch-row">
            <span className="switch-copy">
              <strong>{t.typeIntoActiveField}</strong>
              <small>{t.typeIntoActiveFieldHelp}</small>
            </span>
            <input
              type="checkbox"
              checked={settings.autoType}
              onChange={(event) => void patchSettings({ autoType: event.target.checked })}
            />
          </label>
          <label className="switch-row">
            <span className="switch-copy">
              <strong>{t.copyToClipboard}</strong>
              <small>{t.copyToClipboardHelp}</small>
            </span>
            <input
              type="checkbox"
              checked={settings.autoCopy}
              onChange={(event) => void patchSettings({ autoCopy: event.target.checked })}
            />
          </label>
          <span className="field-help">{t.bothOutputsHelp}</span>
        </section>

        <section className="settings-group">
          <h2><AppWindow size={16} /> {t.application}</h2>
          <label className="field-label">
            {t.idleUnload}
            <CustomSelect
              value={settings.idleUnloadMinutes}
              onChange={(value) => void patchSettings({ idleUnloadMinutes: Number(value) as AppSettings['idleUnloadMinutes'] })}
              options={[
                { value: 1, label: t.oneMinute },
                { value: 5, label: t.fiveMinutes },
                { value: 15, label: t.fifteenMinutes },
                { value: 30, label: t.thirtyMinutes },
                { value: 0, label: t.never },
              ]}
            />
          </label>
          <div className="switch-row">
            <SettingLabel label={t.launchToTray} hint={t.launchToTrayHelp} />
            <input
              type="checkbox"
              aria-label={t.launchToTray}
              checked={settings.launchToTray}
              onChange={(event) => void patchSettings({ launchToTray: event.target.checked })}
            />
          </div>
        </section>

        <section className="settings-group">
          <h2><SlidersHorizontal size={16} /> {t.interface}</h2>
          <div className="field-label">
            {t.theme}
            <button
              type="button"
              className="theme-switch"
              data-mode={settings.theme}
              role="switch"
              aria-checked={settings.theme === 'light'}
              aria-label={`${t.theme}: ${settings.theme === 'light' ? t.light : t.dark}`}
              title={settings.theme === 'light' ? t.light : t.dark}
              onClick={() => void patchSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
            >
              <Moon aria-hidden="true" />
              <Sun aria-hidden="true" />
            </button>
          </div>
          <label className="field-label">
            {t.language}
            <CustomSelect
              value={settings.language}
              placement="up"
              onChange={(value) => void patchSettings({ language: String(value) as AppSettings['language'] })}
              options={languageOptions.map((language) => ({
                value: language.id,
                label: language.id === 'auto'
                  ? `${t.autoLanguage} (${t.autoLanguageDetail}: ${systemLocale})`
                  : language.label,
              }))}
            />
          </label>
        </section>
      </div>
    </section>
  );

  const renderInfo = () => {
    const contactLinks = [
      { icon: Globe2, label: t.infoWebsite, value: 'assistgroup.tech', href: companyUrl },
      { icon: Send, label: t.infoTelegram, value: '@assist_group_dev', href: telegramUrl },
      { icon: Mail, label: t.infoEmail, value: contactEmail, href: `mailto:${contactEmail}` },
      { icon: GitBranch, label: t.infoGithub, value: 'Bogdanuck/Type-A', href: githubUrl },
    ];

    return (
      <section className="content-panel info-view">
        <div className="content-stack">
          <div className="content-header">
            <div>
              <span className="section-index">{t.infoTitle}</span>
            </div>
          </div>
          <div className="info-layout">
            <section className="info-profile">
              <div className="info-company">
                <div className="info-company-brand">
                  <img src={logoUrl} alt="Type-A" />
                  <div>
                    <span>{t.infoCompanyLabel}</span>
                    <strong>Assist Group Team</strong>
                  </div>
                </div>
                <p>{t.infoCompanyDescription}</p>
              </div>
            </section>

            <section className="info-links" aria-label={t.infoContactsLabel}>
              {contactLinks.map(({ icon: Icon, label, value, href }) => (
                <button
                  type="button"
                  className="info-link"
                  key={href}
                  title={`${t.infoOpenLink}: ${value}`}
                  onClick={() => void window.typeA.openExternal(href)}
                >
                  <Icon size={15} />
                  <span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </section>
          </div>
          <section className="info-update" aria-label={t.updatesTitle}>
            <div className="info-update-icon"><RefreshCw size={16} aria-hidden="true" /></div>
            <div className="info-update-copy">
              <strong>{t.updatesTitle}</strong>
              <span>{t.updatesCurrentVersion}: {updateStatus?.currentVersion ?? '...'}</span>
              <small>{updateStatusLabel(updateStatus, t)}</small>
              {updateStatus?.state === 'downloading' && (
                <span className="info-update-progress" aria-label={`${updateStatus.progress ?? 0}%`}>
                  <span style={{ width: `${updateStatus.progress ?? 0}%` }} />
                </span>
              )}
            </div>
            {updateStatus?.state === 'downloaded' ? (
              <button type="button" className="info-update-action" onClick={() => void window.typeA.installUpdate()}>
                {t.updatesRestart}
              </button>
            ) : (
              <button
                type="button"
                className="info-update-action"
                disabled={updateStatus?.state === 'checking' || updateStatus?.state === 'downloading' || updateStatus?.state === 'unsupported'}
                onClick={() => void window.typeA.checkForUpdates().then(setUpdateStatus)}
              >
                {t.updatesCheck}
              </button>
            )}
          </section>
        </div>
      </section>
    );
  };

  const renderContent = () => {
    if (activeSection === 'models') return renderModels();
    if (activeSection === 'settings') return renderSettings();
    if (activeSection === 'info') return renderInfo();
    return renderHistory();
  };

  return (
    <div className="typea-page" data-theme={settings.theme} lang={dateLocale} dir={uiDirection}>
      <aside className="workspace-sidebar typea-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <div className="product-brand">
              <img src={logoUrl} alt="Type-A" />
              <span>Type-A</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-section collapsible-section typea-nav" aria-label="Type-A sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                type="button"
                className={active ? 'sidebar-switch-row active' : 'sidebar-switch-row'}
                key={item.id}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="sidebar-switch-icon"><Icon size={14} /></span>
                <span className="sidebar-switch-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {capture.error && (
          <div className="sidebar-section collapsible-section">
            <p className="sidebar-note">{capture.error}</p>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="sidebar-user-button typea-status-card">
            <span className={recordingActive ? 'status-dot active' : 'status-dot'} />
            <span>
              <strong>{recordingActive ? t.recording : t.ready}</strong>
              <small>{activeModel?.title ?? settings.activeModelId}</small>
            </span>
          </div>
        </div>
      </aside>

      <section className="typea-main">
        <header className="titlebar">
          <div className="titlebar-status">
            <span>{modelStatus ? statusLabel(modelStatus.status, t) : t.checkingModel}</span>
          </div>
          <div className="window-actions">
            <button type="button" aria-label="Minimize" onClick={() => void window.typeA.minimizeWindow()}>
              <Minus size={16} />
            </button>
            <button type="button" aria-label="Close" onClick={() => void window.typeA.closeWindow()}>
              <X size={16} />
            </button>
          </div>
        </header>
        {renderContent()}
      </section>

      {notice && (
        <div className="toast">
          <span>{notice.message}</span>
        </div>
      )}
    </div>
  );
}
