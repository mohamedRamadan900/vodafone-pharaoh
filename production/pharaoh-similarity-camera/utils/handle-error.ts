export interface PharaohSimilarityFailureStateHandlers<TFailureContext extends string> {
  stopLiveAnalysisLoop: () => void;
  setFailureContext: (context: TFailureContext | null) => void;
  setErrorMessage: (message: string) => void;
  setErrorState: () => void;
}

export function resolvePharaohSimilarityErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function applyPharaohSimilarityFailure<TFailureContext extends string>(
  handlers: PharaohSimilarityFailureStateHandlers<TFailureContext>,
  context: TFailureContext,
  message: string
): void {
  handlers.stopLiveAnalysisLoop();
  handlers.setFailureContext(context);
  handlers.setErrorMessage(message);
  handlers.setErrorState();
}
