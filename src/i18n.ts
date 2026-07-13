import type { LanguageMode } from '../electron/preload';

export type SupportedLocale = Exclude<LanguageMode, 'auto'>;

export type TranslationKey =
  | 'navHistory'
  | 'navModels'
  | 'navSettings'
  | 'navInfo'
  | 'statusMissing'
  | 'statusReady'
  | 'statusDownloading'
  | 'statusCorrupted'
  | 'statusError'
  | 'checkingModel'
  | 'recording'
  | 'ready'
  | 'dismiss'
  | 'historyTitle'
  | 'historySearch'
  | 'historyEmptyTitle'
  | 'historyEmptyBody'
  | 'historyCopied'
  | 'liveCaptureTitle'
  | 'liveCaptureBody'
  | 'copy'
  | 'star'
  | 'unstar'
  | 'delete'
  | 'modelsTitle'
  | 'modelsSubtitle'
  | 'download'
  | 'inUse'
  | 'multilingual'
  | 'russian'
  | 'english'
  | 'settingsTitle'
  | 'sources'
  | 'systemAudio'
  | 'systemAudioHelp'
  | 'microphone'
  | 'microphoneDevice'
  | 'defaultMicrophone'
  | 'activation'
  | 'hotkey'
  | 'hotkeyCaptureIdle'
  | 'hotkeyCaptureActive'
  | 'hotkeyModifierNeeded'
  | 'hotkeyUnavailable'
  | 'hotkeyHoldActive'
  | 'hotkeyToggleActive'
  | 'mode'
  | 'toggleMode'
  | 'holdMode'
  | 'activationHelp'
  | 'holdModeSwitch'
  | 'holdModeEnabledHelp'
  | 'holdModeDisabledHelp'
  | 'outputText'
  | 'typeIntoActiveField'
  | 'typeIntoActiveFieldHelp'
  | 'copyToClipboard'
  | 'copyToClipboardHelp'
  | 'bothOutputsHelp'
  | 'idleUnload'
  | 'oneMinute'
  | 'fiveMinutes'
  | 'fifteenMinutes'
  | 'thirtyMinutes'
  | 'never'
  | 'launchToTray'
  | 'launchToTrayHelp'
  | 'application'
  | 'interface'
  | 'theme'
  | 'dark'
  | 'light'
  | 'language'
  | 'autoLanguage'
  | 'autoLanguageDetail'
  | 'infoTitle'
  | 'infoCompanyLabel'
  | 'infoCompanyDescription'
  | 'infoContactsLabel'
  | 'infoWebsite'
  | 'infoTelegram'
  | 'infoEmail'
  | 'infoGithub'
  | 'infoOpenLink'
  | 'updatesTitle'
  | 'updatesCurrentVersion'
  | 'updatesCheck'
  | 'updatesChecking'
  | 'updatesAvailable'
  | 'updatesDownloading'
  | 'updatesDownloaded'
  | 'updatesRestart'
  | 'updatesUpToDate'
  | 'updatesError'
  | 'updatesUnsupported'
  | 'downloadModelBeforeRecording'
  | 'modelLoaded'
  | 'modelUnloaded'
  | 'speechRecognitionFailed'
  | 'modelParakeet'
  | 'modelGigaCtc'
  | 'modelGigaRnnt'
  | 'modelWhisperTurbo'
  | 'modelWhisperSmall'
  | 'modelWhisperSmallEn'
  | 'modelWhisperBaseEn';

export type AppTranslations = Record<TranslationKey, string>;

export const languageOptions: Array<{ id: LanguageMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'sr', label: 'Српски' },
  { id: 'he', label: 'עברית' },
  { id: 'be', label: 'Беларуская' },
  { id: 'uk', label: 'Українська' },
  { id: 'kk', label: 'Қазақша' },
  { id: 'ky', label: 'Кыргызча' },
  { id: 'uz', label: 'O‘zbekcha' },
  { id: 'tg', label: 'Тоҷикӣ' },
  { id: 'hy', label: 'Հայերեն' },
  { id: 'az', label: 'Azərbaycanca' },
  { id: 'ro', label: 'Română' },
  { id: 'tk', label: 'Türkmençe' },
];

