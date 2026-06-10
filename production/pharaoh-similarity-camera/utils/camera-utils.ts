/**
 * ─── Camera and Frame Capture Utilities ────────────────────────────────────
 *  utility functions for camera operations, frame capture, and canvas handling
 */

import { ResolvedPharaohSimilarityCameraAssets } from '../models/pharaoh.model';

// ─── Types ────────────────────────────────────────────────────────────────
export interface CaptureFrameOptions {
  videoWidth: number;
  videoHeight: number;
  isFrontFacing: boolean;
  quality?: number;
  minQuality?: number;
  maxBytes?: number;
  mimeType?: string;
}

export interface CapturedFrameDimensions {
  width: number;
  height: number;
}

export interface ResolvePharaohSimilarityAssetsOptions {
  backgroundImageUrl?: string;
  backgroundLottieUrl?: string;
  idleFrameUrl?: string;
  activeFrameUrl?: string;
  rectangleFrameUrl?: string;
  faceFrameOverlayUrl?: string;
  errorIconUrl?: string;
}

interface CanvasCompressionOptions {
  mimeType?: string;
  quality?: number;
  minQuality?: number;
  maxBytes?: number;
}

const DEFAULT_IMAGE_MIME_TYPE = 'image/jpeg';
const DEFAULT_IMAGE_COMPRESSION_QUALITY = 0.72;
const MIN_IMAGE_COMPRESSION_QUALITY = 0.4;
const DEFAULT_IMAGE_MAX_BYTES = 450 * 1024;

// ─── File Reading ─────────────────────────────────────────────────────────
/**
 * Reads a File object and converts it to a Data URL string
 * @param file - The file to read
 * @returns Promise resolving to the data URL
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = () => {
      const result = fileReader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new Error('Failed to read file as data URL'));
    };

    fileReader.onerror = () => {
      reject(fileReader.error ?? new Error('Failed to read file'));
    };

    fileReader.readAsDataURL(file);
  });
}

export async function compressImageFileAsDataUrl(
  file: File,
  quality: number = DEFAULT_IMAGE_COMPRESSION_QUALITY
): Promise<string> {
  const sourceDataUrl = await readFileAsDataUrl(file);

  return compressImageDataUrl(sourceDataUrl, quality);
}

export async function compressImageDataUrl(
  sourceDataUrl: string,
  quality: number = DEFAULT_IMAGE_COMPRESSION_QUALITY
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Failed to create canvas context for image compression'));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(
        compressCanvasDataUrl(canvas, {
          mimeType: DEFAULT_IMAGE_MIME_TYPE,
          quality,
          minQuality: MIN_IMAGE_COMPRESSION_QUALITY,
          maxBytes: DEFAULT_IMAGE_MAX_BYTES,
        })
      );
    };

    image.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    image.src = sourceDataUrl;
  });
}

export function extractBase64FromDataUrl(dataUrl: string): string {
  const base64Index = dataUrl.indexOf(',');

  return base64Index >= 0 ? dataUrl.slice(base64Index + 1) : dataUrl;
}

export function compressCanvasDataUrl(
  sourceCanvas: HTMLCanvasElement,
  options: CanvasCompressionOptions = {}
): string {
  const mimeType = options.mimeType ?? DEFAULT_IMAGE_MIME_TYPE;
  const startQuality = clampCompressionQuality(options.quality ?? DEFAULT_IMAGE_COMPRESSION_QUALITY);
  const minQuality = clampCompressionQuality(
    Math.min(startQuality, options.minQuality ?? MIN_IMAGE_COMPRESSION_QUALITY)
  );
  const maxBytes = Math.max(options.maxBytes ?? 500 * 1024, 1);

  if (mimeType !== 'image/jpeg' && mimeType !== 'image/webp') {
    return sourceCanvas.toDataURL(mimeType, startQuality);
  }

  let workingCanvas = sourceCanvas;

  while (workingCanvas.width >= 200 && workingCanvas.height >= 200) {
    const hiCandidate = workingCanvas.toDataURL(mimeType, startQuality);
    if (estimateDataUrlBytes(hiCandidate) <= maxBytes) {
      return hiCandidate;
    }

    const loCandidate = workingCanvas.toDataURL(mimeType, minQuality);
    if (estimateDataUrlBytes(loCandidate) <= maxBytes) {
      // Binary search for highest quality that still fits (4 iterations = ±0.06 precision)
      let lo = minQuality;
      let hi = startQuality;
      let best = loCandidate;
      for (let i = 0; i < 4; i++) {
        const mid = (lo + hi) / 2;
        const midCandidate = workingCanvas.toDataURL(mimeType, mid);
        if (estimateDataUrlBytes(midCandidate) <= maxBytes) {
          best = midCandidate;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return best;
    }

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = Math.floor(workingCanvas.width * 0.8);
    scaledCanvas.height = Math.floor(workingCanvas.height * 0.8);
    const ctx = scaledCanvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(workingCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
    workingCanvas = scaledCanvas;
  }

  return workingCanvas.toDataURL(mimeType, minQuality);
}
export function captureFrameCanvasFromVideo(
  video: HTMLVideoElement,
  options: Pick<CaptureFrameOptions, 'videoWidth' | 'videoHeight' | 'isFrontFacing'>
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = options.videoWidth || video.videoWidth || 1080;
  canvas.height = options.videoHeight || video.videoHeight || 1920;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  if (options.isFrontFacing) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function clampCompressionQuality(value: number): number {
  return Math.min(Math.max(value, 0.1), 0.95);
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64Payload = extractBase64FromDataUrl(dataUrl);
  const paddingChars = base64Payload.endsWith('==') ? 2 : base64Payload.endsWith('=') ? 1 : 0;

  return Math.max(Math.floor((base64Payload.length * 3) / 4) - paddingChars, 0);
}

export function resolvePharaohSimilarityAssets(
  options: ResolvePharaohSimilarityAssetsOptions,
  fallbackAssets: {
    idleFrameUrl: string;
    activeFrameUrl: string;
    errorIconUrl: string;
  }
): ResolvedPharaohSimilarityCameraAssets {
  return {
    backgroundImageUrl: options.backgroundImageUrl?.trim() ?? '',
    backgroundLottieUrl: options.backgroundLottieUrl?.trim() ?? '',
    idleFrameUrl: options.idleFrameUrl?.trim() || fallbackAssets.idleFrameUrl,
    activeFrameUrl: options.activeFrameUrl?.trim() || fallbackAssets.activeFrameUrl,
    rectangleFrameUrl: options.rectangleFrameUrl?.trim() ?? '',
    faceFrameOverlayUrl: options.faceFrameOverlayUrl?.trim() ?? '',
    errorIconUrl: options.errorIconUrl?.trim() || fallbackAssets.errorIconUrl,
  };
}

// ─── Frame Capture ────────────────────────────────────────────────────────
/**
 * Captures the current frame from a video element as a JPEG data URL
 * @param video - The video element to capture from
 * @param options - Capture options (dimensions, facing mode, quality)
 * @returns Data URL string of the captured frame, or empty string if capture fails
 */
