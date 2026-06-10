export enum ErrorType {
  INVALID_IMAGE = 'INVALID_IMAGE',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorState {
  type: ErrorType;
  message: string;
  statusCode?: number;
  backendCode?: string;
  originalError?: unknown;
  errorDetails?: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

export interface ErrorConfig {
  type: ErrorType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  canRetry: boolean;
  action?: string;
  actionLabel?: string;
}

export const ERROR_STATUS_MAP: Record<number, ErrorType> = {
  400: ErrorType.INVALID_IMAGE,
  401: ErrorType.UNAUTHORIZED,
  403: ErrorType.NOT_ELIGIBLE,
  413: ErrorType.IMAGE_TOO_LARGE,
  415: ErrorType.UNSUPPORTED_FORMAT,
  500: ErrorType.SERVER_ERROR,
  502: ErrorType.SERVER_ERROR,
  503: ErrorType.SERVER_ERROR,
  504: ErrorType.PROCESSING_TIMEOUT,
};

export const ERROR_BACKEND_CODE_MAP: Record<string, ErrorType> = {
  '2035': ErrorType.NOT_ELIGIBLE,
  INVALID_IMAGE_FORMAT: ErrorType.UNSUPPORTED_FORMAT,
  IMAGE_SIZE_EXCEEDS_LIMIT: ErrorType.IMAGE_TOO_LARGE,
  UPLOAD_FAILED: ErrorType.UPLOAD_FAILED,
  PROCESSING_FAILED: ErrorType.PROCESSING_FAILED,
  USER_NOT_ELIGIBLE: ErrorType.NOT_ELIGIBLE,
  PROCESSING_TIMEOUT: ErrorType.PROCESSING_TIMEOUT,
};
