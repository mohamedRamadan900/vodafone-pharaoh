import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { FaceDetection as FaceDetectionType, Results } from '@mediapipe/face_detection';
import * as faceapi from 'face-api.js';
import { firstValueFrom } from 'rxjs';
import {
  FACE_FRAME_HEIGHT_SCALE,
  FACE_FRAME_WIDTH_SCALE,
  FAILURE_COPY_KEYS,
  MP_LEFT_EAR,
  MP_LEFT_EYE,
  MP_MOUTH,
  MP_NOSE_TIP,
  MP_RIGHT_EAR,
  MP_RIGHT_EYE,
  getDefaultFailureCopy,
  getUIMessage,
} from '../defines/constants';
import { APIConfig } from '../config/api-config';
import {
  MediaPipeRatioProfile,
  FaceFrameBounds,
  PharaohApiFlatItem,
  PharaohMatch,
  PharaohSimilarityAnalysis,
  PharaohSimilarityCameraFailureAction,
  PharaohSimilarityCameraFailureCopy,
  PharaohSimilarityCameraFailureCopyKey,
  PharaohSimilarityCameraPermissionState,
  PharaohSimilarityDetection,
  PharaohSimilarityFailureCopyEntry,
  PharaohSimilarityFeatureLabelKey,
  PharaohSimilarityFeatureWinner,
  PharaohSimilarityFinalizeAnalysisOptions,
  PharaohSimilarityGender,
  PharaohSimilarityLiveAnalysisOptions,
  PharaohSimilarityOpenCameraResult,
  PharaohProfile,
  distanceToSimilarity,
  scoreToConfidence,
} from '../models/pharaoh.model';
import {
  AnimationFrameLoop,
  ProgressManager,
  captureFrameCanvasFromVideo,
  captureFrameFromVideo,
  getCameraPermissionState,
  readFileAsDataUrl,
  requestCameraStream,
  resolveCameraPermissionState,
  resizeOverlayCanvas,
  stopMediaStream,
} from '../utils/camera-utils';

@Injectable({ providedIn: 'root' })
export class PharaohSimilarityCameraService {
  private static readonly DEFAULT_ANALYSIS_MAX_LONG_EDGE = 960;
  private static readonly DEFAULT_LIVE_ANALYSIS_MAX_LONG_EDGE = 512;
  private static readonly DEFAULT_LIVE_ANALYSIS_INTERVAL_MS = 140;

  private readonly http = inject(HttpClient);
  private readonly translateService = inject(TranslateService);

  private detector: FaceDetectionType | null = null;
  private mediaPipeInitPromise: Promise<void> | null = null;
  private faceMeshDetector: any | null = null;
  private faceMeshDetectorPromise: Promise<any | null> | null = null;
  private genderModelReady = false;
  private genderModelPromise: Promise<void> | null = null;
  private cameraPointerIcon: HTMLImageElement | null = null;
  private cameraPointerIconPromise: Promise<HTMLImageElement | null> | null = null;
  private faceFrameOverlayImage: HTMLImageElement | null = null;
  private faceFrameOverlayImagePromise: Promise<HTMLImageElement> | null = null;
  private stream: MediaStream | null = null;
  private animationFrameLoop = new AnimationFrameLoop();
  private progressManager = new ProgressManager();
  private pharaohs: PharaohProfile[] = [];
  private preloadedPharaohs: PharaohApiFlatItem[] = [];
  private pharaohsLanguage: string | null = null;
  private previousFaceFrameBounds: FaceFrameBounds | null = null;
  private faceFrameOverlaySource: string | null = null;
  private liveAnalysisCanvas: HTMLCanvasElement | null = null;
  private pendingDetection: { resolve: (r: Results) => void; reject: (e: Error) => void } | null = null;

  async getPermissionState(): Promise<PharaohSimilarityCameraPermissionState> {
    return getCameraPermissionState();
  }

  async openCamera(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    facingMode: 'user' | 'environment',
    useElementSizedCanvas: boolean = false
  ): Promise<PharaohSimilarityOpenCameraResult> {
    this.stopCamera(video);

    try {
      this.stream = await requestCameraStream(facingMode);
      video.srcObject = this.stream;
      await video.play();
      this.resizeLiveOverlayCanvas(canvas, useElementSizedCanvas);

      return {
        opened: true,
        permissionState: 'granted',
      };
    } catch (error) {
      return {
        opened: false,
        permissionState: resolveCameraPermissionState(error),
      };
    }
  }

  async initMediaPipe(): Promise<void> {
    if (this.detector) {
      return;
    }

    this.mediaPipeInitPromise =
      this.mediaPipeInitPromise ??
      this.initializeMediaPipe().catch((error) => {
        this.mediaPipeInitPromise = null;
        throw error;
      });

    await this.mediaPipeInitPromise;
  }

  async prewarmRuntime(
    options: { preloadGenderModel?: boolean; faceFrameOverlayUrl?: string } = {}
  ): Promise<void> {
    await Promise.all([this.initMediaPipe(), this.ensurePharaohsLoaded()]);

    const preloadTasks: Array<Promise<unknown>> = [];

    if (options.preloadGenderModel !== false) {
      preloadTasks.push(this.warmUpGenderModel().catch(() => undefined));
    }

    if (options.faceFrameOverlayUrl?.trim()) {
      preloadTasks.push(
        this.initFaceMeshOverlay(options.faceFrameOverlayUrl).catch(() => undefined)
      );
    }

    await Promise.all(preloadTasks);
  }

  async initFaceMeshOverlay(faceFrameOverlayUrl?: string): Promise<void> {
    await this.ensureFaceFrameOverlayImage(faceFrameOverlayUrl);
  }

  async ensureOverlayPointerIcon(): Promise<void> {
    await this.ensureCameraPointerIcon();
  }

