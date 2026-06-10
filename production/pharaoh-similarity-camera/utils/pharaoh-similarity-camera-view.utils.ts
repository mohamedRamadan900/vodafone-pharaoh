import {
  ExperienceState,
  FailureContext,
  PharaohSimilarityResultOutput,
} from '../models/pharaoh-similarity-camera-view.model';
import { PharaohProfile, PharaohSimilarityAnalysis } from '../models/pharaoh.model';

/**
 * Returns true when the component already has a captured image and a matched pharaoh.
 */
export function hasSimilarityResult(
  capturedImageUrl: string | null,
  matchedPharaoh: PharaohProfile | null,
  failureContext: FailureContext
): boolean {
  return !!capturedImageUrl && !!matchedPharaoh && failureContext === null;
}

/**
 * The no-face helper text is only shown when the camera is ready and there is no active analysis result.
 */
export function shouldShowNoFaceMessage(
  state: ExperienceState,
  capturedImageUrl: string | null,
  liveAnalysisAvailable: boolean,
  failureContext: FailureContext
): boolean {
  return (
    state === 'ready' && !capturedImageUrl && !liveAnalysisAvailable && failureContext === null
  );
}

/**
 * The processing title is visible only while progress is still below 100%.
 */
export function shouldShowProcessingTitle(
  state: ExperienceState,
  processingProgress: number
): boolean {
  return state === 'processing' && processingProgress < 100;
}

/**
 * The progress summary stays visible while processing and after a successful ready state.
 */
export function shouldShowProgressPanel(state: ExperienceState, hasResult: boolean): boolean {
  return state === 'processing' || (state === 'ready' && hasResult);
}

/**
 * Displays 100% after a successful result without mutating the actual progress signal.
 */
export function getDisplayedProcessingProgress(
  state: ExperienceState,
  processingProgress: number,
  hasResult: boolean
): number {
  return state === 'ready' && hasResult ? 100 : processingProgress;
}

/**
 * Action buttons remain mounted during loading and processing so overlays can appear above them.
 */
export function shouldShowActionButtons(
  state: ExperienceState,
  capturedImageUrl: string | null,
  failureContext: FailureContext
): boolean {
  return (
    (((state === 'ready' && !capturedImageUrl) || state === 'processing' || state === 'loading') &&
      failureContext === null) ||
    state === 'error'
  );
}

/**
 * Shared disabled visual state for loading and processing.
 */
export function shouldDimActionButtons(state: ExperienceState): boolean {
  return state === 'processing' || state === 'loading';
}

/**
 * The matched result call-to-action is shown only after a successful match.
 */
export function shouldShowMatchedResultAction(state: ExperienceState, hasResult: boolean): boolean {
  return state === 'ready' && hasResult;
}

/**
 * Chooses the active frame when the camera is analyzing or already has a captured image.
 */
export function shouldUseActiveFrame(
  state: ExperienceState,
  capturedImageUrl: string | null,
  liveAnalysisAvailable: boolean
): boolean {
  return state === 'processing' || !!capturedImageUrl || liveAnalysisAvailable;
}

/**
 * Builds the emitted similarity payload without binding the component to payload-shaping details.
 */
export function createSimilarityResultOutput(
  analysis: PharaohSimilarityAnalysis,
  imageDataUrl: string,
  capturedImageBase64: string
): PharaohSimilarityResultOutput {
  return {
    ...analysis,
    capturedImageUrl: imageDataUrl,
    capturedImageBase64,
    matchedPharaoh: analysis.match.pharaoh,
  };
}
