export const CONTENT_PATH = 'worldCup26';
export const CHANNEL_TYPE = 'APP_PORTAL';
export const TYPE = 'worldCupWow26';
export const GIFTTYPE_PREPAID = 'Units';
export const GIFTTYPE_POSTPAID = 'GB';
export const WORLD_CUP26_ROUTE_SEGMENT = 'worldCup26';
export const CASH_WORLD_CUP26_ROUTE_SEGMENT = 'cashWorldCup26';
export const SHOW_OVERLAY_QUERY_PARAM = 'showOverlay';
export const RESULT_IMAGE_STORAGE_KEY = 'generated_base64Image';
export const SHOW_OVERLAY_QUERY_VALUE = 'true';
export const WORLD_CUP26_NOT_ELIGIBLE_ERROR_CODE = '2035';
export const WORLD_CUP26_TIMEOUT_ERROR_CODE = '3998';
export const ROUTES = {
  HOME: 'home',
  WALKTHROUGH: 'walkthrough',
  CAMERA: 'camera',
  RESULT: 'result',
};
export const WC26_ICONS = {
  SHARE: 'share',
  RIGHT_SYMBOL: 'right-symbol',
  LEFT_SYMBOL: 'left-symbol',
  CAMERA: 'camera',
  GIFT: 'gift',
};
export type Wc26IconType = keyof typeof WC26_ICONS;
export const CAMERA_CONFIG = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  PROCESSING_TIMEOUT: 50000,
  POLLING_INTERVAL: 2000,
  MAX_POLLING_ATTEMPTS: 30,
};
export const PHARAOH_TYPES = {
  TUTANKHAMUN: 'tutankhamun',
  CLEOPATRA: 'cleopatra',
  RAMESSES: 'ramesses',
  NEFERTITI: 'nefertiti',
  KHUFU: 'khufu',
};
export enum CameraStep {
  HOME = 'home',
  WALKTHROUGH = 'walkthrough',
  CAMERA = 'camera',
  PROCESSING = 'processing',
  RESULT = 'result',
}
export const ICONS = {
  CAMERA: 'icon-camera',
  PHARAOH: 'icon-pharaoh',
  GIFT: 'icon-gift',
  SUCCESS: 'icon-success',
  ERROR: 'icon-error',
};
export const WORLD_CUP26_CAM_OVERLAY_STATES = {
  NO_TRIALS: 'noTrials',
  NOT_ELIGIBLE: 'notEligible',
  TIMEOUT: 'timeout',
  DEFAULT: 'default',
} as const;
export const WORLD_CUP26_CAM_OVERLAY_ACTIONS = {
  NAVIGATE_HOME: 'navigateHome',
  RETRY: 'retry',
} as const;
export type WorldCup26CamOverlayStateValue =
  (typeof WORLD_CUP26_CAM_OVERLAY_STATES)[keyof typeof WORLD_CUP26_CAM_OVERLAY_STATES];
export type WorldCup26CamOverlayActionValue =
  (typeof WORLD_CUP26_CAM_OVERLAY_ACTIONS)[keyof typeof WORLD_CUP26_CAM_OVERLAY_ACTIONS];
export interface WorldCup26CamOverlayDescriptor {
  imageKey: string;
  titleKey: string;
  subtitleKey: string;
  buttonTextKey: string;
  action: WorldCup26CamOverlayActionValue;
}
export const WORLD_CUP26_CAM_OVERLAY_DESCRIPTORS: Record<
  WorldCup26CamOverlayStateValue,
  WorldCup26CamOverlayDescriptor
> = {
  [WORLD_CUP26_CAM_OVERLAY_STATES.NO_TRIALS]: {
    imageKey: `${CONTENT_PATH}.error.noTrialsImage`,
    titleKey: `${CONTENT_PATH}.error.noTrialsTitle`,
    subtitleKey: `${CONTENT_PATH}.error.noTrialsDescription`,
    buttonTextKey: `${CONTENT_PATH}.error.noTrialsAction`,
    action: WORLD_CUP26_CAM_OVERLAY_ACTIONS.NAVIGATE_HOME,
  },
  [WORLD_CUP26_CAM_OVERLAY_STATES.TIMEOUT]: {
    imageKey: `${CONTENT_PATH}.error.timeoutImage`,
    titleKey: `${CONTENT_PATH}.error.timeoutTitle`,
    subtitleKey: `${CONTENT_PATH}.error.timeoutDescription`,
    buttonTextKey: `${CONTENT_PATH}.error.timeoutAction`,
    action: WORLD_CUP26_CAM_OVERLAY_ACTIONS.RETRY,
  },
  [WORLD_CUP26_CAM_OVERLAY_STATES.NOT_ELIGIBLE]: {
    imageKey: `${CONTENT_PATH}.error.notEligibleImage`,
    titleKey: `${CONTENT_PATH}.error.notEligibleTitle`,
    subtitleKey: `${CONTENT_PATH}.error.notEligibleDescription`,
    buttonTextKey: `${CONTENT_PATH}.error.notEligibleAction`,
    action: WORLD_CUP26_CAM_OVERLAY_ACTIONS.NAVIGATE_HOME,
  },
  [WORLD_CUP26_CAM_OVERLAY_STATES.DEFAULT]: {
    imageKey: `${CONTENT_PATH}.error.defaultImage`,
    titleKey: `${CONTENT_PATH}.error.defaultTitle`,
    subtitleKey: `${CONTENT_PATH}.error.defaultDescription`,
    buttonTextKey: `${CONTENT_PATH}.error.defaultAction`,
    action: WORLD_CUP26_CAM_OVERLAY_ACTIONS.RETRY,
  },
};
