export const WorldCup26Buttons = {
  home: 'AVA::WorldCup:DiscoverPharo:Start',
  walkthrough: 'AVA::WorldCup:DiscoverPharo:Go',
  allowCamera: 'AVA::WorldCup:DiscoverPharo:AccessCamera:Allow',
  denyCamera: 'AVA::WorldCup:DiscoverPharo:AccessCamera:Deny',
  camera: 'AVA::WorldCup:DiscoverPharo:Capture Photo',
  result: 'APP:WorldCup:DiscoverPharo:Final Page',
  upload: 'AVA::WorldCup:DiscoverPharo:Upload Photo',
  capture: 'AVA::WorldCup:DiscoverPharo:Capture Photo',
  transform: 'AVA::WorldCup:DiscoverPharo:Turn Me',
  save: 'AVA::WorldCup:DiscoverPharo:Save Picture',
  share: 'AVA::WorldCup:DiscoverPharo:Share Picture',
  saveAndShare: 'AVA::WorldCup:DiscoverPharo:Save and Share Picture',
  vfCash: 'AVA::WorldCup:DiscoverPharo:turn to vf cash stickers',
} as const;

export type WorldCup26ButtonKey = keyof typeof WorldCup26Buttons;
export type WorldCup26Button = (typeof WorldCup26Buttons)[WorldCup26ButtonKey];

export const WorldCup26Clicks = {
  click: (buttonName: WorldCup26Button) => ({
    button_name: buttonName,
    button_click: 'Click',
  }),
} as const;

export const WorldCup26Actions = {
  action: (buttonName: WorldCup26Button) => ({
    button_name: buttonName,
    button_click: 'Action',
  }),
} as const;

const WORLD_CUP26_API_ERROR_MESSAGE = 'error';
const WORLD_CUP26_API_SUCCESS_STATUS = 'Success';
const WORLD_CUP26_API_FAILURE_STATUS = 'Failure';
const WORLD_CUP26_API_NO_ERROR_TYPE = 'NoError';
const WORLD_CUP26_API_ACTION_ERROR_TYPE = 'Action';
const WORLD_CUP26_API_NO_ERRORS_COUNT = '0';
const WORLD_CUP26_API_NO_MESSAGE = 'NoMessage';

type WorldCup26ApiErrorDetails = {
  error?: {
    code?: string | number | null;
    reason?: string;
  };
  status?: string | number | null;
  statusText?: string;
};

const resolveWorldCup26ApiErrorCode = (errorDetails?: WorldCup26ApiErrorDetails | null): string =>
  String(errorDetails?.error?.code ?? errorDetails?.status ?? 'UnknownError');

const resolveWorldCup26ApiErrorMessage = (
  errorDetails?: WorldCup26ApiErrorDetails | null
): string => errorDetails?.error?.reason ?? errorDetails?.statusText ?? 'UnknownError';

export const WorldCup26ApiTracking = {
  generateImageSuccess: (pharaohName: string, giftType: string) => ({
    ...WorldCup26Actions.action(WorldCup26Buttons.transform),
    action_status: WORLD_CUP26_API_SUCCESS_STATUS,
    worldcup_kingname: pharaohName,
    worldcup_wow_gift_type: giftType,
    // error_type: WORLD_CUP26_API_NO_ERROR_TYPE,
    // page_errors: WORLD_CUP26_API_NO_ERRORS_COUNT,
    // page_errors_messages: WORLD_CUP26_API_NO_MESSAGE,
  }),
  generateImageFailure: (pharaohName: string, errorDetails?: WorldCup26ApiErrorDetails | null) => ({
    ...WorldCup26Actions.action(WorldCup26Buttons.transform),
    error_messages: WORLD_CUP26_API_ERROR_MESSAGE,
    action_status: WORLD_CUP26_API_FAILURE_STATUS,
    error_type: WORLD_CUP26_API_ACTION_ERROR_TYPE,
    page_errors: resolveWorldCup26ApiErrorCode(errorDetails),
    page_errors_messages: resolveWorldCup26ApiErrorMessage(errorDetails),
    error_reason: errorDetails?.error?.reason,
    worldcup_kingname: pharaohName,
  }),
} as const;

export const WorldCup26PageViews = {
  homePage: (pageUrl: string) => ({
    page_views_event: 'view',
    page_url: pageUrl,
    page_name: 'APP:WorldCup:DiscoverPharo:Entry Page',
    page_type: 'MGMT',
  }),
  walkthroughPage: (pageUrl: string) => ({
    page_views_event: 'view',
    page_url: pageUrl,
    page_name: 'APP:WorldCup:DiscoverPharo:Start Page',
    page_type: 'MGMT',
  }),
  cameraPage: (pageUrl: string) => ({
    page_views_event: 'view',
    page_url: pageUrl,
    page_name: 'APP:WorldCup:DiscoverPharo:Photo Capture Page',
    page_type: 'MGMT',
  }),
  resultPage: (pageUrl: string) => ({
    page_views_event: 'view',
    page_url: pageUrl,
    page_name: 'APP:WorldCup:DiscoverPharo:Final Page',
    page_type: 'MGMT',
  }),
} as const;

export type WorldCup26ClickKey = keyof typeof WorldCup26Clicks;
export type WorldCup26Click = ReturnType<(typeof WorldCup26Clicks)[WorldCup26ClickKey]>;

export type WorldCup26ApiTrackingKey = keyof typeof WorldCup26ApiTracking;
export type WorldCup26ApiTrackingEvent = ReturnType<
  (typeof WorldCup26ApiTracking)[WorldCup26ApiTrackingKey]
>;

export type WorldCup26ViewKey = keyof typeof WorldCup26PageViews;
export type WorldCup26View = ReturnType<(typeof WorldCup26PageViews)[WorldCup26ViewKey]>;

export type WorldCup26TrackingConfig = {
  view?: WorldCup26View;
  click?: WorldCup26Click;
  api?: WorldCup26ApiTrackingEvent;
};
