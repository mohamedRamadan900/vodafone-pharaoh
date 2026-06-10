import { HttpErrorResponse } from '@angular/common/http';
import {
  ErrorType,
  ErrorState,
  ErrorConfig,
  ERROR_STATUS_MAP,
  ERROR_BACKEND_CODE_MAP,
} from '../models/error.model';
/**
 * Determines error type from HTTP response or error code
 */
export function resolveErrorType(error: HttpErrorResponse | Error | string): ErrorType {
  if (typeof error === 'string') {
    return ERROR_BACKEND_CODE_MAP[error] || ErrorType.UNKNOWN_ERROR;
  }
  if (error instanceof HttpErrorResponse) {
    // Check backend error code first
    const backendCode = error.error?.code || error.error?.errorCode;
    if (backendCode && ERROR_BACKEND_CODE_MAP[backendCode]) {
      return ERROR_BACKEND_CODE_MAP[backendCode];
    }
    // Check HTTP status code
    if (ERROR_STATUS_MAP[error.status]) {
      return ERROR_STATUS_MAP[error.status];
    }
    // Handle timeout
    if (error.status === 0 || error.message?.includes('timeout')) {
      return ErrorType.PROCESSING_TIMEOUT;
    }
    return ErrorType.NETWORK_ERROR;
  }
  return ErrorType.UNKNOWN_ERROR;
}
/**
 * Creates user-friendly error UI config based on error type
 */
export function buildErrorConfig(errorType: ErrorType): ErrorConfig {
  const configs: Record<ErrorType, ErrorConfig> = {
    [ErrorType.INVALID_IMAGE]: {
      type: ErrorType.INVALID_IMAGE,
      title: 'feature.worldCup26Cam.error.invalidImage.title',
      description: 'feature.worldCup26Cam.error.invalidImage.description',
      severity: 'warning',
      canRetry: true,
      actionLabel: 'common.tryAgain',
    },
    [ErrorType.IMAGE_TOO_LARGE]: {
      type: ErrorType.IMAGE_TOO_LARGE,
      title: 'feature.worldCup26Cam.error.imageTooLarge.title',
      description: 'feature.worldCup26Cam.error.imageTooLarge.description',
      severity: 'warning',
      canRetry: false,
      actionLabel: 'common.close',
    },
    [ErrorType.UNSUPPORTED_FORMAT]: {
      type: ErrorType.UNSUPPORTED_FORMAT,
      title: 'feature.worldCup26Cam.error.unsupportedFormat.title',
      description: 'feature.worldCup26Cam.error.unsupportedFormat.description',
      severity: 'warning',
      canRetry: false,
      actionLabel: 'common.close',
    },
    [ErrorType.UPLOAD_FAILED]: {
      type: ErrorType.UPLOAD_FAILED,
      title: 'feature.worldCup26Cam.error.uploadFailed.title',
      description: 'feature.worldCup26Cam.error.uploadFailed.description',
      severity: 'error',
      canRetry: true,
      actionLabel: 'common.retry',
    },
    [ErrorType.PROCESSING_FAILED]: {
      type: ErrorType.PROCESSING_FAILED,
      title: 'feature.worldCup26Cam.error.processingFailed.title',
      description: 'feature.worldCup26Cam.error.processingFailed.description',
      severity: 'error',
      canRetry: true,
      actionLabel: 'common.retry',
    },
    [ErrorType.PROCESSING_TIMEOUT]: {
      type: ErrorType.PROCESSING_TIMEOUT,
      title: 'feature.worldCup26Cam.error.processingTimeout.title',
      description: 'feature.worldCup26Cam.error.processingTimeout.description',
      severity: 'error',
      canRetry: true,
      actionLabel: 'common.retry',
    },
    [ErrorType.NETWORK_ERROR]: {
      type: ErrorType.NETWORK_ERROR,
      title: 'feature.worldCup26Cam.error.networkError.title',
      description: 'feature.worldCup26Cam.error.networkError.description',
      severity: 'error',
      canRetry: true,
      actionLabel: 'common.retry',
    },
    [ErrorType.SERVER_ERROR]: {
      type: ErrorType.SERVER_ERROR,
      title: 'feature.worldCup26Cam.error.serverError.title',
      description: 'feature.worldCup26Cam.error.serverError.description',
      severity: 'error',
      canRetry: true,
      actionLabel: 'common.retry',
    },
    [ErrorType.UNAUTHORIZED]: {
      type: ErrorType.UNAUTHORIZED,
      title: 'feature.worldCup26Cam.error.unauthorized.title',
      description: 'feature.worldCup26Cam.error.unauthorized.description',
      severity: 'error',
      canRetry: false,
      actionLabel: 'common.close',
    },
    [ErrorType.NOT_ELIGIBLE]: {
      type: ErrorType.NOT_ELIGIBLE,
      title: 'feature.worldCup26Cam.error.notEligible.title',
      description: 'feature.worldCup26Cam.error.notEligible.description',
      severity: 'info',
      canRetry: false,
      actionLabel: 'common.close',
    },
    [ErrorType.UNKNOWN_ERROR]: {
      type: ErrorType.UNKNOWN_ERROR,
      title: 'feature.worldCup26Cam.error.unknown.title',
      description: 'feature.worldCup26Cam.error.unknown.description',
      severity: 'error',
      canRetry: true,
      actionLabel: 'common.retry',
    },
  };
  return configs[errorType] || configs[ErrorType.UNKNOWN_ERROR];
}
/**
 * Initializes error state
 */
export function createErrorState(
  errorType: ErrorType,
  message: string,
  statusCode?: number,
  backendCode?: string,
  originalError?: unknown
): ErrorState {
  return {
    type: errorType,
    message,
    statusCode,
    backendCode,
    originalError,
    errorDetails: extractErrorDetails(originalError),
    timestamp: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
  };
}
function extractErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if (error instanceof HttpErrorResponse) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
      ok: error.ok,
      headers: error.headers?.keys().reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = error.headers.get(key);
        return acc;
      }, {}),
      error: error.error,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...Object.entries(error).reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
    };
  }
  return { ...error };
}
/**
 * Increments retry count and checks if max retries exceeded
 */
export function incrementRetryCount(errorState: ErrorState): { canRetry: boolean; count: number } {
  const newCount = errorState.retryCount + 1;
  return {
    canRetry: newCount < errorState.maxRetries,
    count: newCount,
  };
}
/**
 * Logs error with full context
 */
export function logError(errorState: ErrorState, context: string): void {
  const logLevel = errorState.type === ErrorType.NOT_ELIGIBLE ? 'info' : 'error';
  console[logLevel as 'error' | 'info'](
    `[${context}] Error Type: ${errorState.type} | Message: ${errorState.message} | Status: ${errorState.statusCode}`,
    {
      errorState,
      errorDetails: errorState.errorDetails,
      originalError: errorState.originalError,
    }
  );
}