  async detectSource(
    image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<Results> {
    if (!this.detector) {
      throw new Error('MediaPipe Face Detection is not initialized yet.');
    }

    return new Promise<Results>((resolve, reject) => {
      this.pendingDetection = { resolve, reject };
      this.detector!.send({ image }).catch((error: unknown) => {
        const pending = this.pendingDetection;
        this.pendingDetection = null;
        pending?.reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  async analyzeCapturedImage(
    dataUrl: string,
    usePreciseFeatureAnchors: boolean = false
  ): Promise<PharaohSimilarityAnalysis> {
    await this.ensurePharaohsLoaded();
    const image = await this.loadImage(dataUrl);
    const results = await this.detectSource(image);
    const analysis = this.createAnalysisFromResults(
      results,
      image.naturalWidth || image.width,
      image.naturalHeight || image.height
    );

    if (!usePreciseFeatureAnchors) {
      return analysis;
    }

    const preciseAnchors = await this.detectPreciseFeatureAnchors(image, analysis.detection);

    return preciseAnchors
      ? {
          ...analysis,
          detection: {
            ...analysis.detection,
            featureAnchors: preciseAnchors,
          },
          featureWinners: analysis.featureWinners.map((winner) => ({
            ...winner,
            anchor: preciseAnchors[winner.featureId] ?? winner.anchor,
          })),
        }
      : analysis;
  }

  createAnalysisFromResults(
    results: Results,
    imageWidth: number,
    imageHeight: number
  ): PharaohSimilarityAnalysis {
    const detection = results.detections?.[0];
    if (!detection?.landmarks || detection.landmarks.length < 6) {
      throw new Error('No clear face was detected. Please center the face and try again.');
    }

    const ratios = this.computeRatios(detection, imageWidth, imageHeight);
    const featureWinners = this.buildFeatureWinners(detection, ratios);

    return {
      detection: {
        landmarks: detection.landmarks,
        boundingBox: detection.boundingBox ?? null,
      },
      sourceSize: {
        width: imageWidth,
        height: imageHeight,
      },
      detectedRatios: ratios,
      detectedGender: null,
      featureWinners,
      match: this.matchMediaPipeRatios(ratios),
    };
  }

  async finalizeAnalysisWithGender(
    source: string | HTMLCanvasElement | HTMLImageElement,
    options: PharaohSimilarityFinalizeAnalysisOptions = {}
  ): Promise<PharaohSimilarityAnalysis> {
    await Promise.all([this.initMediaPipe(), this.ensurePharaohsLoaded()]);

    const imageSource = await this.resolveImageSource(source);
    const analysisSource = this.createAnalysisSource(
      imageSource,
      options.analysisMaxLongEdge ?? PharaohSimilarityCameraService.DEFAULT_ANALYSIS_MAX_LONG_EDGE
    );
    const { width: originalWidth, height: originalHeight } =
      this.getImageSourceDimensions(imageSource);

    const results = await this.detectSource(analysisSource);
    const baseAnalysis = this.createAnalysisFromResults(results, originalWidth, originalHeight);

    let detectedGender: PharaohSimilarityGender | null = null;

    try {
      detectedGender = await this.detectGenderFromFaceRegion(
        analysisSource,
        baseAnalysis.detection
      );
    } catch {
      detectedGender = null;
    }

    return {
      ...baseAnalysis,
      detectedGender,
      featureWinners: this.buildFeatureWinners(
        baseAnalysis.detection,
        baseAnalysis.detectedRatios,
        detectedGender?.value
      ),
      match: this.matchMediaPipeRatios(baseAnalysis.detectedRatios, detectedGender?.value),
    };
  }

  startLiveAnalysisLoop(options: PharaohSimilarityLiveAnalysisOptions): void {
    this.stopLiveAnalysisLoop();
    let isProcessing = false;
    let lastAnalysisTimestamp = 0;

    this.animationFrameLoop.start(async (scheduleNext) => {
      if (!options.shouldAnalyze()) {
        return;
      }

      if (isProcessing) {
        scheduleNext();
        return;
      }

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const analysisIntervalMs =
        options.analysisIntervalMs ??
        PharaohSimilarityCameraService.DEFAULT_LIVE_ANALYSIS_INTERVAL_MS;
      if (now - lastAnalysisTimestamp < analysisIntervalMs) {
        scheduleNext();
        return;
      }

      if (options.video.readyState >= 2) {
        isProcessing = true;
        lastAnalysisTimestamp = now;

        try {
          if (options.useFaceMeshOverlay?.() && !this.faceFrameOverlayImage) {
            const faceFrameOverlayUrl = options.faceFrameOverlayUrl?.();
            if (faceFrameOverlayUrl?.trim()) {
              await this.initFaceMeshOverlay(faceFrameOverlayUrl).catch(() => undefined);
            }
          }

          this.resizeLiveOverlayCanvas(options.canvas, !!options.useElementSizedCanvas);
          const analysisSource = this.createVideoAnalysisSource(
            options.video,
            options.analysisMaxLongEdge ??
              PharaohSimilarityCameraService.DEFAULT_LIVE_ANALYSIS_MAX_LONG_EDGE
          );
          const results = await this.detectSource(analysisSource);

          if (!results.detections?.length) {
            options.onAvailabilityChange(false);
            this.resetFaceFrameTracking();
            options.onOverlayClear();
          } else {
            const analysis = this.createAnalysisFromResults(
              results,
              options.video.videoWidth || options.canvas.width,
              options.video.videoHeight || options.canvas.height
            );

            options.onAvailabilityChange(true);
            if (options.useFaceMeshOverlay?.() && this.faceFrameOverlayImage) {
              this.drawFaceFrameOverlay(
                options.canvas,
                analysis.detection,
                options.video.videoWidth || options.canvas.width,
                options.video.videoHeight || options.canvas.height,
                options.isMirrored()
              );
            } else {
              this.resetFaceFrameTracking();
              this.drawLegacyOverlay(
                options.canvas,
                analysis.detection,
                analysis.featureWinners,
                options.video.videoWidth || options.canvas.width,
                options.video.videoHeight || options.canvas.height,
                options.isMirrored(),
                this.getLiveOverlayScaleBoost(!!options.useElementSizedCanvas)
              );
            }
          }
        } catch {
          options.onAvailabilityChange(false);
          this.resetFaceFrameTracking();
          options.onOverlayClear();
        } finally {
          isProcessing = false;
        }
      }

      scheduleNext();
    });
  }

  stopLiveAnalysisLoop(): void {
    this.animationFrameLoop.stop();
    this.resetFaceFrameTracking();
  }

  startProcessingProgress(onProgressUpdate: (value: number) => void): void {
    this.progressManager.start(onProgressUpdate);
  }

  stopProcessingProgress(onProgressUpdate: (value: number) => void, finalValue: number = 0): void {
    this.progressManager.stop(onProgressUpdate, finalValue);
  }

  completeProcessingProgress(onProgressUpdate: (value: number) => void): Promise<void> {
    return this.progressManager.complete(onProgressUpdate);
  }

  captureFrame(video: HTMLVideoElement, facingMode: 'user' | 'environment'): string {
    return captureFrameFromVideo(video, {
      videoWidth: video.videoWidth || 1080,
      videoHeight: video.videoHeight || 1920,
      isFrontFacing: facingMode === 'user',
      mimeType: 'image/jpeg',
      quality: 0.7,
      minQuality: 0.4,
      maxBytes: 450 * 1024,
    });
  }

  captureFrameCanvas(
    video: HTMLVideoElement,
    facingMode: 'user' | 'environment'
  ): HTMLCanvasElement | null {
    return captureFrameCanvasFromVideo(video, {
      videoWidth: video.videoWidth || 1080,
      videoHeight: video.videoHeight || 1920,
      isFrontFacing: facingMode === 'user',
    });
  }

  warmUpGenderModel(): Promise<void> {
    return this.ensureGenderModel();
  }

  readImageFileAsDataUrl(file: File): Promise<string> {
    return readFileAsDataUrl(file);
  }

  resizeOverlayCanvas(canvas: HTMLCanvasElement): void {
    resizeOverlayCanvas(canvas);
  }

  setPreloadedPharaohs(pharaohs: PharaohApiFlatItem[] | null | undefined): void {
    this.preloadedPharaohs = Array.isArray(pharaohs) ? pharaohs : [];
    this.pharaohsLanguage = null;
  }

  resolveFailureCopyEntry(
    failureCopy: PharaohSimilarityCameraFailureCopy | undefined,
    key: PharaohSimilarityCameraFailureCopyKey,
    uiLanguage: 'en' | 'ar'
  ): PharaohSimilarityFailureCopyEntry {
    const defaultFailureCopy = getDefaultFailureCopy(key, uiLanguage);

    return {
      title: failureCopy?.title || defaultFailureCopy.title,
      buttonText: failureCopy?.buttonText || defaultFailureCopy.buttonText,
      action: failureCopy?.action || defaultFailureCopy.action,
    };
  }

  resolveFailureCopy(
    failureCopy:
      | Partial<Record<PharaohSimilarityCameraFailureCopyKey, PharaohSimilarityCameraFailureCopy>>
      | undefined,
    uiLanguage: 'en' | 'ar'
  ): Record<PharaohSimilarityCameraFailureCopyKey, PharaohSimilarityFailureCopyEntry> {
    return FAILURE_COPY_KEYS.reduce(
      (resolvedFailureCopy, key) => {
        resolvedFailureCopy[key] = this.resolveFailureCopyEntry(
          failureCopy?.[key],
          key,
          uiLanguage
        );
        return resolvedFailureCopy;
      },
      {} as Record<PharaohSimilarityCameraFailureCopyKey, PharaohSimilarityFailureCopyEntry>
    );
  }

  stopCamera(video?: HTMLVideoElement): void {
    stopMediaStream(this.stream, video);
    this.stream = null;
  }

  stopRuntime(
    video: HTMLVideoElement | undefined,
    onProgressUpdate: (value: number) => void,
    finalProgress: number = 0
  ): void {
    this.stopLiveAnalysisLoop();
    this.stopProcessingProgress(onProgressUpdate, finalProgress);
    this.stopCamera(video);
  }

  drawOverlay(
    canvas: HTMLCanvasElement,
    detection: PharaohSimilarityDetection | null,
    featureWinners: PharaohSimilarityFeatureWinner[] = [],
    sourceWidth: number = canvas.width,
    sourceHeight: number = canvas.height,
    mirrorX: boolean = false,
    scaleBoost: number = 1,
    textScaleBoost: number = 1
  ): void {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection?.landmarks?.length) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const overlayScale = this.getOverlayMarkerScale(width, scaleBoost);
    const drawMetrics = this.getCoverMetrics(width, height, sourceWidth, sourceHeight);
    const mapX = (normalizedX: number) => {
      const effectiveX = mirrorX ? 1 - normalizedX : normalizedX;
      return drawMetrics.offsetX + effectiveX * drawMetrics.drawWidth;
    };
    const mapY = (normalizedY: number) =>
      drawMetrics.offsetY + normalizedY * drawMetrics.drawHeight;
    const featureLabels = new Map(featureWinners.map((winner) => [winner.featureId, winner]));
    const featureAnchors = this.getFeatureAnchors(detection);
    const renderedFaceCenterX =
      (mapX(featureAnchors.rightEye.x) + mapX(featureAnchors.leftEye.x)) / 2;
    const keypointMarkers = [
      {
        key: 'rightEye' as const,
        size: 62 * overlayScale,
        lineLengthMultiplier: 1,
      },
      {
        key: 'leftEye' as const,
        size: 62 * overlayScale,
        lineLengthMultiplier: 1,
      },
      {
        key: 'nose' as const,
        size: 66 * overlayScale,
        lineLengthMultiplier: 1.45,
      },
      {
        key: 'mouth' as const,
        size: 62 * overlayScale,
        lineLengthMultiplier: 1,
      },
    ];

    const pointerIcon = this.getCameraPointerIcon();
    keypointMarkers.forEach((marker) => {
      const featureLabel = featureLabels.get(marker.key);
      const anchor = featureLabel?.anchor ?? featureAnchors[marker.key];
      const x = mapX(anchor.x);
      const y = mapY(anchor.y);
      const effectivePreferredSide =
        marker.key === 'rightEye' || marker.key === 'leftEye'
          ? x < renderedFaceCenterX
            ? 'left'
            : 'right'
          : (featureLabel?.preferredSide ?? 'right');
      this.drawKeypointMarker(
        context,
        pointerIcon,
        x,
        y,
        this.getFeatureDisplayLabel(marker.key, featureLabel?.detailText ?? ''),
        '',
        marker.size,
        overlayScale,
        textScaleBoost,
        featureLabel?.verticalOffset ?? 0,
        effectivePreferredSide,
        marker.lineLengthMultiplier
      );
    });
  }

  drawLegacyOverlay(
    canvas: HTMLCanvasElement,
    detection: PharaohSimilarityDetection | null,
    featureWinners: PharaohSimilarityFeatureWinner[] = [],
    sourceWidth: number = canvas.width,
    sourceHeight: number = canvas.height,
    mirrorX: boolean = false,
    scaleBoost: number = 1
  ): void {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection?.landmarks?.length) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const overlayScale = this.getLegacyOverlayMarkerScale(width, scaleBoost);
    const drawMetrics = this.getCoverMetrics(width, height, sourceWidth, sourceHeight);
    const mapX = (normalizedX: number) => {
      const effectiveX = mirrorX ? 1 - normalizedX : normalizedX;
      return drawMetrics.offsetX + effectiveX * drawMetrics.drawWidth;
    };
    const mapY = (normalizedY: number) =>
      drawMetrics.offsetY + normalizedY * drawMetrics.drawHeight;
    const featureLabels = new Map(
      featureWinners.map((winner) => [
        winner.label,
        {
          name: winner.winner.name,
          similarity: winner.similarity,
          verticalOffset: winner.verticalOffset,
          preferredSide: winner.preferredSide,
        },
      ])
    );
    const keypointMarkers = [
      { index: MP_RIGHT_EYE, label: this.getFeatureLabel('rightEye'), size: 30 * overlayScale },
      { index: MP_LEFT_EYE, label: this.getFeatureLabel('leftEye'), size: 30 * overlayScale },
      { index: MP_NOSE_TIP, label: this.getFeatureLabel('nose'), size: 34 * overlayScale },
      { index: MP_MOUTH, label: this.getFeatureLabel('mouth'), size: 30 * overlayScale },
    ];

    const points = detection.landmarks;
    const pointerIcon = this.getCameraPointerIcon();
    keypointMarkers.forEach((marker) => {
      const point = points[marker.index];
      if (!point) {
        return;
      }

      const x = mapX(point.x);
      const y = mapY(point.y);
      const featureLabel = featureLabels.get(marker.label);
      this.drawLegacyKeypointMarker(
        context,
        pointerIcon,
        x,
        y,
        marker.label,
        featureLabel ? `${featureLabel.name} ${featureLabel.similarity}%` : '',
        marker.size,
        overlayScale,
        featureLabel?.verticalOffset ?? 0,
        featureLabel?.preferredSide ?? 'right'
      );
    });
  }

  drawFeatureWinnerOverlay(
    canvas: HTMLCanvasElement,
    detection: PharaohSimilarityDetection | null,
    featureWinner: PharaohSimilarityFeatureWinner | null,
    sourceWidth: number = canvas.width,
    sourceHeight: number = canvas.height,
    mirrorX: boolean = false,
    scaleBoost: number = 1
  ): void {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection?.landmarks?.length || !featureWinner) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const overlayScale = this.getOverlayMarkerScale(width, scaleBoost);
    const drawMetrics = this.getCoverMetrics(width, height, sourceWidth, sourceHeight);
    const mapX = (normalizedX: number) => {
      const effectiveX = mirrorX ? 1 - normalizedX : normalizedX;
      return drawMetrics.offsetX + effectiveX * drawMetrics.drawWidth;
    };
    const mapY = (normalizedY: number) =>
      drawMetrics.offsetY + normalizedY * drawMetrics.drawHeight;
    const pointerIcon = this.getCameraPointerIcon();
    const anchorX = mapX(featureWinner.anchor.x);
    const anchorY = mapY(featureWinner.anchor.y);

    this.drawKeypointMarker(
      context,
      pointerIcon,
      anchorX,
      anchorY,
      featureWinner.winner.name,
      '',
      30 * overlayScale,
      overlayScale,
      1,
      featureWinner.verticalOffset,
      featureWinner.preferredSide
    );
  }

  dispose(): void {
    this.stopLiveAnalysisLoop();
    this.pendingDetection = null;
    this.detector?.close();
    this.detector = null;
    this.mediaPipeInitPromise = null;
    this.faceMeshDetector?.dispose?.();
    this.faceMeshDetector = null;
    this.faceMeshDetectorPromise = null;
    this.faceFrameOverlayImage = null;
    this.faceFrameOverlayImagePromise = null;
    this.liveAnalysisCanvas = null;
  }

  private drawFaceFrameOverlay(
    canvas: HTMLCanvasElement,
    detection: PharaohSimilarityDetection,
    sourceWidth: number,
    sourceHeight: number,
    mirrorX: boolean
  ): void {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection.landmarks?.length) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const drawMetrics = this.getCoverMetrics(width, height, sourceWidth, sourceHeight);
    const frameBounds = this.getFaceFrameBounds(detection);
    if (!frameBounds) {
      this.resetFaceFrameTracking();
      return;
    }

    const stabilizedBounds = this.getStabilizedFaceFrameBounds(frameBounds);
    const overlayImage = this.faceFrameOverlayImage;

    if (!overlayImage) {
      return;
    }

    const mapX = (normalizedX: number) => {
      const effectiveX = mirrorX ? 1 - normalizedX : normalizedX;
      return drawMetrics.offsetX + effectiveX * drawMetrics.drawWidth;
    };
    const mapY = (normalizedY: number) =>
      drawMetrics.offsetY + normalizedY * drawMetrics.drawHeight;
    const rightEar = detection.landmarks[MP_RIGHT_EAR];
    const leftEar = detection.landmarks[MP_LEFT_EAR];
    const rightEye = detection.landmarks[MP_RIGHT_EYE];
    const leftEye = detection.landmarks[MP_LEFT_EYE];
    const noseTip = detection.landmarks[MP_NOSE_TIP];
    const mouth = detection.landmarks[MP_MOUTH];
    const mappedFaceWidth = Math.max(
      (stabilizedBounds.maxX - stabilizedBounds.minX) * drawMetrics.drawWidth,
      1
    );
    const mappedFaceHeight = Math.max(
      (stabilizedBounds.maxY - stabilizedBounds.minY) * drawMetrics.drawHeight,
      1
    );
    const boundsCenterX = (stabilizedBounds.minX + stabilizedBounds.maxX) / 2;
    const boundsCenterY = (stabilizedBounds.minY + stabilizedBounds.maxY) / 2;
    const featureCenterX =
      rightEye && leftEye
        ? (rightEye.x + leftEye.x) / 2
        : rightEar && leftEar
          ? (rightEar.x + leftEar.x) / 2
          : boundsCenterX;
    const eyeMidY = rightEye && leftEye ? (rightEye.y + leftEye.y) / 2 : boundsCenterY;
    const featureCenterY = mouth
      ? eyeMidY + (mouth.y - eyeMidY) * 0.42
      : noseTip
        ? eyeMidY + (noseTip.y - eyeMidY) * 0.7
        : boundsCenterY;
    const faceCenterX = mapX(featureCenterX);
    const faceCenterY = mapY(featureCenterY);
    const trackedFaceWidth =
      rightEar && leftEar
        ? Math.max(Math.abs(mapX(leftEar.x) - mapX(rightEar.x)), 1)
        : mappedFaceWidth;
    const overlayWidth = trackedFaceWidth * FACE_FRAME_WIDTH_SCALE;
    const overlayAspectRatio =
      overlayImage.naturalWidth && overlayImage.naturalHeight
        ? overlayImage.naturalHeight / overlayImage.naturalWidth
        : 1;
    const overlayHeight = Math.max(
      overlayWidth * overlayAspectRatio,
      mappedFaceHeight * FACE_FRAME_HEIGHT_SCALE
    );
    const drawX = faceCenterX - overlayWidth / 2;
    const verticalLift = overlayHeight * 0.06;
    const drawY = faceCenterY - overlayHeight / 2 - verticalLift;

    context.save();
    context.imageSmoothingEnabled = true;
    context.globalAlpha = 0.96;
    context.drawImage(overlayImage, drawX, drawY, overlayWidth, overlayHeight);

    context.restore();
  }

  private resetFaceFrameTracking(): void {
    this.previousFaceFrameBounds = null;
  }

  private async ensureFaceFrameOverlayImage(
    faceFrameOverlayUrl?: string
  ): Promise<HTMLImageElement> {
    if (!faceFrameOverlayUrl?.trim()) {
      throw new Error('Face frame overlay URL is required to initialize the overlay image.');
    }

    if (this.faceFrameOverlayImage && this.faceFrameOverlaySource === faceFrameOverlayUrl) {
      return this.faceFrameOverlayImage;
    }

    if (!this.faceFrameOverlayImagePromise || this.faceFrameOverlaySource !== faceFrameOverlayUrl) {
      this.faceFrameOverlayImage = null;
      this.faceFrameOverlaySource = faceFrameOverlayUrl;
      this.faceFrameOverlayImagePromise = this.loadImage(faceFrameOverlayUrl)
        .then((image) => {
          this.faceFrameOverlayImage = image;
          return image;
        })
        .catch((error) => {
          this.faceFrameOverlayImage = null;
          this.faceFrameOverlayImagePromise = null;
          if (this.faceFrameOverlaySource === faceFrameOverlayUrl) {
            this.faceFrameOverlaySource = null;
          }
          throw error;
        });
    }

    return this.faceFrameOverlayImagePromise;
  }

  private getFaceFrameBounds(detection: PharaohSimilarityDetection): FaceFrameBounds | null {
    const landmarks = detection.landmarks ?? [];
    const rightEar = landmarks[MP_RIGHT_EAR];
    const leftEar = landmarks[MP_LEFT_EAR];
    const boundingBox = detection.boundingBox;

    if (boundingBox) {
      const boxMinX = boundingBox.xCenter - boundingBox.width / 2;
      const boxMaxX = boundingBox.xCenter + boundingBox.width / 2;
      const boxMinY = boundingBox.yCenter - boundingBox.height / 2;
      const boxMaxY = boundingBox.yCenter + boundingBox.height / 2;
      const widthFromEars =
        rightEar && leftEar ? Math.abs(leftEar.x - rightEar.x) : boundingBox.width;
      const centerX = rightEar && leftEar ? (rightEar.x + leftEar.x) / 2 : boundingBox.xCenter;
      const minX = centerX - widthFromEars / 2;
      const maxX = centerX + widthFromEars / 2;

      return {
        minX: Math.max(0, Math.min(minX, boxMinX)),
        minY: Math.max(0, boxMinY),
        maxX: Math.min(1, Math.max(maxX, boxMaxX)),
        maxY: Math.min(1, boxMaxY),
      };
    }

    if (landmarks.length) {
      return landmarks.reduce<FaceFrameBounds>(
        (bounds, point) => ({
          minX: Math.min(bounds.minX, point.x),
          minY: Math.min(bounds.minY, point.y),
          maxX: Math.max(bounds.maxX, point.x),
          maxY: Math.max(bounds.maxY, point.y),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      );
    }

    return null;
  }

  private getStabilizedFaceFrameBounds(bounds: FaceFrameBounds): FaceFrameBounds {
    if (!this.previousFaceFrameBounds) {
      this.previousFaceFrameBounds = bounds;
      return bounds;
    }

    const smoothing = 0.42;
    this.previousFaceFrameBounds = {
      minX:
        this.previousFaceFrameBounds.minX +
        (bounds.minX - this.previousFaceFrameBounds.minX) * smoothing,
      minY:
        this.previousFaceFrameBounds.minY +
        (bounds.minY - this.previousFaceFrameBounds.minY) * smoothing,
      maxX:
        this.previousFaceFrameBounds.maxX +
        (bounds.maxX - this.previousFaceFrameBounds.maxX) * smoothing,
      maxY:
        this.previousFaceFrameBounds.maxY +
        (bounds.maxY - this.previousFaceFrameBounds.maxY) * smoothing,
    };

    return this.previousFaceFrameBounds;
  }

  private async ensureGenderModel(): Promise<void> {
    if (this.genderModelReady) {
      return;
    }

    this.genderModelPromise =
      this.genderModelPromise ??
      (async () => {
        const modelUrl = 'assets/models';
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
          await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl);
        }
        if (!faceapi.nets.ageGenderNet.isLoaded) {
          await faceapi.nets.ageGenderNet.loadFromUri(modelUrl);
        }
        this.genderModelReady = true;
      })().catch((error) => {
        this.genderModelPromise = null;
        throw error;
      });

    await this.genderModelPromise;
  }

  private async detectGenderFromFaceRegion(
    image: HTMLImageElement | HTMLCanvasElement,
    detection: PharaohSimilarityDetection
  ): Promise<PharaohSimilarityGender | null> {
    await this.ensureGenderModel();

    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
    const candidate = detection.boundingBox
      ? this.createFaceCropCanvas(image, detection.boundingBox, 0.45)
      : image;

    const genderDetection = await faceapi.detectSingleFace(candidate, options).withAgeAndGender();

    if (!genderDetection) {
      return null;
    }

    const best: PharaohSimilarityGender = {
      value: genderDetection.gender as 'male' | 'female',
      probability: genderDetection.genderProbability,
    };

    return best.probability >= 0.55 ? best : null;
  }

  private computeRatios(
    detection: {
      landmarks?: Array<{ x: number; y: number }>;
      boundingBox?: { width: number; height: number } | null;
    },
    imageWidth: number,
    imageHeight: number
  ): MediaPipeRatioProfile {
    const keypoints = detection.landmarks!;
    const rightEye = keypoints[MP_RIGHT_EYE];
    const leftEye = keypoints[MP_LEFT_EYE];
    const noseTip = keypoints[MP_NOSE_TIP];
    const mouth = keypoints[MP_MOUTH];
    const rightEar = keypoints[MP_RIGHT_EAR];
    const leftEar = keypoints[MP_LEFT_EAR];
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const earMidY = (leftEar.y + rightEar.y) / 2;
    const eyeMouthSpanY = mouth.y - eyeMidY || 0.001;
    const boundingBox = detection.boundingBox;

    return {
      eyeXSpan: Math.abs(leftEye.x - rightEye.x) / (Math.abs(leftEar.x - rightEar.x) || 0.001),
      nosePositionY: (noseTip.y - eyeMidY) / eyeMouthSpanY,
      earPositionY: (earMidY - eyeMidY) / eyeMouthSpanY,
      faceAspectRatio:
        boundingBox && imageWidth && imageHeight
          ? (boundingBox.width * imageWidth) / (boundingBox.height * imageHeight)
          : 0.8,
    };
  }

  private buildFeatureWinners(
    detection: PharaohSimilarityDetection,
    ratios: MediaPipeRatioProfile,
    gender?: 'male' | 'female'
  ): PharaohSimilarityFeatureWinner[] {
    const pool = this.getPharaohPool(gender);
    const featureAnchors = this.getFeatureAnchors(detection);
    const dimensions: Array<{
      featureId: PharaohSimilarityFeatureLabelKey;
      key: keyof MediaPipeRatioProfile;
      label: string;
      icon: string;
      anchor: { x: number; y: number };
      preferredSide: 'left' | 'right' | 'bottom';
      verticalOffset: number;
    }> = [
      {
        featureId: 'rightEye',
        key: 'eyeXSpan',
        label: this.getFeatureLabel('rightEye'),
        icon: '👁',
        anchor: featureAnchors.rightEye,
        preferredSide: 'right',
        verticalOffset: -54,
      },
      {
        // earPositionY captures a different facial proportion than eyeXSpan,
        // giving each eye an independent pharaoh match
        featureId: 'leftEye',
        key: 'earPositionY',
        label: this.getFeatureLabel('leftEye'),
        icon: '👁',
        anchor: featureAnchors.leftEye,
        preferredSide: 'left',
        verticalOffset: -54,
      },
      {
        featureId: 'nose',
        key: 'nosePositionY',
        label: this.getFeatureLabel('nose'),
        icon: '👃',
        anchor: featureAnchors.nose,
        preferredSide: 'right',
        verticalOffset: -8,
      },
      {
        // faceAspectRatio is excluded from the overall match but still useful
        // as an independent per-feature signal for mouth/jaw shape
        featureId: 'mouth',
        key: 'faceAspectRatio',
        label: this.getFeatureLabel('mouth'),
        icon: '👄',
        anchor: featureAnchors.mouth,
        preferredSide: 'bottom',
        verticalOffset: 46,
      },
    ];

    return dimensions.map((dimension) => {
      const winner = pool.reduce(
        (best, pharaoh) => {
          const difference = Math.abs(ratios[dimension.key] - pharaoh.mpRatios[dimension.key]);
          return difference < best.difference ? { pharaoh, difference } : best;
        },
        { pharaoh: pool[0], difference: Number.POSITIVE_INFINITY }
      );
      const spread = this.getDimensionSpread(pool, dimension.key);

      return {
        featureId: dimension.featureId,
        key: dimension.key,
        label: dimension.label,
        icon: dimension.icon,
        winner: winner.pharaoh,
        anchor: dimension.anchor,
        similarity: this.toFeatureSimilarity(winner.difference, spread),
        detailText: this.getFeatureDetailText(dimension.key, ratios[dimension.key], pool),
        preferredSide: dimension.preferredSide,
        verticalOffset: dimension.verticalOffset,
      };
    });
  }

  private getCurrentLanguage(): string {
    return (
      this.translateService.currentLang ||
      this.translateService.defaultLang ||
      'en'
    ).toLowerCase();
  }

  private async loadPharaohs(lang: string = this.getCurrentLanguage()): Promise<void> {
    if (this.pharaohsLanguage === lang && this.pharaohs.length) {
      return;
    }

    const mappedPreloadedPharaohs = this.mapPharaohsResponse(this.preloadedPharaohs);
    if (mappedPreloadedPharaohs.length) {
      this.pharaohs = mappedPreloadedPharaohs;
      this.pharaohsLanguage = lang;
      return;
    }

    const response = await firstValueFrom(
      this.http.get<
        PharaohApiFlatItem[] | { data?: PharaohApiFlatItem[]; items?: PharaohApiFlatItem[] }
      >(APIConfig.pharaohs_dataList.url(lang))
    );
    const mappedPharaohs = this.mapPharaohsResponse(response);

    if (!mappedPharaohs.length) {
      throw new Error('Failed to load pharaoh profiles.');
    }

    this.pharaohs = mappedPharaohs;
    this.pharaohsLanguage = lang;
  }

  private async initializeMediaPipe(): Promise<void> {
    if (!this.detector) {
      const { FaceDetection } = (await import('@mediapipe/face_detection')) as {
        FaceDetection: new (config: { locateFile: (f: string) => string }) => FaceDetectionType;
      };

      this.detector = new FaceDetection({
        locateFile: (file: string) => `assets/mediapipe/face_detection/${file}`,
      });

      (
        this.detector as FaceDetectionType & { setOptions(opts: Record<string, unknown>): void }
      ).setOptions({
        model: 'short',
        minDetectionConfidence: 0.5,
      });

      // Register once — replaces old handler safely on re-init after dispose()
      this.detector.onResults((results: Results) => {
        const pending = this.pendingDetection;
        this.pendingDetection = null;
        pending?.resolve(results);
      });

      await this.detector.initialize();
    }

    this.mediaPipeInitPromise = null;
  }

  private async ensurePharaohsLoaded(): Promise<void> {
    await this.loadPharaohs(this.getCurrentLanguage());
  }

  private mapPharaohsResponse(
    response: PharaohApiFlatItem[] | { data?: PharaohApiFlatItem[]; items?: PharaohApiFlatItem[] }
  ): PharaohProfile[] {
    const records = Array.isArray(response) ? response : response.data || response.items || [];

    return records
      .map((item) => this.mapPharaohFlatItem(item))
      .filter((item): item is PharaohProfile => !!item);
  }

  private mapPharaohFlatItem(item: PharaohApiFlatItem): PharaohProfile | null {
    const ids = this.getStringField(item, ['ids', 'id']);
    const name = this.getStringField(item, ['name']);
    const title = this.getStringField(item, ['title']);
    const description = this.getStringField(item, ['description']);
    const genderValue = this.getStringField(item, ['gender']);

    if (!ids || !name || !title || !description || !this.isPharaohGender(genderValue)) {
      return null;
    }

    return {
      ids,
      name,
      title,
      description,
      gender: genderValue,
      imageUrl: this.getOptionalStringField(item, ['imageUrl', 'image', 'img', 'image_path']),
      ratios: {
        eyeSpanToFace: this.getNumberField(item, ['eyeSpanToFace']),
        noseWidthToFace: this.getNumberField(item, ['noseWidthToFace']),
        mouthWidthToFace: this.getNumberField(item, ['mouthWidthToFace']),
        jawToFace: this.getNumberField(item, ['jawToFace']),
        noseLengthNorm: this.getNumberField(item, ['noseLengthNorm']),
        mouthChinNorm: this.getNumberField(item, ['mouthChinNorm']),
      },
      mpRatios: {
        eyeXSpan: this.getNumberField(item, ['eyeXSpan']),
        nosePositionY: this.getNumberField(item, ['nosePositionY']),
        earPositionY: this.getNumberField(item, ['earPositionY']),
        faceAspectRatio: this.getNumberField(item, ['faceAspectRatio']),
      },
    };
  }

  private getStringField(item: PharaohApiFlatItem, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private getOptionalStringField(item: PharaohApiFlatItem, keys: string[]): string | undefined {
    const value = this.getStringField(item, keys);
    return value || undefined;
  }

  private getNumberField(item: PharaohApiFlatItem, keys: string[]): number {
    for (const key of keys) {
      const value = item[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private isPharaohGender(value: string): value is 'male' | 'female' {
    return value === 'male' || value === 'female';
  }

  private getPharaohPool(gender?: 'male' | 'female'): PharaohProfile[] {
    const pool = gender
      ? this.pharaohs.filter((pharaoh) => pharaoh.gender === gender)
      : this.pharaohs;

    if (!pool.length) {
      throw new Error('Pharaoh profiles are not loaded.');
    }

    return pool;
  }

  private matchMediaPipeRatios(
    userRatios: MediaPipeRatioProfile,
    gender?: 'male' | 'female'
  ): PharaohMatch {
    const pool = this.getPharaohPool(gender);
    // faceAspectRatio excluded — varies with camera angle, not facial geometry
    const matchKeys: (keyof MediaPipeRatioProfile)[] = ['eyeXSpan', 'nosePositionY', 'earPositionY'];
    const stds = matchKeys.map((key) => this.getDimensionStd(pool, key));

    const scored = pool
      .map((pharaoh) => ({
        pharaoh,
        dist: Math.sqrt(
          matchKeys.reduce((acc, key, i) => {
            return acc + ((userRatios[key] - pharaoh.mpRatios[key]) / stds[i]) ** 2;
          }, 0)
        ),
      }))
      .sort((a, b) => a.dist - b.dist);

    const winner = scored[0];
    const maxDist = scored[scored.length - 1].dist;
    const spread = maxDist - winner.dist || 0.001;

    // clarity: how distinctly the winner stands out vs the worst candidate
    const clarity = Math.min(1, spread / Math.max(maxDist * 0.6, 0.4));
    // absoluteFitness: penalty when even the best match is far in normalized space (>3.5 std = very different)
    const absoluteFitness = Math.max(0, 1 - winner.dist / 3.5);
    const similarity = Math.round(40 + (0.5 * clarity + 0.5 * absoluteFitness) * 50);

    return {
      pharaoh: winner.pharaoh,
      similarity,
      confidence: scoreToConfidence(similarity),
    };
  }

  private getDimensionSpread(pool: PharaohProfile[], key: keyof MediaPipeRatioProfile): number {
    const values = pool.map((pharaoh) => pharaoh.mpRatios[key]);
    return Math.max(...values) - Math.min(...values) || 0.001;
  }

  private getDimensionStd(pool: PharaohProfile[], key: keyof MediaPipeRatioProfile): number {
    const values = pool.map((p) => p.mpRatios[key]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) || 0.001;
  }

  private toFeatureSimilarity(difference: number, spread: number): number {
    return distanceToSimilarity(difference, spread || 0.001);
  }

  private getFeatureLabel(key: PharaohSimilarityFeatureLabelKey): string {
    const uiLanguage = this.getCurrentLanguage().startsWith('ar') ? 'ar' : 'en';
    return getUIMessage(key, uiLanguage);
  }

  private getFeatureDisplayLabel(
    key: PharaohSimilarityFeatureLabelKey,
    detailText: string
  ): string {
    const uiLanguage = this.getCurrentLanguage().startsWith('ar') ? 'ar' : 'en';

    if (!detailText) {
      return this.getFeatureLabel(key);
    }

    if (uiLanguage === 'ar') {
      if (key === 'rightEye' || key === 'leftEye') {
        return `عين ${detailText}`;
      }

      if (key === 'nose') {
        return `أنف ${detailText}`;
      }

      return detailText.includes('شفايف') ? detailText : `شفايف ${detailText}`;
    }

    if (key === 'rightEye' || key === 'leftEye') {
      return `${detailText} Eyes`;
    }

    if (key === 'nose') {
      return `${detailText} Nose`;
    }

    return detailText;
  }

  private getFeatureDetailText(
    key: keyof MediaPipeRatioProfile,
    value: number,
    pool: PharaohProfile[]
  ): string {
    const uiLanguage = this.getCurrentLanguage().startsWith('ar') ? 'ar' : 'en';
    const values = pool
      .map((pharaoh) => pharaoh.mpRatios[key])
      .sort((first, second) => first - second);
    const lowerThreshold = values[Math.max(Math.floor((values.length - 1) * 0.33), 0)] ?? value;
    const upperThreshold = values[Math.max(Math.floor((values.length - 1) * 0.66), 0)] ?? value;

    if (key === 'eyeXSpan') {
      if (value <= lowerThreshold) return getUIMessage('narrowEyes', uiLanguage);
      if (value >= upperThreshold) return getUIMessage('wideSetEyes', uiLanguage);
      return getUIMessage('almondEyes', uiLanguage);
    }

    if (key === 'nosePositionY') {
      if (value <= lowerThreshold) return getUIMessage('buttonNose', uiLanguage);
      if (value >= upperThreshold) return getUIMessage('romanNose', uiLanguage);
      return getUIMessage('straightNose', uiLanguage);
    }

    if (key === 'earPositionY') {
      if (value <= lowerThreshold) return getUIMessage('deepSetEyes', uiLanguage);
      if (value >= upperThreshold) return getUIMessage('wideSetEyes', uiLanguage);
      return getUIMessage('almondEyes', uiLanguage);
    }

    if (key === 'faceAspectRatio') {
      if (value <= lowerThreshold) return getUIMessage('thinLips', uiLanguage);
      if (value >= upperThreshold) return getUIMessage('fullLips', uiLanguage);
      return getUIMessage('balancedLips', uiLanguage);
    }

    return getUIMessage('balancedFace', uiLanguage);
  }

  private getFeatureAnchors(
    detection: PharaohSimilarityDetection
  ): Record<PharaohSimilarityFeatureLabelKey, { x: number; y: number }> {
    if (
      detection.featureAnchors?.rightEye &&
      detection.featureAnchors.leftEye &&
      detection.featureAnchors.nose &&
      detection.featureAnchors.mouth
    ) {
      return {
        rightEye: detection.featureAnchors.rightEye,
        leftEye: detection.featureAnchors.leftEye,
        nose: detection.featureAnchors.nose,
        mouth: detection.featureAnchors.mouth,
      };
    }

    const points = detection.landmarks ?? [];
    const bounds = this.getFaceFrameBounds(detection) ?? {
      minX: 0.18,
      minY: 0.16,
      maxX: 0.82,
      maxY: 0.86,
    };
    const faceWidth = Math.max(bounds.maxX - bounds.minX, 0.01);
    const faceHeight = Math.max(bounds.maxY - bounds.minY, 0.01);
    const centerX = (bounds.minX + bounds.maxX) / 2;

    return {
      rightEye: this.resolveFeatureAnchor(
        points[MP_RIGHT_EYE],
        {
          x: bounds.minX + faceWidth * 0.34,
          y: bounds.minY + faceHeight * 0.38,
        },
        -faceHeight * 0.012
      ),
      leftEye: this.resolveFeatureAnchor(
        points[MP_LEFT_EYE],
        {
          x: bounds.minX + faceWidth * 0.66,
          y: bounds.minY + faceHeight * 0.38,
        },
        -faceHeight * 0.012
      ),
      nose: this.resolveFeatureAnchor(
        points[MP_NOSE_TIP],
        {
          x: centerX,
          y: bounds.minY + faceHeight * 0.56,
        },
        -faceHeight * 0.01
      ),
      mouth: this.resolveFeatureAnchor(
        points[MP_MOUTH],
        {
          x: centerX,
          y: bounds.minY + faceHeight * 0.76,
        },
        -faceHeight * 0.03
      ),
    };
  }

  private resolveFeatureAnchor(
    point: { x: number; y: number } | undefined,
    fallback: { x: number; y: number },
    verticalAdjustment: number
  ): { x: number; y: number } {
    return {
      x: this.clamp(point?.x ?? fallback.x, 0, 1),
      y: this.clamp((point?.y ?? fallback.y) + verticalAdjustment, 0, 1),
    };
  }

  private drawKeypointMarker(
    context: CanvasRenderingContext2D,
    pointerIcon: HTMLImageElement | null,
    x: number,
    y: number,
    title: string,
    detail: string,
    size: number,
    scale: number,
    textScaleBoost: number,
    verticalOffset: number,
    preferredSide: 'left' | 'right' | 'bottom',
    lineLengthMultiplier: number = 1
  ): void {
    const anchorX = Math.round(x);
    const anchorY = Math.round(y);

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    if (pointerIcon) {
      context.drawImage(pointerIcon, anchorX - size / 2, anchorY - size / 2, size, size);
    }

    const labelLines = this.buildMarkerLines(title, detail);
    const labelMetrics = this.getMarkerLabelMetrics(
      labelLines,
      scale,
      textScaleBoost,
      verticalOffset
    );
    const safeMinX = context.canvas.width * 0.22;
    const safeMaxX = context.canvas.width * 0.78;
    const edgePadding = Math.max(10 * scale, 16);

    context.font = `400 ${labelMetrics.titleFontSize}px Inter, Arial, sans-serif`;
    context.fillStyle = '#D4AF37';
    context.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    context.lineWidth = Math.max(1.2, labelMetrics.titleFontSize * 0.1);
    context.lineJoin = 'round';
    context.textBaseline = 'middle';

    let connectorStartX = anchorX;
    let connectorStartY = anchorY - size * 0.1;
    let elbowX = anchorX;
    let elbowY = anchorY - size * 0.42 + labelMetrics.labelOffset;
    let connectorEndX = anchorX;
    let connectorEndY = elbowY;
    let labelX = anchorX;
    let labelY = elbowY;

    if (preferredSide === 'bottom') {
      const bottomOffset = Math.max(
        14 * scale,
        size * (labelMetrics.hasDetailLine ? 0.98 : 0.72) * lineLengthMultiplier +
          Math.max(0, verticalOffset * 0.06 * scale)
      );
      const horizontalKick =
        size * (labelMetrics.hasDetailLine ? 0.86 : 0.66) * lineLengthMultiplier;
      connectorStartY = anchorY + size * 0.12;
      elbowX = anchorX + horizontalKick;
      elbowY = connectorStartY;
      connectorEndX = this.clamp(
        elbowX,
        safeMinX + labelMetrics.maxLabelWidth / 2,
        safeMaxX - labelMetrics.maxLabelWidth / 2
      );
      connectorEndY = anchorY + bottomOffset;
      labelY = connectorEndY;
      labelX = connectorEndX;
      context.textAlign = 'center';
    } else {
      const direction = preferredSide === 'left' ? -1 : 1;
      const horizontalLength =
        size * (labelMetrics.hasDetailLine ? 1.24 : 0.98) * lineLengthMultiplier;
      elbowX = anchorX + direction * size * 0.28 * lineLengthMultiplier;
      elbowY = anchorY - size * 0.42 + labelMetrics.labelOffset;
      connectorEndX = anchorX + direction * horizontalLength;
      connectorEndY = elbowY;
      labelX = connectorEndX;
      labelY = connectorEndY;
      context.textAlign = preferredSide === 'left' ? 'right' : 'left';

      if (preferredSide === 'left') {
        labelX = this.clamp(
          labelX,
          edgePadding + labelMetrics.maxLabelWidth,
          context.canvas.width - edgePadding
        );
        connectorEndX = labelX;
      } else {
        labelX = this.clamp(
          labelX,
          edgePadding,
          context.canvas.width - edgePadding - labelMetrics.maxLabelWidth
        );
        connectorEndX = labelX;
      }
    }

    context.beginPath();
    context.moveTo(connectorStartX, connectorStartY);
    context.lineTo(elbowX, elbowY);
    context.lineTo(connectorEndX, connectorEndY);
    context.strokeStyle = '#D4AF37';
    context.lineWidth = 1.8 * scale;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();

    const firstLineY = labelY - ((labelLines.length - 1) * labelMetrics.lineHeight) / 2;
    labelLines.forEach((line, index) => {
      const lineY = Math.round(firstLineY + index * labelMetrics.lineHeight);
      const currentFontSize =
        index === 0 ? labelMetrics.titleFontSize : labelMetrics.detailFontSize;
      const currentFontWeight = 300;
      context.font = `${currentFontWeight} ${currentFontSize}px Inter, Arial, sans-serif`;
      context.lineWidth = Math.max(1, currentFontSize * 0.1);
      context.strokeText(line, labelX, lineY, labelMetrics.maxLabelWidth);
      context.fillText(line, labelX, lineY, labelMetrics.maxLabelWidth);
    });

    context.restore();
  }

  private getMarkerLabelMetrics(
    labelLines: string[],
    scale: number,
    textScaleBoost: number,
    verticalOffset: number
  ): {
    hasDetailLine: boolean;
    titleFontSize: number;
    detailFontSize: number;
    labelOffset: number;
    maxLabelWidth: number;
    lineHeight: number;
  } {
    const hasDetailLine = labelLines.length > 1;
    const titleFontSize = Math.max(18, Math.round(14.5 * scale * textScaleBoost));
    const detailFontSize = hasDetailLine
      ? Math.max(14, Math.round(11.75 * scale * textScaleBoost))
      : titleFontSize;

    return {
      hasDetailLine,
      titleFontSize,
      detailFontSize,
      labelOffset: Math.max(-14 * scale, Math.min(14 * scale, verticalOffset * 0.12 * scale)),
      maxLabelWidth: Math.max(124, 158 * scale),
      lineHeight: hasDetailLine
        ? Math.max(titleFontSize + 7, detailFontSize + 9)
        : Math.max(titleFontSize + 4, 16 * scale),
    };
  }

  private drawLegacyKeypointMarker(
    context: CanvasRenderingContext2D,
    pointerIcon: HTMLImageElement | null,
    x: number,
    y: number,
    title: string,
    detail: string,
    size: number,
    scale: number,
    verticalOffset: number,
    preferredSide: 'left' | 'right' | 'bottom'
  ): void {
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    if (pointerIcon) {
      context.drawImage(pointerIcon, x - size / 2, y - size / 2, size, size);
    }

    const fontSize = Math.round(9 * scale);
    const shadowBlur = 6 * scale;
    const labelOffset = Math.max(-10 * scale, Math.min(10 * scale, verticalOffset * 0.12 * scale));
    const maxLabelWidth = 92 * scale;
    const lineHeight = 11 * scale;

    context.font = `400 ${fontSize}px Inter, sans-serif`;
    context.shadowColor = 'rgba(0, 0, 0, 0.85)';
    context.shadowBlur = shadowBlur;
    context.fillStyle = '#D4AF37';
    context.textBaseline = 'middle';

    const labelLines = this.buildMarkerLines(title, detail);

    let connectorStartX = x;
    let connectorStartY = y - size * 0.1;
    let elbowX = x;
    let elbowY = y - size * 0.42 + labelOffset;
    let connectorEndX = x;
    let connectorEndY = elbowY;
    let labelX = x;
    let labelY = elbowY;

    if (preferredSide === 'bottom') {
      const bottomOffset = Math.max(
        10 * scale,
        size * 0.55 + Math.max(0, verticalOffset * 0.08 * scale)
      );
      const horizontalKick = size * 0.9;
      connectorStartY = y + size * 0.12;
      elbowX = x + horizontalKick;
      elbowY = connectorStartY;
      connectorEndX = elbowX;
      connectorEndY = y + bottomOffset;
      labelY = connectorEndY + lineHeight;
      labelX = connectorEndX;
      context.textAlign = 'center';
    } else {
      const direction = preferredSide === 'left' ? -1 : 1;
      const horizontalLength = size * 1;
      connectorEndX = x + direction * horizontalLength;
      labelX = connectorEndX + direction * 8 * scale;
      labelY = elbowY;
      context.textAlign = preferredSide === 'left' ? 'right' : 'left';
    }

    context.beginPath();
    context.moveTo(connectorStartX, connectorStartY);
    context.lineTo(elbowX, elbowY);
    context.lineTo(connectorEndX, connectorEndY);
    context.strokeStyle = '#D4AF37';
    context.lineWidth = 1.5 * scale;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();

    const firstLineY = labelY - ((labelLines.length - 1) * lineHeight) / 2;
    labelLines.forEach((line, index) => {
      context.fillText(line, labelX, firstLineY + index * lineHeight, maxLabelWidth);
    });

    context.shadowBlur = 0;
    context.restore();
  }

  private getOverlayMarkerScale(canvasWidth: number, scaleBoost: number = 1): number {
    const baseCanvasWidth = 288;
    const rawScale = (canvasWidth / baseCanvasWidth) * scaleBoost;
    const maxScale = 2.1 * scaleBoost;
    const minScale = scaleBoost > 0 ? Math.min(1, scaleBoost) : 0.35;

    return Math.max(minScale, Math.min(rawScale, maxScale));
  }

  private getLegacyOverlayMarkerScale(canvasWidth: number, scaleBoost: number = 1): number {
    const baseCanvasWidth = 288;
    const rawScale = (canvasWidth / baseCanvasWidth) * scaleBoost;
    const maxScale = 2.1 * scaleBoost;

    return Math.max(1, Math.min(rawScale, maxScale));
  }

  private getLiveOverlayScaleBoost(useElementSizedCanvas: boolean): number {
    if (!useElementSizedCanvas) {
      return 1;
    }

    if (typeof window !== 'undefined' && window.innerWidth < 340) {
      return 1;
    }

    return 1.8;
  }

  private async detectPreciseFeatureAnchors(
    image: HTMLImageElement,
    detection: PharaohSimilarityDetection
  ): Promise<Partial<Record<PharaohSimilarityFeatureLabelKey, { x: number; y: number }>> | null> {
    const detector = await this.ensureFaceMeshDetector();
    if (!detector) {
      return null;
    }

    try {
      const faces = await detector.estimateFaces(image, { flipHorizontal: false });
      const keypoints = faces?.[0]?.keypoints;
      if (!keypoints?.length) {
        return null;
      }

      const imageWidth = image.naturalWidth || image.width || 1;
      const imageHeight = image.naturalHeight || image.height || 1;
      const rightEyePoint = this.getMeshFeaturePoint(keypoints, [468, 469, 470, 471, 472], [33]);
      const leftEyePoint = this.getMeshFeaturePoint(keypoints, [473, 474, 475, 476, 477], [263]);
      const nosePoint = this.getMeshFeaturePoint(keypoints, [1, 4], [1]);
      const mouthPoint = this.getMeshFeaturePoint(keypoints, [13, 14], [13]);

      return {
        rightEye: this.normalizeMeshPoint(rightEyePoint, imageWidth, imageHeight),
        leftEye: this.normalizeMeshPoint(leftEyePoint, imageWidth, imageHeight),
        nose: this.normalizeMeshPoint(nosePoint, imageWidth, imageHeight),
        mouth: this.normalizeMeshPoint(mouthPoint, imageWidth, imageHeight),
      };
    } catch {
      return detection.featureAnchors ?? null;
    }
  }

  private async ensureFaceMeshDetector(): Promise<any | null> {
    if (this.faceMeshDetector) {
      return this.faceMeshDetector;
    }

    if (!this.faceMeshDetectorPromise) {
      this.faceMeshDetectorPromise = (async () => {
        const faceLandmarksDetection = await import('@tensorflow-models/face-landmarks-detection');

        const detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
            refineLandmarks: true,
            maxFaces: 1,
          } as any
        );

        this.faceMeshDetector = detector;
        return detector;
      })().catch(() => null);
    }

    return this.faceMeshDetectorPromise;
  }

  private averageMeshPoints(
    keypoints: Array<{ x: number; y: number }>,
    indices: number[]
  ): { x: number; y: number } {
    const validPoints = indices
      .map((index) => keypoints[index])
      .filter((point): point is { x: number; y: number } => !!point);

    if (!validPoints.length) {
      return { x: 0, y: 0 };
    }

    const totals = validPoints.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x,
        y: accumulator.y + point.y,
      }),
      { x: 0, y: 0 }
    );

    return {
      x: totals.x / validPoints.length,
      y: totals.y / validPoints.length,
    };
  }

  private getMeshFeaturePoint(
    keypoints: Array<{ x: number; y: number }>,
    preferredIndices: number[],
    fallbackIndices: number[]
  ): { x: number; y: number } {
    const preferredPoint = this.averageMeshPoints(keypoints, preferredIndices);

    if (preferredPoint.x || preferredPoint.y) {
      return preferredPoint;
    }

    return this.averageMeshPoints(keypoints, fallbackIndices);
  }

  private normalizeMeshPoint(
    point: { x: number; y: number },
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number } {
    const normalizedX = Math.abs(point.x) <= 1.5 ? point.x : point.x / Math.max(imageWidth, 1);
    const normalizedY = Math.abs(point.y) <= 1.5 ? point.y : point.y / Math.max(imageHeight, 1);

    return {
      x: this.clamp(normalizedX, 0, 1),
      y: this.clamp(normalizedY, 0, 1),
    };
  }

  private buildMarkerLines(title: string, detail: string): string[] {
    return detail ? [title, detail] : [title];
  }

  private createFaceCropCanvas(
    image: HTMLImageElement | HTMLCanvasElement,
    boundingBox: { xCenter: number; yCenter: number; width: number; height: number },
    paddingRatio: number
  ): HTMLCanvasElement {
    const { width: sourceWidth, height: sourceHeight } = this.getImageSourceDimensions(image);
    const faceWidth = boundingBox.width * sourceWidth;
    const faceHeight = boundingBox.height * sourceHeight;
    const cropSize = Math.min(
      Math.max(faceWidth, faceHeight) * (1 + paddingRatio * 2),
      Math.min(sourceWidth, sourceHeight)
    );
    const cropX = this.clamp(
      boundingBox.xCenter * sourceWidth - cropSize / 2,
      0,
      sourceWidth - cropSize
    );
    const cropY = this.clamp(
      boundingBox.yCenter * sourceHeight - cropSize * 0.45,
      0,
      sourceHeight - cropSize
    );

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;

    const context = canvas.getContext('2d');
    if (!context) {
      return canvas;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  private createAnalysisSource(
    image: HTMLImageElement | HTMLCanvasElement,
    maxLongEdge: number
  ): HTMLImageElement | HTMLCanvasElement {
    const { width: sourceWidth, height: sourceHeight } = this.getImageSourceDimensions(image);
    const safeMaxLongEdge = Math.max(Math.round(maxLongEdge || 0), 1);
    const sourceLongEdge = Math.max(sourceWidth, sourceHeight);

    if (sourceLongEdge <= safeMaxLongEdge) {
      return image;
    }

    const scale = safeMaxLongEdge / sourceLongEdge;
    const targetWidth = Math.max(Math.round(sourceWidth * scale), 1);
    const targetHeight = Math.max(Math.round(sourceHeight * scale), 1);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return image;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas;
  }

  private createVideoAnalysisSource(
    video: HTMLVideoElement,
    maxLongEdge: number
  ): HTMLVideoElement | HTMLCanvasElement {
    const sourceWidth = video.videoWidth || 1;
    const sourceHeight = video.videoHeight || 1;
    const safeMaxLongEdge = Math.max(Math.round(maxLongEdge || 0), 1);
    const sourceLongEdge = Math.max(sourceWidth, sourceHeight);

    if (sourceLongEdge <= safeMaxLongEdge) {
      return video;
    }

    const scale = safeMaxLongEdge / sourceLongEdge;
    const targetWidth = Math.max(Math.round(sourceWidth * scale), 1);
    const targetHeight = Math.max(Math.round(sourceHeight * scale), 1);
    const canvas = this.liveAnalysisCanvas ?? document.createElement('canvas');

    if (canvas.width !== targetWidth) {
      canvas.width = targetWidth;
    }

    if (canvas.height !== targetHeight) {
      canvas.height = targetHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return video;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    this.liveAnalysisCanvas = canvas;

    return canvas;
  }

  private async resolveImageSource(
    source: string | HTMLCanvasElement | HTMLImageElement
  ): Promise<HTMLCanvasElement | HTMLImageElement> {
    if (typeof source === 'string') {
      return this.loadImage(source);
    }

    return source;
  }

  private getImageSourceDimensions(image: HTMLImageElement | HTMLCanvasElement): {
    width: number;
    height: number;
  } {
    if (image instanceof HTMLCanvasElement) {
      return {
        width: image.width || 1,
        height: image.height || 1,
      };
    }

    return {
      width: image.naturalWidth || image.width || 1,
      height: image.naturalHeight || image.height || 1,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private getCoverMetrics(
    canvasWidth: number,
    canvasHeight: number,
    sourceWidth: number,
    sourceHeight: number
  ): { drawWidth: number; drawHeight: number; offsetX: number; offsetY: number } {
    const safeSourceWidth = Math.max(sourceWidth || 0, 1);
    const safeSourceHeight = Math.max(sourceHeight || 0, 1);
    const scale = Math.max(canvasWidth / safeSourceWidth, canvasHeight / safeSourceHeight);

    return {
      drawWidth: safeSourceWidth * scale,
      drawHeight: safeSourceHeight * scale,
      offsetX: (canvasWidth - safeSourceWidth * scale) / 2,
      offsetY: (canvasHeight - safeSourceHeight * scale) / 2,
    };
  }

  private resizeLiveOverlayCanvas(canvas: HTMLCanvasElement, useElementSizedCanvas: boolean): void {
    if (!useElementSizedCanvas) {
      this.resizeOverlayCanvas(canvas);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(Math.round(rect.width * devicePixelRatio), 1);
    const height = Math.max(Math.round(rect.height * devicePixelRatio), 1);

    if (canvas.width !== width) {
      canvas.width = width;
    }

    if (canvas.height !== height) {
      canvas.height = height;
    }
  }

  private getCameraPointerIcon(): HTMLImageElement | null {
    if (this.cameraPointerIcon) {
      return this.cameraPointerIcon;
    }

    this.cameraPointerIconPromise =
      this.cameraPointerIconPromise ?? this.createCameraPointerIconPromise();

    return null;
  }

  private async ensureCameraPointerIcon(): Promise<HTMLImageElement | null> {
    if (this.cameraPointerIcon) {
      return this.cameraPointerIcon;
    }

    this.cameraPointerIconPromise =
      this.cameraPointerIconPromise ?? this.createCameraPointerIconPromise();

    return this.cameraPointerIconPromise;
  }

  private createCameraPointerIconPromise(): Promise<HTMLImageElement | null> {
    return this.loadCameraPointerIcon().then((image) => {
      this.cameraPointerIcon = image;
      return image;
    });
  }

  private async loadCameraPointerIcon(): Promise<HTMLImageElement | null> {
    const symbol = document.getElementById('camera-pointer');
    if (!(symbol instanceof SVGSymbolElement)) {
      return null;
    }

    const viewBox = symbol.getAttribute('viewBox') ?? '0 0 32 32';
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${symbol.innerHTML}</svg>`;
    const image = new Image();

    return new Promise<HTMLImageElement | null>((resolve) => {
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load the captured image.'));
      image.src = src;
    });
  }
}
