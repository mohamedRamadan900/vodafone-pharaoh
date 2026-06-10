import {
  PharaohSimilarityCameraFailureAction,
  PharaohSimilarityCameraFailureCopyKey as PharaohSimilarityCameraComponentFailureCopyKey,
} from '../models/pharaoh.model';

// Fallback assets (on staging) in case of config failure or missing config properties
export const CAMERA_FRAME_URL = '/documents/31803/13958578/camera-frame.png';
export const ACTIVE_CAMERA_FRAME_URL = '/documents/31803/13958578/active-camera-frame.png';
export const ERROR_URL = '/documents/31803/13958578/clock.png';
export const CAMERA_PERMISSION_SETTINGS_URL = 'https://web.vodafone.com.eg/openSettings';
export const DEFAULT_NO_DETECTED_FACE_MESSAGE = 'Put your face in the golden frame';
export const MP_RIGHT_EYE = 0;
export const MP_LEFT_EYE = 1;
export const MP_NOSE_TIP = 2;
export const MP_MOUTH = 3;
export const MP_RIGHT_EAR = 4;
export const MP_LEFT_EAR = 5;
export const FACE_FRAME_WIDTH_SCALE = 1.12;
export const FACE_FRAME_HEIGHT_SCALE = 1.12;
export const FAILURE_COPY_KEYS: PharaohSimilarityCameraComponentFailureCopyKey[] = [
  'camera',
  'package',
  'detection',
  'default',
];

export const DEFAULT_FAILURE_COPY: Record<
  'en' | 'ar',
  Record<
    PharaohSimilarityCameraComponentFailureCopyKey,
    { title: string; buttonText: string; action: PharaohSimilarityCameraFailureAction }
  >
> = {
  en: {
    camera: {
      title: 'Camera unavailable',
      buttonText: 'Open camera again',
      action: { type: 'navigate', url: CAMERA_PERMISSION_SETTINGS_URL },
    },
    package: {
      title: 'Face package failed to load',
      buttonText: 'Reload package',
      action: { type: 'retry' },
    },
    detection: {
      title: 'No face detected',
      buttonText: 'Try again',
      action: { type: 'retry' },
    },
    default: {
      title: 'Something went wrong',
      buttonText: 'Retry',
      action: { type: 'retry' },
    },
  },
  ar: {
    camera: {
      title: 'الكاميرا غير متاحة',
      buttonText: 'افتح الكاميرا مرة أخرى',
      action: { type: 'navigate', url: CAMERA_PERMISSION_SETTINGS_URL },
    },
    package: {
      title: 'فشل تحميل حزمة الوجه',
      buttonText: 'أعد تحميل الحزمة',
      action: { type: 'retry' },
    },
    detection: {
      title: 'لم يتم اكتشاف وجه',
      buttonText: 'حاول مرة أخرى',
      action: { type: 'retry' },
    },
    default: {
      title: 'حدث خطأ ما',
      buttonText: 'أعد المحاولة',
      action: { type: 'retry' },
    },
  },
};

