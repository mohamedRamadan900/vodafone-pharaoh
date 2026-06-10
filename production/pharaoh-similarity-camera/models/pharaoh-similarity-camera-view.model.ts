import { PharaohProfile, PharaohSimilarityAnalysis } from './pharaoh.model';

/**
 * High-level UI states for the pharaoh similarity camera experience.
 */
export type ExperienceState = 'loading' | 'ready' | 'processing' | 'error';

/**
 * Failure categories used to resolve error copy and retry behavior.
 */
export type FailureContext = 'camera' | 'package' | 'detection' | null;

/**
 * Event payload emitted when the component enters a failure state.
 */
export interface PharaohSimilarityFailureOutput {
  context: NonNullable<FailureContext>;
  message: string;
  error?: unknown;
}

/**
 * Event payload emitted for either a successful match or a failed comparison attempt.
 */
export type PharaohSimilarityMatchOutcomeOutput =
  | {
      status: 'success';
      result: PharaohSimilarityResultOutput;
    }
  | {
      status: 'failure';
      failure: PharaohSimilarityFailureOutput;
    };

/**
 * Event payload emitted when a similarity match has been produced.
 */
export interface PharaohSimilarityResultOutput extends PharaohSimilarityAnalysis {
  capturedImageUrl: string;
  capturedImageBase64: string;
  matchedPharaoh: PharaohProfile;
}