export function captureFrameFromVideo(
  video: HTMLVideoElement,
  options: CaptureFrameOptions
): string {
  const canvas = captureFrameCanvasFromVideo(video, options);
  if (!canvas) {
    return '';
  }
  return compressCanvasDataUrl(canvas, {
    mimeType: options.mimeType ?? DEFAULT_IMAGE_MIME_TYPE,
    quality: options.quality ?? DEFAULT_IMAGE_COMPRESSION_QUALITY,
    minQuality: options.minQuality ?? MIN_IMAGE_COMPRESSION_QUALITY,
    maxBytes: options.maxBytes ?? DEFAULT_IMAGE_MAX_BYTES,
  });
}

/**
 * Extracts and returns the dimensions of a captured frame
 * @param video - The video element
 * @returns Object with width and height properties
 */
export function getCapturedFrameDimensions(video: HTMLVideoElement): CapturedFrameDimensions {
  return {
    width: video.videoWidth || 1080,
    height: video.videoHeight || 1920,
  };
}

// ─── Canvas Overlay ───────────────────────────────────────────────────────
/**
 * Resizes an overlay canvas to match the specified rem size
 * @param canvas - The canvas element to resize
 * @param sizeRem - The desired size in rem units (default: 18)
 * @param rootFontSize - The root font size in pixels (default: 16)
 */
export function resizeOverlayCanvas(
  canvas: HTMLCanvasElement,
  sizeRem: number = 18,
  rootFontSize: number = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
): void {
  const overlaySizePx = Math.round(sizeRem * rootFontSize);

  canvas.width = overlaySizePx;
  canvas.height = overlaySizePx;
  canvas.style.width = `${sizeRem}rem`;
  canvas.style.height = `${sizeRem}rem`;
  canvas.style.borderRadius = '100%';
}

// ─── Camera Stream Management ──────────────────────────────────────────────
/**
 * Requests camera access and returns a media stream
 * @param facingMode - 'user' for front camera or 'environment' for back camera
 * @param videoOptions - Optional custom video constraints
 * @returns Promise resolving to a MediaStream
 */
export async function requestCameraStream(
  facingMode: 'user' | 'environment',
  videoOptions?: Partial<MediaTrackConstraints>
): Promise<MediaStream> {
  const preferredVideoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: facingMode },
    // width: { ideal: 1920 },
    // height: { ideal: 1080 },
    // width: { ideal: 1080 },
    // height: { ideal: 1920 },
    // aspectRatio: { ideal: 9 / 16 },
    // ...videoOptions,
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: preferredVideoConstraints,
      audio: false,
    });
    return stream;
  } catch {
    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 9 / 16 },
        ...videoOptions,
      },
      audio: false,
    });
  }
}

