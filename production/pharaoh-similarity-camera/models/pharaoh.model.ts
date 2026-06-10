// ─── Facial ratio profile ──────────────────────────────────────────────────
// Each value is a ratio of one facial measurement to another,
// derived from depictions in sculptures, masks, and archaeological evidence.
export interface FacialRatioProfile {
  eyeSpanToFace: number;
  noseWidthToFace: number;
  mouthWidthToFace: number;
  jawToFace: number;
  noseLengthNorm: number;
  mouthChinNorm: number;
}

// ─── MediaPipe-specific profile (only 6 keypoints + bounding box) ─────────
// Same-axis ratios are immune to image aspect ratio.
// faceAspectRatio uses pixel dimensions so it is also aspect-ratio corrected.
export interface MediaPipeRatioProfile {
  eyeXSpan: number;
  nosePositionY: number;
  earPositionY: number;
  faceAspectRatio: number;
}

// ─── Pharaoh definition ───────────────────────────────────────────────────
export interface PharaohProfile {
  ids: string;
  name: string;
  title: string;
  description: string;
  gender: 'male' | 'female';
  ratios: FacialRatioProfile;
  mpRatios: MediaPipeRatioProfile;
  imageUrl?: string;
}

// ─── Match result returned by each solver ─────────────────────────────────
export interface PharaohMatch {
  pharaoh: PharaohProfile;
  similarity: number;
  confidence: 'Low' | 'Medium' | 'High';
  features?: string[];
  rawText?: string;
}

export type PharaohSimilarityCameraFailureCopyKey = 'camera' | 'package' | 'detection' | 'default';

export type PharaohSimilarityCameraFailureActionType = 'retry' | 'navigate';

export interface PharaohSimilarityCameraFailureAction {
  type: PharaohSimilarityCameraFailureActionType;
  url?: string;
}

export interface PharaohSimilarityCameraFailureCopy {
  title?: string;
  buttonText?: string;
  action?: PharaohSimilarityCameraFailureAction;
}

export interface PharaohSimilarityCameraLocalizedCopy {
  en?: string;
  ar?: string;
}

export type PharaohSimilarityCameraCopyValue = string | PharaohSimilarityCameraLocalizedCopy;

/**
 * Consumer-provided copy overrides for the camera experience.
 */
export interface PharaohSimilarityCameraCopyConfig {
  noDetectedFaceMessage?: PharaohSimilarityCameraCopyValue;
  processingLabel?: PharaohSimilarityCameraCopyValue;
  cameraPreviewLabel?: PharaohSimilarityCameraCopyValue;
  capturedImageAlt?: PharaohSimilarityCameraCopyValue;
  matchingProgressLabel?: PharaohSimilarityCameraCopyValue;
  captureImageLabel?: PharaohSimilarityCameraCopyValue;
  uploadImageLabel?: PharaohSimilarityCameraCopyValue;
  errorIconAlt?: PharaohSimilarityCameraCopyValue;
  openSettingsLabel?: PharaohSimilarityCameraCopyValue;
  matchedResultPrefix?: PharaohSimilarityCameraCopyValue;
  matchedActionPrefix?: PharaohSimilarityCameraCopyValue;
  matchedActionFallback?: PharaohSimilarityCameraCopyValue;
  failure?: Partial<
    Record<PharaohSimilarityCameraFailureCopyKey, PharaohSimilarityCameraFailureCopy>
  >;
}

/**
 * Asset overrides that allow host experiences to swap frames and backgrounds without forking the component.
 */
export interface PharaohSimilarityCameraAssetsConfig {
  backgroundImageUrl?: string;
  backgroundLottieUrl?: string;
  idleFrameUrl?: string;
  activeFrameUrl?: string;
  rectangleFrameUrl?: string;
  faceFrameOverlayUrl?: string;
}

/**
 * Optional CSS class hooks for styling the rendered component from the outside.
 */
