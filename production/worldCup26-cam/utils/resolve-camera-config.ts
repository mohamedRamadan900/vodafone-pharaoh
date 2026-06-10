import { TranslateService } from '@ngx-translate/core';

import { CONTENT_PATH } from '../defines/defines';
import {
  PharaohSimilarityCameraConfig,
  PharaohSimilarityCameraFailureAction,
  PharaohSimilarityCameraFailureCopy,
  PharaohSimilarityCameraFailureCopyKey,
} from '../../../shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh.model';
import { CAMERA_PERMISSION_SETTINGS_URL } from '../../../shared/app-standalone-components/pharaoh-similarity-camera/defines/constants';

interface WorldCup26CameraErrorScriptTranslation {
  title?: string;
  buttonText?: string;
}

interface WorldCup26ContentTranslations {
  cameraNoDetectedFaceMessage?: string;
  cameraErrorTitle?: string;
  cameraErrorButtonText?: string;
  packageErrorTitle?: string;
  packageErrorButtonText?: string;
  detectionErrorTitle?: string;
  detectionErrorButtonText?: string;
  defaultErrorTitle?: string;
  defaultErrorButtonText?: string;
}

interface WorldCup26ErrorTranslations {
  noFaceDetectedTitle?: string;
  noFaceDetectedAction?: string;
}

const FAILURE_COPY_ACTIONS: Record<
  PharaohSimilarityCameraFailureCopyKey,
  PharaohSimilarityCameraFailureAction
> = {
  camera: {
    type: 'navigate',
    url: CAMERA_PERMISSION_SETTINGS_URL,
  },
  package: {
    type: 'retry',
  },
  detection: {
    type: 'retry',
  },
  default: {
    type: 'retry',
  },
};

const FAILURE_COPY_KEYS: PharaohSimilarityCameraFailureCopyKey[] = [
  'camera',
  'package',
  'detection',
  'default',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function resolveFailureCopy(
  value: unknown,
  key: PharaohSimilarityCameraFailureCopyKey
): PharaohSimilarityCameraFailureCopy | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const title = typeof value.title === 'string' ? value.title : undefined;
  const buttonText = typeof value.buttonText === 'string' ? value.buttonText : undefined;

  if (!title && !buttonText) {
    return undefined;
  }

  return {
    title,
    buttonText,
    action: FAILURE_COPY_ACTIONS[key],
  };
}

function resolveContentFailureCopy(
  contentTranslations: WorldCup26ContentTranslations,
  key: PharaohSimilarityCameraFailureCopyKey
): PharaohSimilarityCameraFailureCopy | undefined {
  const translationMap: Record<
    PharaohSimilarityCameraFailureCopyKey,
    WorldCup26CameraErrorScriptTranslation
  > = {
    camera: {
      title: contentTranslations.cameraErrorTitle,
      buttonText: contentTranslations.cameraErrorButtonText,
    },
    package: {
      title: contentTranslations.packageErrorTitle,
      buttonText: contentTranslations.packageErrorButtonText,
    },
    detection: {
      title: contentTranslations.detectionErrorTitle,
      buttonText: contentTranslations.detectionErrorButtonText,
    },
    default: {
      title: contentTranslations.defaultErrorTitle,
      buttonText: contentTranslations.defaultErrorButtonText,
    },
  };

  return resolveFailureCopy(translationMap[key], key);
}

function resolveNoFaceDetectedFailureCopy(
  errorTranslations: WorldCup26ErrorTranslations | undefined
): PharaohSimilarityCameraFailureCopy | undefined {
  if (!errorTranslations) {
    return undefined;
  }

  return resolveFailureCopy(
    {
      title: errorTranslations.noFaceDetectedTitle,
      buttonText: errorTranslations.noFaceDetectedAction,
    },
    'detection'
  );
}

export function resolveWorldCup26CameraConfig(
  translateService: TranslateService
): PharaohSimilarityCameraConfig {
  const rawTranslations = translateService.instant(`${CONTENT_PATH}.content`) as
    | WorldCup26ContentTranslations
    | string;
  const rawErrorTranslations = translateService.instant(`${CONTENT_PATH}.error`) as
    | WorldCup26ErrorTranslations
    | string;

  if (!isRecord(rawTranslations)) {
    return {};
  }

  const errorTranslations = isRecord(rawErrorTranslations) ? rawErrorTranslations : undefined;

  const failure = FAILURE_COPY_KEYS.reduce(
    (config, key) => {
      const resolvedFailureCopy =
        key === 'detection'
          ? (resolveNoFaceDetectedFailureCopy(errorTranslations) ??
            resolveContentFailureCopy(rawTranslations, key))
          : resolveContentFailureCopy(rawTranslations, key);

      if (resolvedFailureCopy) {
        config[key] = resolvedFailureCopy;
      }

      return config;
    },
    {} as Partial<Record<PharaohSimilarityCameraFailureCopyKey, PharaohSimilarityCameraFailureCopy>>
  );

  return {
    copy: {
      noDetectedFaceMessage:
        typeof rawTranslations.cameraNoDetectedFaceMessage === 'string'
          ? rawTranslations.cameraNoDetectedFaceMessage
          : undefined,
      failure,
    },
  };
}
export function resolveImageFormat(imageSource: string): {
  fileExtension: string;
  contentType: string;
} {
  if (/^data:image\/jpe?g/i.test(imageSource) || /\.jpe?g(\?|#|$)/i.test(imageSource)) {
    return { fileExtension: 'jpg', contentType: 'image/jpeg' };
  }

  if (/^data:image\/webp/i.test(imageSource) || /\.webp(\?|#|$)/i.test(imageSource)) {
    return { fileExtension: 'webp', contentType: 'image/webp' };
  }

  return { fileExtension: 'png', contentType: 'image/png' };
}

export async function convertBlobToDataUrl(imageBlob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to convert image blob to data URL'));
    };

    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
    reader.readAsDataURL(imageBlob);
  });
}

export async function normalizeImageForSharing(imageSource: string): Promise<string | null> {
  if (imageSource.startsWith('data:image/')) {
    return imageSource;
  }

  try {
    const response = await fetch(imageSource);
    if (!response.ok) {
      return null;
    }

    const imageBlob = await response.blob();
    return await convertBlobToDataUrl(imageBlob);
  } catch (error) {
    console.error('WorldCup26CamService.normalizeImageForSharing:', error);
    return null;
  }
}