// ─── UI Text Messages (EN/AR) ──────────────────────────────────────────────
export const UI_MESSAGES = {
  en: {
    openSettings: 'Open settings',
    errorIconAlt: 'Error icon',
    cameraPreview: 'Camera preview',
    capturedFacePreview: 'Captured face preview',
    matchingProgress: 'Matching progress',
    captureImage: 'Capture image',
    uploadImage: 'Upload image',
    processing: 'Processing...',
    unableToCaptureFrame: 'Unable to capture the current camera frame.',
    pleaseChooseValidImage: 'Please choose a valid image file.',
    unableToReadImage: 'Unable to read the selected image.',
    unableToCompareFace: 'Unable to compare the captured face right now.',
    mediaPixeLoadError: 'MediaPipe could not be loaded. Please try again.',
    cameraAccessDenied: 'Camera access was denied or is unavailable.',
    selectedFileAsImageError: 'Selected file could not be read as an image.',
    selectedFileReadError: 'Selected file could not be read.',
    youLookLike: 'You look like',
    turnMeInto: 'Turn me into',
    turnMeIntoPharaoh: 'Turn me into {{pharaohName}}',
    rightEye: 'Right Eye',
    leftEye: 'Left Eye',
    nose: 'Nose',
    mouth: 'Mouth',
    eyeShape: 'Eye Shape',
    noseStructure: 'Nose Structure',
    lipShape: 'Lip Shape',
    almondEyes: 'Almond',
    roundEyes: 'Round',
    hoodedEyes: 'Hooded',
    monolidEyes: 'Monolid',
    upturnedEyes: 'Upturned',
    downturnedEyes: 'Downturned',
    deepSetEyes: 'Deep Set',
    wideSetEyes: 'Wide Set',
    narrowEyes: 'Narrow',
    straightNose: 'Straight',
    romanNose: 'Roman',
    roundedNose: 'Rounded',
    buttonNose: 'Button',
    wideNose: 'Wide',
    narrowNose: 'Narrow',
    sharpNose: 'Sharp',
    definedBridgeNose: 'Defined Bridge',
    softBridgeNose: 'Soft Bridge',
    fullLips: 'Full Lips',
    thinLips: 'Thin Lips',
    heartShapedLips: 'Heart-Shaped',
    wideLips: 'Wide Lips',
    definedCupidsBowLips: "Defined Cupid's Bow",
    balancedLips: 'Balanced Lips',
    topHeavyLips: 'Top-Heavy Lips',
    bottomHeavyLips: 'Bottom-Heavy Lips',
    softShapedLips: 'Soft-Shaped Lips',
    balancedFace: 'Balanced features',
  },
  ar: {
    openSettings: 'افتح الإعدادات',
    errorIconAlt: 'أيقونة الخطأ',
    cameraPreview: 'معاينة الكاميرا',
    capturedFacePreview: 'معاينة الوجه الملتقط',
    matchingProgress: 'تقدم المطابقة',
    captureImage: 'التقط صورة',
    uploadImage: 'ارفع صورة',
    processing: 'جار التحليل...',
    unableToCaptureFrame: 'غير قادر على التقاط إطار الكاميرا الحالي.',
    pleaseChooseValidImage: 'يرجى اختيار ملف صورة صحيح.',
    unableToReadImage: 'غير قادر على قراءة الصورة المحددة.',
    unableToCompareFace: 'غير قادر على مقارنة الوجه الملتقط الآن.',
    mediaPixeLoadError: 'لم يتمكن MediaPipe من التحميل. يرجى المحاولة مرة أخرى.',
    cameraAccessDenied: 'تم رفض الوصول إلى الكاميرا أو غير متاح.',
    selectedFileAsImageError: 'لم يتمكن من قراءة ملف الصورة المحدد.',
    selectedFileReadError: 'لم يتمكن من قراءة الملف المحدد.',
    youLookLike: 'أنت تشبه',
    turnMeInto: 'حولني إلى',
    turnMeIntoPharaoh: 'حولني إلى {{pharaohName}}',
    rightEye: 'العين اليمنى',
    leftEye: 'العين اليسرى',
    nose: 'الأنف',
    mouth: 'الفم',
    eyeShape: 'شكل العين',
    noseStructure: 'شكل الأنف',
    lipShape: 'شكل الشفايف',
    almondEyes: 'لوزية',
    roundEyes: 'دائرية',
    hoodedEyes: 'مبطنة',
    monolidEyes: 'أحادية الجفن',
    upturnedEyes: 'مرفوعة',
    downturnedEyes: 'نازلة',
    deepSetEyes: 'غائرة',
    wideSetEyes: 'واسعة',
    narrowEyes: 'ضيقة',
    straightNose: 'مستقيم',
    romanNose: 'روماني',
    roundedNose: 'دائري',
    buttonNose: 'صغير',
    wideNose: 'عريض',
    narrowNose: 'رفيع',
    sharpNose: 'حاد',
    definedBridgeNose: 'بعظمة واضحة',
    softBridgeNose: 'ناعم الملامح',
    fullLips: 'ممتلئة',
    thinLips: 'رفيعة',
    heartShapedLips: 'على شكل قلب',
    wideLips: 'عريضة',
    definedCupidsBowLips: 'بتحديد واضح',
    balancedLips: 'متناسقة',
    topHeavyLips: 'الشفايف العليا أوضح',
    bottomHeavyLips: 'الشفايف السفلى أوضح',
    softShapedLips: 'ناعمة الملامح',
    balancedFace: 'ملامح متوازنة',
  },
};

// ─── Get UI Message (defaults to EN) ────────────────────────────────────────
export const getUIMessage = (key: string, lang: 'en' | 'ar' = 'en'): string => {
  const resolvedKey = key as keyof typeof UI_MESSAGES.en;
  return UI_MESSAGES[lang][resolvedKey] || UI_MESSAGES.en[resolvedKey] || '';
};

export const getDefaultFailureCopy = (
  key: PharaohSimilarityCameraComponentFailureCopyKey,
  lang: 'en' | 'ar' = 'en'
) => {
  return DEFAULT_FAILURE_COPY[lang][key] || DEFAULT_FAILURE_COPY.en[key];
};