const english: AppTranslations = {
  navHistory: 'History',
  navModels: 'Models',
  navSettings: 'Settings',
  navInfo: 'Info',
  statusMissing: 'Missing',
  statusReady: 'Ready',
  statusDownloading: 'Downloading',
  statusCorrupted: 'Corrupted',
  statusError: 'Error',
  checkingModel: 'Checking model',
  recording: 'Recording',
  ready: 'Ready',
  dismiss: 'Dismiss',
  historyTitle: 'History',
  historySearch: 'Search transcriptions',
  historyEmptyTitle: 'History is empty',
  historyEmptyBody: 'Stop recording to save recognized text to local history.',
  historyCopied: 'History item copied.',
  liveCaptureTitle: 'Capturing speech',
  liveCaptureBody: 'The fragment will appear here after recognition.',
  copy: 'Copy',
  star: 'Star',
  unstar: 'Unstar',
  delete: 'Delete',
  modelsTitle: 'Local recognition models',
  modelsSubtitle: 'Install a model on this computer and choose the one Type-A will use for transcription.',
  download: 'Download',
  inUse: 'In use',
  multilingual: 'Multilingual',
  russian: 'Russian',
  english: 'English',
  settingsTitle: 'Settings',
  sources: 'Sources',
  systemAudio: 'System audio',
  systemAudioHelp: 'Captures audio from applications and other participants directly from the computer.',
  microphone: 'Microphone',
  microphoneDevice: 'Microphone device',
  defaultMicrophone: 'Default microphone',
  activation: 'Activation',
  hotkey: 'Hotkey',
  hotkeyCaptureIdle: 'Click and press a key combination. Esc cancels input.',
  hotkeyCaptureActive: 'Press the key combination. Esc cancels input.',
  hotkeyModifierNeeded: 'Add a modifier: Ctrl, Alt, or Shift.',
  hotkeyUnavailable: 'Hotkey unavailable',
  hotkeyHoldActive: 'Hold mode is enabled',
  hotkeyToggleActive: 'Press-to-start mode is enabled',
  mode: 'Mode',
  toggleMode: 'Press',
  holdMode: 'Hold',
  activationHelp: 'Press starts and stops recording. Hold records only while the hotkey is held.',
  holdModeSwitch: 'Hold mode',
  holdModeEnabledHelp: 'Recording runs while the hotkey is held.',
  holdModeDisabledHelp: 'Disabled: press the hotkey once to start recording, then press it again to finish input.',
  outputText: 'Text output',
  typeIntoActiveField: 'Type into active field',
  typeIntoActiveFieldHelp: 'After recording stops, Type-A will type text where input focus was.',
  copyToClipboard: 'Copy to clipboard',
  copyToClipboardHelp: 'The full current session text stays in the clipboard after recording stops.',
  bothOutputsHelp: 'If both are enabled, Type-A types into the active field and saves text to the clipboard.',
  idleUnload: 'Unload model after idle',
  oneMinute: '1 minute',
  fiveMinutes: '5 minutes',
  fifteenMinutes: '15 minutes',
  thirtyMinutes: '30 minutes',
  never: 'Never',
  launchToTray: 'Launch to tray',
  launchToTrayHelp: 'On startup, Type-A stays minimized in the system tray instead of opening the main window.',
  application: 'Application',
  interface: 'Interface',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  language: 'Language',
  autoLanguage: 'Auto',
  autoLanguageDetail: 'System language',
  infoTitle: 'Info',
  infoCompanyLabel: 'A product by',
  infoCompanyDescription: 'Type-A is part of the Assist Group ecosystem and is developed as a free open-source product for the community.',
  infoContactsLabel: 'Assist Group contacts',
  infoWebsite: 'Website',
  infoTelegram: 'Telegram',
  infoEmail: 'E-mail',
  infoGithub: 'Source code',
  infoOpenLink: 'Open',
  updatesTitle: 'Application updates',
  updatesCurrentVersion: 'Current version',
  updatesCheck: 'Check for updates',
  updatesChecking: 'Checking GitHub Releases',
  updatesAvailable: 'Update available',
  updatesDownloading: 'Downloading update',
  updatesDownloaded: 'The update will be installed when Type-A exits.',
  updatesRestart: 'Restart and update',
  updatesUpToDate: 'Type-A is up to date.',
  updatesError: 'Update check failed.',
  updatesUnsupported: 'Updates are available in packaged builds.',
  downloadModelBeforeRecording: 'Download or repair the selected model before recording.',
  modelLoaded: 'Model loaded into memory.',
  modelUnloaded: 'Model unloaded from memory.',
  speechRecognitionFailed: 'Speech recognition failed.',
  modelParakeet: 'Universal model for Russian and English speech.',
  modelGigaCtc: 'Fast Russian speech recognition with punctuation.',
  modelGigaRnnt: 'More accurate Russian speech recognition.',
  modelWhisperTurbo: 'Accurate multilingual model for complex speech.',
  modelWhisperSmall: 'Light multilingual model for everyday tasks.',
  modelWhisperSmallEn: 'Fast model for English speech only.',
  modelWhisperBaseEn: 'Compact model for English speech only.',
};