export async function getCameraPermissionState(): Promise<PermissionState | 'unavailable'> {
  if (!navigator.permissions?.query) {
    return 'unavailable';
  }

  try {
    const permissionStatus = await navigator.permissions.query({
      name: 'camera' as PermissionName,
    });

    return permissionStatus.state;
  } catch {
    return 'unavailable';
  }
}

export function resolveCameraPermissionState(error: unknown): PermissionState | 'unavailable' {
  if (!(error instanceof DOMException)) {
    return 'prompt';
  }

  if (
    error.name === 'NotAllowedError' ||
    error.name === 'PermissionDeniedError' ||
    error.name === 'SecurityError'
  ) {
    return 'denied';
  }

  return 'prompt';
}

/**
 * Stops all tracks in a media stream and clears the stream reference
 * @param stream - The media stream to stop
 * @param videoElement - Optional video element to clear
 */
export function stopMediaStream(stream: MediaStream | null, videoElement?: HTMLVideoElement): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (videoElement) {
    videoElement.srcObject = null;
  }
}

// ─── Animation Frame Loop Helpers ─────────────────────────────────────────
/**
 * Manages a cancellable animation frame loop with support for async callbacks
 */
export class AnimationFrameLoop {
  private requestId: number | null = null;
  private isRunning = false;
  private callback: ((scheduleNext: () => void) => void | Promise<void>) | null = null;

  /**
   * Start the animation loop with a callback that receives a function to schedule the next frame
   * @param callback - The function to call on each frame. Receives a function to schedule the next frame.
   */
  start(callback: (scheduleNext: () => void) => void | Promise<void>): void {
    this.stop();
    this.callback = callback;
    this.isRunning = true;
    this.scheduleNextFrame();
  }

  /**
   * Schedule the next frame
   */
  scheduleNextFrame(): void {
    if (!this.isRunning || !this.callback) {
      return;
    }

    this.requestId = requestAnimationFrame(() => {
      if (!this.isRunning || !this.callback) {
        return;
      }

      const scheduleNext = () => this.scheduleNextFrame();

      try {
        const result = this.callback(scheduleNext);
        if (result instanceof Promise) {
          result.catch(() => {
            // Silently handle promise rejection
          });
        }
      } catch {
        // Silently handle errors
      }
    });
  }

  /**
   * Stop the animation loop
   */
  stop(): void {
    if (this.requestId !== null) {
      cancelAnimationFrame(this.requestId);
      this.requestId = null;
    }
    this.isRunning = false;
    this.callback = null;
  }

  /**
   * Check if loop is currently running
   */
  isActive(): boolean {
    return this.isRunning && this.requestId !== null;
  }
}

// ─── Progress Management ──────────────────────────────────────────────────
/**
 * Manages progress increment with interval-based updates
 */
export class ProgressManager {
  private intervalId: number | null = null;
  private currentProgress = 0;

  /**
   * Start incrementing progress
   * @param onProgressUpdate - Callback when progress updates
   * @param startValue - Initial progress value (default: 12)
   * @param increment - Amount to increment each interval (default: 8)
   * @param interval - Interval in milliseconds (default: 220)
   * @param maxValue - Maximum progress value (default: 92)
   */
  start(
    onProgressUpdate: (value: number) => void,
    startValue: number = 12,
    increment: number = 8,
    interval: number = 220,
    maxValue: number = 92
  ): void {
    this.stop();
    this.currentProgress = startValue;
    onProgressUpdate(this.currentProgress);

    this.intervalId = window.setInterval(() => {
      if (this.currentProgress >= maxValue) {
        return;
      }

      this.currentProgress = Math.min(maxValue, this.currentProgress + increment);
      onProgressUpdate(this.currentProgress);
    }, interval);
  }

  /**
   * Stop the progress increment
   * @param onProgressUpdate - Callback to set final value
   * @param finalValue - Final progress value (default: 0)
   */
  stop(onProgressUpdate?: (value: number) => void, finalValue: number = 0): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.currentProgress = finalValue;
    if (onProgressUpdate) {
      onProgressUpdate(finalValue);
    }
  }

  /**
   * Complete progress (set to 100) with async frame
   * @param onProgressUpdate - Callback to set final value
   * @returns Promise that resolves after the frame
   */
  async complete(onProgressUpdate: (value: number) => void): Promise<void> {
    this.stop(onProgressUpdate, 100);
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  /**
   * Get current progress value
   */
  getCurrent(): number {
    return this.currentProgress;
  }
}