export interface PharaohSimilarityCameraCustomClasses {
  screen?: string;
  viewer?: string;
  actions?: string;
  captureButton?: string;
  uploadButton?: string;
  errorOverlay?: string;
  progressPanel?: string;
}

/**
 * Fully resolved asset set used internally after applying consumer overrides and defaults.
 */
export interface ResolvedPharaohSimilarityCameraAssets {
  backgroundImageUrl: string;
  backgroundLottieUrl: string;
  idleFrameUrl: string;
  activeFrameUrl: string;
  rectangleFrameUrl: string;
  faceFrameOverlayUrl: string;
  errorIconUrl: string;
}

/**
 * Public configuration contract for consumers of the standalone camera component.
 */
export interface PharaohSimilarityCameraConfig {
  assets?: PharaohSimilarityCameraAssetsConfig;
  copy?: PharaohSimilarityCameraCopyConfig;
}

export type PharaohSimilarityCameraPermissionState = PermissionState | 'unavailable';

export interface FaceFrameBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type PharaohSimilarityFeatureLabelKey = 'rightEye' | 'leftEye' | 'nose' | 'mouth';

export interface PharaohSimilarityGender {
  value: 'male' | 'female';
  probability: number;
}

export interface PharaohSimilarityDetection {
  landmarks?: Array<{ x: number; y: number }>;
  boundingBox?: { xCenter: number; yCenter: number; width: number; height: number } | null;
  featureAnchors?: Partial<Record<PharaohSimilarityFeatureLabelKey, { x: number; y: number }>>;
}

export interface PharaohSimilarityFeatureWinner {
  featureId: PharaohSimilarityFeatureLabelKey;
  key: keyof MediaPipeRatioProfile;
  label: string;
  icon: string;
  winner: PharaohProfile;
  anchor: { x: number; y: number };
  similarity: number;
  detailText: string;
  preferredSide: 'left' | 'right' | 'bottom';
  verticalOffset: number;
}

export interface PharaohSimilarityAnalysis {
  detection: PharaohSimilarityDetection;
  sourceSize: {
    width: number;
    height: number;
  };
  detectedRatios: MediaPipeRatioProfile;
  detectedGender: PharaohSimilarityGender | null;
  featureWinners: PharaohSimilarityFeatureWinner[];
  match: PharaohMatch;
}

export interface PharaohSimilarityFailureCopyEntry {
  title: string;
  buttonText: string;
  action: PharaohSimilarityCameraFailureAction;
}

export interface PharaohSimilarityOpenCameraResult {
  opened: boolean;
  permissionState: PharaohSimilarityCameraPermissionState;
}

export interface PharaohSimilarityLiveAnalysisOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  shouldAnalyze: () => boolean;
  isMirrored: () => boolean;
  useFaceMeshOverlay?: () => boolean;
  faceFrameOverlayUrl?: () => string | undefined;
  useElementSizedCanvas?: boolean;
  analysisIntervalMs?: number;
  analysisMaxLongEdge?: number;
  onAvailabilityChange: (available: boolean) => void;
  onOverlayClear: () => void;
}

export interface PharaohSimilarityFinalizeAnalysisOptions {
  requireConfirmedFace?: boolean;
  analysisMaxLongEdge?: number;
}

export interface PharaohApiFlatItem extends Partial<
  Record<string, string | number | null | undefined>
> {}

export function mpRatioDistance(a: MediaPipeRatioProfile, b: MediaPipeRatioProfile): number {
  const keys = Object.keys(a) as (keyof MediaPipeRatioProfile)[];
  return Math.sqrt(keys.reduce((acc, key) => acc + (a[key] - b[key]) ** 2, 0));
}

export function distanceToSimilarity(dist: number, maxDist = 0.4): number {
  return Math.round(Math.max(0, Math.min(100, (1 - dist / maxDist) * 100)));
}

export function scoreToConfidence(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}