const dictionaries: Record<SupportedLocale, Partial<AppTranslations>> = {
  en: english,
  ru: {
    application: 'Приложение',
    systemAudioHelp: 'Захватывает звук приложений и собеседников напрямую с компьютера.',
    launchToTrayHelp: 'При запуске Type-A останется свернутым в системном трее и не откроет основное окно.',
    navHistory: 'История',
    navModels: 'Модели',
    navSettings: 'Настройки',
    navInfo: 'Инфо',
    statusMissing: 'Нет',
    statusReady: 'Готово',
    statusDownloading: 'Скачивается',
    statusCorrupted: 'Повреждено',
    statusError: 'Ошибка',
    checkingModel: 'Проверка модели',
    recording: 'Запись',
    ready: 'Готово',
    dismiss: 'Закрыть',
    historyTitle: 'История',
    historySearch: 'Поиск по транскрипциям',
    historyEmptyTitle: 'История пуста',
    historyEmptyBody: 'Остановите запись, чтобы Type-A сохранил распознанный текст в локальную историю.',
    historyCopied: 'Фрагмент истории скопирован.',
    liveCaptureTitle: 'Идет захват речи',
    liveCaptureBody: 'Фрагмент появится здесь после распознавания.',
    copy: 'Копировать',
    star: 'В избранное',
    unstar: 'Убрать из избранного',
    delete: 'Удалить',
    modelsTitle: 'Локальные модели распознавания',
    modelsSubtitle: 'Установите модель на компьютер и выберите ту, которую Type-A будет использовать для транскрипции.',
    download: 'Скачать',
    inUse: 'Используется',
    multilingual: 'Многоязычная',
    russian: 'Русский',
    english: 'English',
    settingsTitle: 'Настройки',
    sources: 'Источники',
    systemAudio: 'Системный звук',
    microphone: 'Микрофон',
    microphoneDevice: 'Устройство микрофона',
    defaultMicrophone: 'Default microphone',
    activation: 'Активация',
    hotkey: 'Хоткей',
    hotkeyCaptureIdle: 'Кликните и нажмите сочетание клавиш. Esc отменяет ввод.',
    hotkeyCaptureActive: 'Нажмите нужное сочетание клавиш. Esc отменяет ввод.',
    hotkeyModifierNeeded: 'Добавьте модификатор: Ctrl, Alt или Shift.',
    hotkeyUnavailable: 'Хоткей недоступен',
    hotkeyHoldActive: 'Режим удержания включен',
    hotkeyToggleActive: 'Режим запуска по нажатию включен',
    mode: 'Режим',
    toggleMode: 'Нажатие',
    holdMode: 'Удержание',
    activationHelp: 'Нажатие включает и останавливает запись. Удержание записывает только пока хоткей зажат.',
    holdModeSwitch: 'Режим удержания',
    holdModeEnabledHelp: 'Пока хоткей зажат, идет запись.',
    holdModeDisabledHelp: 'Выключено: первое нажатие хоткея начинает запись, второе нажатие заканчивает ввод.',
    outputText: 'Вывод текста',
    typeIntoActiveField: 'Вводить в активное поле',
    typeIntoActiveFieldHelp: 'После остановки записи Type-A напечатает текст там, где был фокус ввода.',
    copyToClipboard: 'Копировать в буфер обмена',
    copyToClipboardHelp: 'Полный текст текущей сессии остается в буфере после остановки записи.',
    bothOutputsHelp: 'Если включены оба пункта, Type-A и печатает текст в активное поле, и сохраняет его в буфере обмена.',
    idleUnload: 'Выгрузка модели при простое',
    oneMinute: '1 minute',
    fiveMinutes: '5 minutes',
    fifteenMinutes: '15 minutes',
    thirtyMinutes: '30 minutes',
    never: 'Never',
    launchToTray: 'Запускать в трей',
    interface: 'Интерфейс',
    theme: 'Тема',
    dark: 'Dark',
    light: 'Light',
    language: 'Язык',
    autoLanguage: 'Авто',
    autoLanguageDetail: 'Язык системы',
    infoTitle: 'Инфо',
    infoCompanyLabel: 'Продукт команды',
    infoCompanyDescription: 'Type-A входит в экосистему Assist Group и развивается как бесплатный open-source продукт для сообщества.',
    infoContactsLabel: 'Контакты Assist Group',
    infoWebsite: 'Сайт',
    infoTelegram: 'Telegram',
    infoEmail: 'E-mail',
    infoGithub: 'Исходный код',
    infoOpenLink: 'Открыть',
    updatesTitle: 'Обновления приложения',
    updatesCurrentVersion: 'Текущая версия',
    updatesCheck: 'Проверить обновления',
    updatesChecking: 'Проверяем GitHub Releases',
    updatesAvailable: 'Доступно обновление',
    updatesDownloading: 'Загружаем обновление',
    updatesDownloaded: 'Обновление установится при выходе из Type-A.',
    updatesRestart: 'Перезапустить и обновить',
    updatesUpToDate: 'Установлена актуальная версия Type-A.',
    updatesError: 'Не удалось проверить обновления.',
    updatesUnsupported: 'Обновления доступны в установленной версии приложения.',
    downloadModelBeforeRecording: 'Скачайте или восстановите выбранную модель перед записью.',
    modelLoaded: 'Модель загружена в память.',
    modelUnloaded: 'Модель выгружена из памяти.',
    speechRecognitionFailed: 'Распознавание речи не удалось.',
    modelParakeet: 'Универсальная модель для русской и английской речи.',
    modelGigaCtc: 'Быстрое распознавание русской речи с пунктуацией.',
    modelGigaRnnt: 'Более точное распознавание русской речи.',
    modelWhisperTurbo: 'Точная многоязычная модель для сложной речи.',
    modelWhisperSmall: 'Легкая многоязычная модель для обычных задач.',
    modelWhisperSmallEn: 'Быстрая модель только для английской речи.',
    modelWhisperBaseEn: 'Компактная модель только для английской речи.',
  },
  es: {
    navHistory: 'Historial',
    navModels: 'Modelos',
    navSettings: 'Ajustes',
    navInfo: 'Info',
    modelsTitle: 'Modelos locales de reconocimiento',
    modelsSubtitle: 'Instala un modelo en este equipo y elige cuál usará Type-A para transcribir.',
    settingsTitle: 'Ajustes',
    historyTitle: 'Historial',
    infoTitle: 'Info',
    download: 'Descargar',
    delete: 'Eliminar',
    inUse: 'En uso',
    multilingual: 'Multilingüe',
    russian: 'Ruso',
    english: 'Inglés',
    sources: 'Fuentes',
    systemAudio: 'Audio del sistema',
    microphone: 'Micrófono',
    microphoneDevice: 'Dispositivo de micrófono',
    activation: 'Activación',
    hotkey: 'Atajo',
    mode: 'Modo',
    toggleMode: 'Pulsar',
    holdMode: 'Mantener',
    outputText: 'Salida de texto',
    interface: 'Interfaz',
    language: 'Idioma',
    autoLanguage: 'Auto',
    theme: 'Tema',
    dark: 'Oscuro',
    light: 'Claro',
    modelParakeet: 'Modelo universal para voz rusa e inglesa.',
    modelGigaCtc: 'Reconocimiento rápido de voz rusa con puntuación.',
    modelGigaRnnt: 'Reconocimiento de voz rusa más preciso.',
    modelWhisperTurbo: 'Modelo multilingüe preciso para voz compleja.',
    modelWhisperSmall: 'Modelo multilingüe ligero para tareas diarias.',
    modelWhisperSmallEn: 'Modelo rápido solo para voz inglesa.',
    modelWhisperBaseEn: 'Modelo compacto solo para voz inglesa.',
  },
  sr: {
    navHistory: 'Историја',
    navModels: 'Модели',
    navSettings: 'Подешавања',
    navInfo: 'Инфо',
    modelsTitle: 'Локални модели препознавања',
    modelsSubtitle: 'Инсталирајте модел на рачунар и изаберите који Type-A користи за транскрипцију.',
    settingsTitle: 'Подешавања',
    historyTitle: 'Историја',
    infoTitle: 'Инфо',
    download: 'Преузми',
    delete: 'Обриши',
    inUse: 'Користи се',
    multilingual: 'Вишејезично',
    russian: 'Руски',
    english: 'Енглески',
    sources: 'Извори',
    systemAudio: 'Системски звук',
    microphone: 'Микрофон',
    microphoneDevice: 'Уређај микрофона',
    activation: 'Активација',
    hotkey: 'Пречица',
    mode: 'Режим',
    toggleMode: 'Притисак',
    holdMode: 'Држање',
    outputText: 'Излаз текста',
    interface: 'Интерфејс',
    language: 'Језик',
    autoLanguage: 'Ауто',
    theme: 'Тема',
    dark: 'Тамна',
    light: 'Светла',
  },
  he: {
    navHistory: 'היסטוריה',
    navModels: 'מודלים',
    navSettings: 'הגדרות',
    navInfo: 'מידע',
    modelsTitle: 'מודלי זיהוי מקומיים',
    modelsSubtitle: 'התקן מודל במחשב ובחר באיזה מודל Type-A ישתמש לתמלול.',
    settingsTitle: 'הגדרות',
    historyTitle: 'היסטוריה',
    infoTitle: 'מידע',
    download: 'הורדה',
    delete: 'מחיקה',
    inUse: 'בשימוש',
    multilingual: 'רב-לשוני',
    russian: 'רוסית',
    english: 'אנגלית',
    sources: 'מקורות',
    systemAudio: 'שמע מערכת',
    microphone: 'מיקרופון',
    microphoneDevice: 'התקן מיקרופון',
    activation: 'הפעלה',
    hotkey: 'קיצור מקשים',
    mode: 'מצב',
    toggleMode: 'לחיצה',
    holdMode: 'החזקה',
    outputText: 'פלט טקסט',
    interface: 'ממשק',
    language: 'שפה',
    autoLanguage: 'אוטומטי',
    theme: 'ערכת נושא',
    dark: 'כהה',
    light: 'בהיר',
  },
  be: {
    navHistory: 'Гісторыя',
    navModels: 'Мадэлі',
    navSettings: 'Налады',
    navInfo: 'Інфа',
    modelsTitle: 'Лакальныя мадэлі распазнавання',
    modelsSubtitle: 'Усталюйце мадэль на камп’ютар і выберыце, якую Type-A будзе выкарыстоўваць для транскрыпцыі.',
    settingsTitle: 'Налады',
    historyTitle: 'Гісторыя',
    download: 'Спампаваць',
    delete: 'Выдаліць',
    inUse: 'Выкарыстоўваецца',
    multilingual: 'Шматмоўная',
    russian: 'Руская',
    english: 'Англійская',
    sources: 'Крыніцы',
    systemAudio: 'Сістэмны гук',
    microphone: 'Мікрафон',
    activation: 'Актывацыя',
    outputText: 'Вывад тэксту',
    interface: 'Інтэрфейс',
    language: 'Мова',
  },
  uk: {
    navHistory: 'Історія',
    navModels: 'Моделі',
    navSettings: 'Налаштування',
    navInfo: 'Інфо',
    modelsTitle: 'Локальні моделі розпізнавання',
    modelsSubtitle: 'Установіть модель на комп’ютер і виберіть ту, яку Type-A використовуватиме для транскрипції.',
    settingsTitle: 'Налаштування',
    historyTitle: 'Історія',
    download: 'Завантажити',
    delete: 'Видалити',
    inUse: 'Використовується',
    multilingual: 'Багатомовна',
    russian: 'Російська',
    english: 'Англійська',
    sources: 'Джерела',
    systemAudio: 'Системний звук',
    microphone: 'Мікрофон',
    activation: 'Активація',
    outputText: 'Вивід тексту',
    interface: 'Інтерфейс',
    language: 'Мова',
  },
  kk: {
    navHistory: 'Тарих',
    navModels: 'Модельдер',
    navSettings: 'Баптаулар',
    navInfo: 'Ақпарат',
    modelsTitle: 'Жергілікті тану модельдері',
    modelsSubtitle: 'Модельді компьютерге орнатып, Type-A транскрипция үшін қолданатын модельді таңдаңыз.',
    settingsTitle: 'Баптаулар',
    historyTitle: 'Тарих',
    download: 'Жүктеу',
    delete: 'Жою',
    inUse: 'Қолданылуда',
    multilingual: 'Көптілді',
    russian: 'Орысша',
    english: 'Ағылшынша',
    sources: 'Дереккөздер',
    systemAudio: 'Жүйе дыбысы',
    microphone: 'Микрофон',
    activation: 'Іске қосу',
    outputText: 'Мәтін шығару',
    interface: 'Интерфейс',
    language: 'Тіл',
  },
  ky: {
    navHistory: 'Тарых',
    navModels: 'Моделдер',
    navSettings: 'Жөндөөлөр',
    navInfo: 'Маалымат',
    modelsTitle: 'Жергиликтүү таануу моделдери',
    modelsSubtitle: 'Моделди компьютерге орнотуп, Type-A транскрипция үчүн колдоно турган моделди тандаңыз.',
    settingsTitle: 'Жөндөөлөр',
    historyTitle: 'Тарых',
    download: 'Жүктөө',
    delete: 'Өчүрүү',
    inUse: 'Колдонулууда',
    multilingual: 'Көп тилдүү',
    russian: 'Орусча',
    english: 'Англисче',
    sources: 'Булактар',
    systemAudio: 'Системалык үн',
    microphone: 'Микрофон',
    activation: 'Иштетүү',
    outputText: 'Текст чыгаруу',
    interface: 'Интерфейс',
    language: 'Тил',
  },
  uz: {
    navHistory: 'Tarix',
    navModels: 'Modellar',
    navSettings: 'Sozlamalar',
    navInfo: 'Info',
    modelsTitle: 'Mahalliy tanish modellari',
    modelsSubtitle: 'Modelni kompyuterga o‘rnating va Type-A transkripsiya uchun ishlatadigan modelni tanlang.',
    settingsTitle: 'Sozlamalar',
    historyTitle: 'Tarix',
    download: 'Yuklab olish',
    delete: 'O‘chirish',
    inUse: 'Ishlatilmoqda',
    multilingual: 'Ko‘p tilli',
    russian: 'Ruscha',
    english: 'Inglizcha',
    sources: 'Manbalar',
    systemAudio: 'Tizim ovozi',
    microphone: 'Mikrofon',
    activation: 'Faollashtirish',
    outputText: 'Matn chiqarish',
    interface: 'Interfeys',
    language: 'Til',
  },
  tg: {
    navHistory: 'Таърих',
    navModels: 'Моделҳо',
    navSettings: 'Танзимот',
    navInfo: 'Маълумот',
    modelsTitle: 'Моделҳои маҳаллии шинохт',
    modelsSubtitle: 'Моделро ба компютер насб кунед ва интихоб кунед, ки Type-A барои транскрипсия кадомашро истифода барад.',
    settingsTitle: 'Танзимот',
    historyTitle: 'Таърих',
    download: 'Боргирӣ',
    delete: 'Нест кардан',
    inUse: 'Истифода мешавад',
    multilingual: 'Бисёрзабона',
    russian: 'Русӣ',
    english: 'Англисӣ',
    sources: 'Манбаъҳо',
    systemAudio: 'Садои система',
    microphone: 'Микрофон',
    activation: 'Фаъолсозӣ',
    outputText: 'Баромади матн',
    interface: 'Интерфейс',
    language: 'Забон',
  },
  hy: {
    navHistory: 'Պատմություն',
    navModels: 'Մոդելներ',
    navSettings: 'Կարգավորումներ',
    navInfo: 'Տեղեկություն',
    modelsTitle: 'Տեղային ճանաչման մոդելներ',
    modelsSubtitle: 'Տեղադրեք մոդելը համակարգչում և ընտրեք, թե Type-A-ը որն է օգտագործելու տրանսկրիպցիայի համար։',
    settingsTitle: 'Կարգավորումներ',
    historyTitle: 'Պատմություն',
    download: 'Ներբեռնել',
    delete: 'Ջնջել',
    inUse: 'Օգտագործվում է',
    multilingual: 'Բազմալեզու',
    russian: 'Ռուսերեն',
    english: 'Անգլերեն',
    sources: 'Աղբյուրներ',
    systemAudio: 'Համակարգի ձայն',
    microphone: 'Միկրոֆոն',
    activation: 'Ակտիվացում',
    outputText: 'Տեքստի ելք',
    interface: 'Ինտերֆեյս',
    language: 'Լեզու',
  },
  az: {
    navHistory: 'Tarixçə',
    navModels: 'Modellər',
    navSettings: 'Ayarlar',
    navInfo: 'Məlumat',
    modelsTitle: 'Lokal tanıma modelləri',
    modelsSubtitle: 'Modeli kompüterə quraşdırın və Type-A-nın transkripsiya üçün istifadə edəcəyi modeli seçin.',
    settingsTitle: 'Ayarlar',
    historyTitle: 'Tarixçə',
    download: 'Yüklə',
    delete: 'Sil',
    inUse: 'İstifadədədir',
    multilingual: 'Çoxdilli',
    russian: 'Rusca',
    english: 'İngiliscə',
    sources: 'Mənbələr',
    systemAudio: 'Sistem səsi',
    microphone: 'Mikrofon',
    activation: 'Aktivləşdirmə',
    outputText: 'Mətn çıxışı',
    interface: 'İnterfeys',
    language: 'Dil',
  },
  ro: {
    navHistory: 'Istoric',
    navModels: 'Modele',
    navSettings: 'Setări',
    navInfo: 'Info',
    modelsTitle: 'Modele locale de recunoaștere',
    modelsSubtitle: 'Instalează un model pe computer și alege modelul pe care Type-A îl va folosi pentru transcriere.',
    settingsTitle: 'Setări',
    historyTitle: 'Istoric',
    download: 'Descarcă',
    delete: 'Șterge',
    inUse: 'În uz',
    multilingual: 'Multilingv',
    russian: 'Rusă',
    english: 'Engleză',
    sources: 'Surse',
    systemAudio: 'Sunet sistem',
    microphone: 'Microfon',
    activation: 'Activare',
    outputText: 'Ieșire text',
    interface: 'Interfață',
    language: 'Limbă',
  },
  tk: {
    navHistory: 'Taryh',
    navModels: 'Modeller',
    navSettings: 'Sazlamalar',
    navInfo: 'Maglumat',
    modelsTitle: 'Ýerli tanamak modelleri',
    modelsSubtitle: 'Modeli kompýutere guruň we Type-A transkripsiýa üçin ulanjak modelini saýlaň.',
    settingsTitle: 'Sazlamalar',
    historyTitle: 'Taryh',
    download: 'Ýükle',
    delete: 'Poz',
    inUse: 'Ulanylýar',
    multilingual: 'Köp dilli',
    russian: 'Rusça',
    english: 'Iňlisçe',
    sources: 'Çeşmeler',
    systemAudio: 'Sistema sesi',
    microphone: 'Mikrofon',
    activation: 'Işletmek',
    outputText: 'Tekst çykyşy',
    interface: 'Interfeýs',
    language: 'Dil',
  },
};

const localeAliases: Record<string, SupportedLocale> = {
  ru: 'ru',
  en: 'en',
  es: 'es',
  sr: 'sr',
  he: 'he',
  iw: 'he',
  be: 'be',
  uk: 'uk',
  kk: 'kk',
  ky: 'ky',
  uz: 'uz',
  tg: 'tg',
  hy: 'hy',
  az: 'az',
  ro: 'ro',
  mo: 'ro',
  tk: 'tk',
};

export function resolveLocale(language: LanguageMode, systemLocale: string): SupportedLocale {
  if (language !== 'auto') {
    return language;
  }
  const normalized = systemLocale.toLowerCase().split(/[-_]/)[0] || 'en';
  return localeAliases[normalized] ?? 'en';
}

export function getTranslations(locale: SupportedLocale): AppTranslations {
  return { ...english, ...dictionaries[locale] };
}

export function dateLocaleFor(locale: SupportedLocale): string {
  const dateLocales: Record<SupportedLocale, string> = {
    ru: 'ru-RU',
    en: 'en-US',
    es: 'es-ES',
    sr: 'sr-RS',
    he: 'he-IL',
    be: 'be-BY',
    uk: 'uk-UA',
    kk: 'kk-KZ',
    ky: 'ky-KG',
    uz: 'uz-UZ',
    tg: 'tg-TJ',
    hy: 'hy-AM',
    az: 'az-AZ',
    ro: 'ro-RO',
    tk: 'tk-TM',
  };
  return dateLocales[locale];
}

export function textDirection(locale: SupportedLocale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
