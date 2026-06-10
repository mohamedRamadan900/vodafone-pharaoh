import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PharaohSimilarityCameraService } from './services/pharaoh-similarity-camera.service';
import {
  ACTIVE_CAMERA_FRAME_URL,
  CAMERA_FRAME_URL,
  CAMERA_PERMISSION_SETTINGS_URL,
  DEFAULT_NO_DETECTED_FACE_MESSAGE,
  ERROR_URL,
  getUIMessage,
} from './defines/constants';
import {
  PharaohApiFlatItem,
  PharaohSimilarityAnalysis,
  PharaohSimilarityCameraConfig as PharaohSimilarityCameraComponentConfig,
  PharaohSimilarityCameraCopyConfig,
  PharaohSimilarityCameraCopyValue,
  PharaohSimilarityCameraCustomClasses,
  PharaohSimilarityCameraFailureAction,
  PharaohSimilarityCameraPermissionState,
  PharaohProfile,
  PharaohSimilarityFeatureWinner,
} from './models/pharaoh.model';
import {
  ExperienceState,
  FailureContext,
  PharaohSimilarityFailureOutput,
  PharaohSimilarityMatchOutcomeOutput,
  PharaohSimilarityResultOutput,
} from './models/pharaoh-similarity-camera-view.model';
import { applyPharaohSimilarityFailure } from './utils/handle-error';
import {
  compressCanvasDataUrl,
  compressImageDataUrl,
  extractBase64FromDataUrl,
  resolvePharaohSimilarityAssets,
} from './utils/camera-utils';
import {
  hasExplicitCopyOverride,
  mergeFailureCopyMaps,
  resolveConfiguredAssetValue,
} from './utils/pharaoh-similarity-camera-component.utils';
import {
  createSimilarityResultOutput,
  getDisplayedProcessingProgress,
  hasSimilarityResult,
  shouldDimActionButtons,
  shouldShowActionButtons,
  shouldShowMatchedResultAction,
  shouldShowNoFaceMessage,
  shouldShowProcessingTitle,
  shouldShowProgressPanel,
  shouldUseActiveFrame,
} from './utils/pharaoh-similarity-camera-view.utils';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pharaoh-similarity-camera',
  standalone: true,
  templateUrl: './pharaoh-similarity-camera.component.html',
  styleUrls: ['./pharaoh-similarity-camera.component.scss'],
  imports: [CommonModule],
})
/**
 * Standalone camera flow that captures or uploads an image, compares it to pharaoh profiles,
 * and emits a result payload for host experiences.
 */
export class PharaohSimilarityCameraComponent implements OnInit, OnDestroy {
  private static readonly LIVE_ANALYSIS_MISS_TOLERANCE = 3;

  // ─── Injections ────────────────────────────────────────────────────────────────
  private readonly pharaohSimilarityService = inject(PharaohSimilarityCameraService);
  private readonly translateService = inject(TranslateService);

  // ─── Inputs ────────────────────────────────────────────────────────────────
  config = input<PharaohSimilarityCameraComponentConfig>();
  copy = input<PharaohSimilarityCameraCopyConfig>();
  backgroundImageUrl = input<string>();
  rectangleFrameUrl = input<string>();
  faceFrameOverlayUrl = input<string>();
  rawPharaohs = input<PharaohApiFlatItem[] | null>();
  noDetectedFaceMessage = input<string>(DEFAULT_NO_DETECTED_FACE_MESSAGE);
  matchedResultPrefix = input<PharaohSimilarityCameraCopyValue>();
  matchedActionPrefix = input<PharaohSimilarityCameraCopyValue>();
  rectangleFrame = input<boolean>(false);
  useFaceMeshOverlay = input<boolean>(false);
  disableMatchedAction = input<boolean>(false);
  showCaptureCameraIcon = input<boolean>(false);
  isGenerationLoading = input<boolean>(false);
  customClasses = input<PharaohSimilarityCameraCustomClasses | undefined>();

  private readonly syncRawPharaohsEffect = effect(() => {
    this.pharaohSimilarityService.setPreloadedPharaohs(this.rawPharaohs());
  });
  /** Optional custom error icon URL; falls back to default if not provided */
  errorIconUrl = input<string>();

  // ─── DOM References ────────────────────────────────────────────────────────
  videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');
  overlayRef = viewChild<ElementRef<HTMLCanvasElement>>('overlayEl');
  fullFrameOverlayRef = viewChild<ElementRef<HTMLCanvasElement>>('fullFrameOverlayEl');
  // resultOverlayRef = viewChild<ElementRef<HTMLCanvasElement>>('resultOverlayEl');
  // fullFrameResultOverlayRef = viewChild<ElementRef<HTMLCanvasElement>>('fullFrameResultOverlayEl');

  // ─── Outputs (Events) ──────────────────────────────────────────────────────
  /**
   * Fires automatically after a successful similarity analysis completes.
   * Consumers can use this to read the matched pharaoh, user image URL/base64,
   * and the full comparison payload without waiting for the CTA click.
   */
  similarityDetected = output<PharaohSimilarityResultOutput>();

  /**
   * Fires after a match attempt with either a success payload or a failure payload.
   * Consumers can listen to this single event to handle both outcomes.
   */
  matchOutcome = output<PharaohSimilarityMatchOutcomeOutput>();

  /**
   * Fires whenever the component enters a failure state.
   * Consumers can use this to react to internal API/load/match failures.
   */
  failure = output<PharaohSimilarityFailureOutput>();

  /**
   * Fires only when the user explicitly clicks the "Turn me into ..." action button.
   * Consumers should handle any parent-level action here, such as navigation,
   * opening a modal, or starting an image transformation flow.
   *
   * The emitted payload includes the matched pharaoh and the captured user image.
   */
  turnIntoMatchedPharaoh = output<PharaohSimilarityResultOutput>();

  /**
   * Fires when the error action button is clicked.
   */
  errorClick = output<void>();

  /**
   * Fires when the capture button is clicked.
   */
  captureClick = output<void>();

  /**
   * Fires when the upload button is clicked.
   */
  uploadClick = output<void>();

  /**
   * Fires when the matched-result button is clicked.
   */
  matchedClick = output<PharaohSimilarityResultOutput>();

  /**
   * Fires when camera permission resolves to an accepted or denied state.
   */
  cameraPermissionResolved = output<PharaohSimilarityCameraPermissionState>();

  // ─── Models ───────────────────────────────────────────────────────────────
  cameraPermissionState = model<PharaohSimilarityCameraPermissionState>('prompt');

  // ─── State ─────────────────────────────────────────────────────────
  readonly state = signal<ExperienceState>('loading');
  readonly failureContext = signal<FailureContext>(null);
  readonly errorMessage = signal('');
  readonly capturedImageUrl = signal<string | null>(null);
  readonly matchedPharaoh = signal<PharaohProfile | null>(null);
  readonly latestSimilarityResult = signal<PharaohSimilarityResultOutput | null>(null);
  readonly liveAnalysisAvailable = signal(false);
  readonly processingProgress = signal(0);
  readonly activeCameraFacingMode = signal<'user' | 'environment'>('user');
  readonly uiLanguage = signal<'en' | 'ar'>(this.resolveUiLanguage());
  readonly isCameraPreviewVisible = signal(false);

  // ─── Computed Signals (Assets) ─────────────────────────────────────────────
  readonly resolvedAssets = computed(() => {
    const componentConfig = this.config();
    const componentAssets = componentConfig?.assets;

    return resolvePharaohSimilarityAssets(
      {
        backgroundImageUrl: resolveConfiguredAssetValue(
          this.backgroundImageUrl(),
          componentAssets?.backgroundImageUrl
        ),
        idleFrameUrl: componentAssets?.idleFrameUrl,
        activeFrameUrl: componentAssets?.activeFrameUrl,
        rectangleFrameUrl: resolveConfiguredAssetValue(
          this.rectangleFrameUrl(),
          componentAssets?.rectangleFrameUrl
        ),
        faceFrameOverlayUrl: resolveConfiguredAssetValue(
          this.faceFrameOverlayUrl(),
          componentAssets?.faceFrameOverlayUrl
        ),
        errorIconUrl: this.errorIconUrl(),
      },
      {
        idleFrameUrl: CAMERA_FRAME_URL,
        activeFrameUrl: ACTIVE_CAMERA_FRAME_URL,
        errorIconUrl: ERROR_URL,
      }
    );
  });

  readonly resolvedErrorIconUrl = computed(() => this.resolvedAssets().errorIconUrl);

  readonly normalizedBackgroundImageUrl = computed(() => this.resolvedAssets().backgroundImageUrl);

  readonly hasBackgroundAsset = computed(() => !!this.normalizedBackgroundImageUrl());
  readonly hasResult = computed(() =>
    hasSimilarityResult(this.capturedImageUrl(), this.matchedPharaoh(), this.failureContext())
  );
  readonly shouldShowNoFaceState = computed(() =>
    shouldShowNoFaceMessage(
      this.state(),
      this.capturedImageUrl(),
      this.liveAnalysisAvailable(),
      this.failureContext()
    )
  );
  readonly shouldShowProcessingTitleState = computed(() =>
    shouldShowProcessingTitle(this.state(), this.processingProgress())
  );
  readonly shouldShowProgressPanelState = computed(() =>
    shouldShowProgressPanel(this.state(), this.hasResult())
  );
  readonly displayedProcessingProgress = computed(() =>
    getDisplayedProcessingProgress(this.state(), this.processingProgress(), this.hasResult())
  );
  readonly shouldShowActionsState = computed(() =>
    shouldShowActionButtons(this.state(), this.capturedImageUrl(), this.failureContext())
  );
  readonly shouldDimActionsState = computed(() => shouldDimActionButtons(this.state()));
  readonly shouldShowMatchedResultActionState = computed(() =>
    shouldShowMatchedResultAction(this.state(), this.hasResult())
  );
  readonly hasCompletedProcessingResultState = computed(
    () => this.hasResult() && this.displayedProcessingProgress() === 100
  );
  readonly backgroundImageStyle = computed(() => {
    const backgroundUrl = this.normalizedBackgroundImageUrl();
    return backgroundUrl ? `url(${backgroundUrl})` : null;
  });
  readonly isActiveFrame = computed(() =>
    shouldUseActiveFrame(this.state(), this.capturedImageUrl(), this.liveAnalysisAvailable())
  );
  readonly currentFrameUrl = computed(() =>
    this.isActiveFrame() ? this.resolvedAssets().activeFrameUrl : this.resolvedAssets().idleFrameUrl
  );
  readonly shouldShowBlackFullFrameCanvas = computed(
    () =>
      this.rectangleFrame() &&
      !this.capturedImageUrl() &&
      (!this.isCameraPreviewVisible() || this.cameraPermissionState() === 'denied')
  );

  // ─── Computed Signals (Copy/Text) ──────────────────────────────────────────
  readonly resolvedCopy = computed(() => {
    const componentConfig = this.config();
    const copyInput = this.copy();
    const configCopy = componentConfig?.copy;
    const failureCopy = mergeFailureCopyMaps(copyInput?.failure, configCopy?.failure);

    return {
      noDetectedFaceMessage: this.resolveCopyValue(
        DEFAULT_NO_DETECTED_FACE_MESSAGE,
        this.noDetectedFaceMessage(),
        copyInput?.noDetectedFaceMessage,
        configCopy?.noDetectedFaceMessage
      ),
      processingLabel: this.resolveCopyValue(
        getUIMessage('processing', this.uiLanguage()),
        copyInput?.processingLabel,
        configCopy?.processingLabel
      ),
      cameraPreviewLabel: this.resolveCopyValue(
        getUIMessage('cameraPreview', this.uiLanguage()),
        copyInput?.cameraPreviewLabel,
        configCopy?.cameraPreviewLabel
      ),
      capturedImageAlt: this.resolveCopyValue(
        getUIMessage('capturedFacePreview', this.uiLanguage()),
        copyInput?.capturedImageAlt,
        configCopy?.capturedImageAlt
      ),
      matchingProgressLabel: this.resolveCopyValue(
        getUIMessage('matchingProgress', this.uiLanguage()),
        copyInput?.matchingProgressLabel,
        configCopy?.matchingProgressLabel
      ),
      captureImageLabel: this.resolveCopyValue(
        getUIMessage('captureImage', this.uiLanguage()),
        copyInput?.captureImageLabel,
        configCopy?.captureImageLabel
      ),
      uploadImageLabel: this.resolveCopyValue(
        getUIMessage('uploadImage', this.uiLanguage()),
        copyInput?.uploadImageLabel,
        configCopy?.uploadImageLabel
      ),
      errorIconAlt: this.resolveCopyValue(
        getUIMessage('errorIconAlt', this.uiLanguage()),
        copyInput?.errorIconAlt,
        configCopy?.errorIconAlt
      ),
      openSettingsLabel: this.resolveCopyValue(
        getUIMessage('openSettings', this.uiLanguage()),
        copyInput?.openSettingsLabel,
        configCopy?.openSettingsLabel
      ),
      matchedResultPrefix: this.resolveCopyValue(
        getUIMessage('youLookLike', this.uiLanguage()),
        this.matchedResultPrefix(),
        copyInput?.matchedResultPrefix,
        configCopy?.matchedResultPrefix
      ),
      matchedActionPrefix: this.resolveCopyValue(
        getUIMessage('turnMeInto', this.uiLanguage()),
        this.matchedActionPrefix(),
        copyInput?.matchedActionPrefix,
        configCopy?.matchedActionPrefix
      ),
      matchedActionFallback: this.resolveCopyValue(
        getUIMessage('turnMeIntoPharaoh', this.uiLanguage()),
        copyInput?.matchedActionFallback,
        configCopy?.matchedActionFallback
      ),
      failure: this.pharaohSimilarityService.resolveFailureCopy(failureCopy, this.uiLanguage()),
    };
  });
  readonly noDetectedFaceText = computed(() => this.resolvedCopy().noDetectedFaceMessage);
  readonly matchedResultText = computed(() => {
    if (this.hasExplicitMatchedResultText()) {
      return this.resolvedCopy().matchedResultPrefix;
    }

    const pharaoh = this.matchedPharaoh();
    if (!pharaoh) {
      return this.resolvedCopy().matchedResultPrefix;
    }

    return `${this.resolvedCopy().matchedResultPrefix} ${pharaoh.name}`;
  });
  readonly processingLabel = computed(() => this.resolvedCopy().processingLabel);
  readonly hasCameraPermission = computed(() => this.cameraPermissionState() === 'granted');
  readonly matchedActionLabel = computed(() => {
    const pharaoh = this.matchedPharaoh();
    if (this.hasExplicitMatchedActionPrefix()) {
      return this.resolvedCopy().matchedActionPrefix;
    }

    if (this.hasExplicitMatchedActionFallback()) {
      return this.resolvedCopy().matchedActionFallback;
    }

    return pharaoh
      ? `${this.resolvedCopy().matchedActionPrefix} ${pharaoh.name}`
      : this.resolvedCopy().matchedActionFallback;
  });
  readonly isMatchedActionDisabled = computed(() => this.disableMatchedAction());
  readonly failureTitle = computed(() => {
    const failureKey = this.failureContext() ?? 'default';
    return this.resolvedCopy().failure[failureKey].title;
  });
  readonly failureButtonText = computed(() => {
    const failureKey = this.failureContext() ?? 'default';

    if (failureKey === 'camera' && this.cameraPermissionState() === 'denied') {
      return this.resolvedCopy().openSettingsLabel;
    }

    return this.resolvedCopy().failure[failureKey].buttonText;
  });
  readonly failureAction = computed<PharaohSimilarityCameraFailureAction>(() => {
    const failureKey = this.failureContext() ?? 'default';

    if (failureKey === 'camera' && this.cameraPermissionState() === 'denied') {
      return {
        type: 'navigate',
        url: CAMERA_PERMISSION_SETTINGS_URL,
      };
    }

    return this.resolvedCopy().failure[failureKey].action;
  });

  // ─── Private Properties ────────────────────────────────────────────────────
  private translateLangSubscription: Subscription | null = null;
  private readonly setProcessingProgress = (value: number) => this.processingProgress.set(value);
  private liveAnalysisMissCount = 0;

  private readonly failureStateHandlers = {
    stopLiveAnalysisLoop: () => this.stopLiveAnalysisLoop(),
    setFailureContext: (context: FailureContext) => this.failureContext.set(context),
    setErrorMessage: (message: string) => this.errorMessage.set(message),
    setErrorState: () => this.state.set('error'),
  };

  // ─── Lifecycle Hooks ────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    this.syncUiLanguageWithTranslateService();
    await this.initializeExperience();
  }

  ngOnDestroy(): void {
    this.translateLangSubscription?.unsubscribe();
    this.pharaohSimilarityService.stopRuntime(
      this.videoRef()?.nativeElement,
      this.setProcessingProgress
    );
  }

  // ─── Public Methods ────────────────────────────────────────────────────────
  async retryFromFailure(): Promise<void> {
    if (this.failureContext() === 'package') {
      await this.reloadPackage();
      return;
    }

    await this.initializeExperience();
  }

  async handleFailureAction(): Promise<void> {
    this.errorClick.emit();

    const action = this.failureAction();

    if (action.type === 'navigate' && action.url) {
      window.location.assign(action.url);
      return;
    }

    await this.retryFromFailure();
  }

  async captureAndCompare(): Promise<void> {
    this.captureClick.emit();

    if (this.state() !== 'ready') {
      return;
    }

    this.stopLiveAnalysisLoop();

    const video = this.videoRef()?.nativeElement;
    if (video && !video.paused) {
      video.pause();
      // Wait one frame for the pause to settle
      await new Promise((resolve) => setTimeout(resolve, 16));
    }

    const capturedFrameCanvas = this.captureFrameCanvas();
    if (!capturedFrameCanvas) {
      if (video && video.paused) {
        await video.play().catch(() => {});
      }
      this.startLiveAnalysisLoop();
      applyPharaohSimilarityFailure(
        this.failureStateHandlers,
        'detection',
        getUIMessage('unableToCaptureFrame', this.uiLanguage())
      );
      return;
    }

    await this.processImageComparison(capturedFrameCanvas);
  }
  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    this.prepareForNewImageInput();
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.applyImmediateDetectionFailure('pleaseChooseValidImage');
      input.value = '';
      return;
    }

    try {
      const uploadedImage = await this.readSelectedImage(file);
      await this.processImageComparison(uploadedImage, true);
    } catch (error) {
      this.applyImmediateDetectionFailure('unableToReadImage');
    } finally {
      input.value = '';
    }
  }

  private async processImageComparison(
    imageSource: string | HTMLCanvasElement,
    requireConfirmedFace: boolean = false
  ): Promise<void> {
    this.capturedImageUrl.set(this.resolveDisplayImageDataUrl(imageSource));
    this.startProcessingState();

    try {
      const analysis = await this.pharaohSimilarityService.finalizeAnalysisWithGender(imageSource, {
        requireConfirmedFace,
        analysisMaxLongEdge: this.getFinalAnalysisMaxLongEdge(),
      });
      const emittedImageDataUrl = await this.resolveEmittedImageDataUrl(
        imageSource,
        requireConfirmedFace
      );
      const capturedImageBase64 = extractBase64FromDataUrl(emittedImageDataUrl);
      const payload = createSimilarityResultOutput(
        analysis,
        emittedImageDataUrl,
        capturedImageBase64
      );

      await this.completeSuccessfulComparison(payload);
    } catch (error) {
      const message = getUIMessage('unableToCompareFace', this.uiLanguage());

      this.stopProcessingState(0);
      this.resetResultState();
      this.applyFailureState('detection', message, error);
    }
  }

  private prepareForNewImageInput(): void {
    this.resetResultState();
    this.processingProgress.set(0);
  }

  private applyImmediateDetectionFailure(messageKey: string): void {
    applyPharaohSimilarityFailure(
      this.failureStateHandlers,
      'detection',
      getUIMessage(messageKey, this.uiLanguage())
    );
  }

  private readSelectedImage(file: File): Promise<string> {
    return this.pharaohSimilarityService.readImageFileAsDataUrl(file);
  }

  private async completeSuccessfulComparison(
    payload: PharaohSimilarityResultOutput
  ): Promise<void> {
    this.latestSimilarityResult.set(payload);
    this.matchedPharaoh.set(payload.matchedPharaoh);
    this.similarityDetected.emit(payload);
    this.matchOutcome.emit({ status: 'success', result: payload });
    await this.pharaohSimilarityService.completeProcessingProgress(this.setProcessingProgress);
    // await this.renderResultOverlay(payload);
    this.state.set('ready');
    this.onTurnIntoMatchedPharaoh();
  }

  async restartCamera(): Promise<void> {
    this.resetResultState();
    this.stopProcessingState(0);

    const video = this.videoRef()?.nativeElement;
    if (video && video.paused) {
      await video.play().catch(() => {});
    }

    await this.initializeExperience();
  }

  onTurnIntoMatchedPharaoh(): void {
    const result = this.latestSimilarityResult();
    if (!result) {
      return;
    }

    this.matchedClick.emit(result);

    this.turnIntoMatchedPharaoh.emit(result);
  }

  async flipCamera(): Promise<void> {
    if (this.state() === 'loading' || this.state() === 'processing' || !!this.capturedImageUrl()) {
      return;
    }

    const nextFacingMode = this.activeCameraFacingMode() === 'user' ? 'environment' : 'user';
    this.state.set('loading');
    this.clearFailureState();
    this.resetLiveAnalysisAvailability();
    this.pharaohSimilarityService.stopLiveAnalysisLoop();
    this.stopProcessingState(0);

    const cameraReady = await this.openCamera(nextFacingMode);
    if (!cameraReady) {
      return;
    }

    this.state.set('ready');
    this.startLiveAnalysisLoop();
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private async initializeExperience(): Promise<void> {
    this.state.set('loading');
    this.clearFailureState();
    this.isCameraPreviewVisible.set(false);
    this.cameraPermissionState.set(await this.pharaohSimilarityService.getPermissionState());
    this.resetResultState();
    this.resetLiveAnalysisAvailability();
    this.pharaohSimilarityService.stopLiveAnalysisLoop();
    this.stopProcessingState(0);
    this.processingProgress.set(0);

    const cameraReady = await this.openCamera(this.activeCameraFacingMode());
    if (!cameraReady) {
      return;
    }

    // Ensure video is playing after camera opens
    const video = this.videoRef()?.nativeElement;
    if (video && video.paused) {
      await video.play().catch(() => {});
    }

    await this.reloadPackage();
  }
  private async reloadPackage(): Promise<void> {
    this.state.set('loading');
    this.clearFailureState();

    try {
      await this.pharaohSimilarityService.prewarmRuntime({
        faceFrameOverlayUrl: this.shouldUseFaceMeshLiveOverlay()
          ? this.resolvedAssets().faceFrameOverlayUrl
          : undefined,
      });
      this.state.set('ready');
      this.startLiveAnalysisLoop();
    } catch (error) {
      this.applyFailureState(
        'package',
        getUIMessage('mediaPixeLoadError', this.uiLanguage()),
        error
      );
    }
  }

  private async openCamera(facingMode: 'user' | 'environment'): Promise<boolean> {
    const video = this.videoRef().nativeElement;
    const canvas = this.getActiveOverlayCanvas();
    this.isCameraPreviewVisible.set(false);
    this.cameraPermissionState.set('prompt');

    const result = await this.pharaohSimilarityService.openCamera(
      video,
      canvas,
      facingMode,
      this.shouldUseFullFrameOverlay()
    );
    this.cameraPermissionState.set(result.permissionState);
    this.emitCameraPermissionStatus(result.permissionState);

    if (result.opened) {
      this.activeCameraFacingMode.set(facingMode);
      this.isCameraPreviewVisible.set(true);
      return true;
    }

    this.applyFailureState('camera', getUIMessage('cameraAccessDenied', this.uiLanguage()));
    return false;
  }

  private startLiveAnalysisLoop(): void {
    const activeCanvas = this.getActiveOverlayCanvas();

    this.pharaohSimilarityService.startLiveAnalysisLoop({
      video: this.videoRef().nativeElement,
      canvas: activeCanvas,
      shouldAnalyze: () => this.state() === 'ready',
      isMirrored: () => this.activeCameraFacingMode() === 'user',
      useFaceMeshOverlay: () => this.shouldUseFaceMeshLiveOverlay(),
      faceFrameOverlayUrl: () => this.resolvedAssets().faceFrameOverlayUrl,
      useElementSizedCanvas: this.shouldUseFullFrameOverlay(),
      analysisIntervalMs: this.getLiveAnalysisIntervalMs(),
      analysisMaxLongEdge: this.getLiveAnalysisMaxLongEdge(),
      onAvailabilityChange: (available) => this.handleLiveAnalysisAvailability(available),
      onOverlayClear: () => this.clearActiveOverlay(activeCanvas),
    });
  }

  private stopLiveAnalysisLoop(): void {
    this.pharaohSimilarityService.stopLiveAnalysisLoop();
  }

  private startProcessingState(): void {
    this.state.set('processing');
    // this.stopLiveAnalysisLoop();
    this.pharaohSimilarityService.startProcessingProgress(this.setProcessingProgress);
    this.resetLiveAnalysisAvailability();
    this.clearActiveOverlay(this.getActiveOverlayCanvas());
  }

  private stopProcessingState(finalValue: number): void {
    this.pharaohSimilarityService.stopProcessingProgress(this.setProcessingProgress, finalValue);
  }

  private resetResultState(): void {
    this.capturedImageUrl.set(null);
    this.matchedPharaoh.set(null);
    this.latestSimilarityResult.set(null);
    // this.clearResultOverlay();
  }

  private clearFailureState(): void {
    this.failureContext.set(null);
    this.errorMessage.set('');
  }

  private applyFailureState(
    context: NonNullable<FailureContext>,
    message: string,
    error?: unknown
  ): void {
    const originalErrorMessage = this.formatOriginalError(error, message);
    const failurePayload = { context, message: originalErrorMessage, error };

    this.failure.emit(failurePayload);
    this.matchOutcome.emit({ status: 'failure', failure: failurePayload });
    applyPharaohSimilarityFailure(this.failureStateHandlers, context, originalErrorMessage);
  }

  private formatOriginalError(error: unknown, fallback: string): string {
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    if (error instanceof Error) {
      return error.stack?.trim() || `${error.name}: ${error.message}`.trim() || fallback;
    }

    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error, null, 2);
      } catch {
        return String(error);
      }
    }

    return fallback;
  }

  private captureFrame(): string {
    return this.pharaohSimilarityService.captureFrame(
      this.videoRef().nativeElement,
      this.activeCameraFacingMode()
    );
  }

  private captureFrameCanvas(): HTMLCanvasElement | null {
    return this.pharaohSimilarityService.captureFrameCanvas(
      this.videoRef().nativeElement,
      this.activeCameraFacingMode()
    );
  }

  private getActiveOverlayCanvas(): HTMLCanvasElement {
    const fullFrameCanvas = this.fullFrameOverlayRef()?.nativeElement;
    if (fullFrameCanvas) {
      return fullFrameCanvas;
    }

    const overlayCanvas = this.overlayRef()?.nativeElement;
    if (overlayCanvas) {
      return overlayCanvas;
    }

    throw new Error('Camera overlay canvas is not available.');
  }

  private shouldUseFullFrameOverlay(): boolean {
    return !!this.fullFrameOverlayRef()?.nativeElement;
  }

  private shouldUseFaceMeshLiveOverlay(): boolean {
    return (
      this.rectangleFrame() &&
      this.shouldUseFullFrameOverlay() &&
      !!this.resolvedAssets().faceFrameOverlayUrl
    );
  }

  private shouldUseRectangleResultOverlay(): boolean {
    return this.rectangleFrame() && this.shouldUseFullFrameOverlay();
  }

  // private async renderResultOverlay(result: PharaohSimilarityResultOutput): Promise<void> {
  //   const resultCanvas = this.getActiveResultOverlayCanvas();
  //   if (!resultCanvas) {
  //     return;
  //   }

  //   await this.pharaohSimilarityService.ensureOverlayPointerIcon();
  //   const overlayAnalysis: PharaohSimilarityAnalysis = result;

  //   await new Promise<void>((resolve) => {
  //     requestAnimationFrame(() => {
  //       this.resizeResultOverlayCanvas(resultCanvas);

  //       if (this.shouldUseRectangleResultOverlay()) {
  //         const overlayFeatureWinners = this.getDisplayFeatureWinners(
  //           overlayAnalysis.featureWinners
  //         );
  //         this.pharaohSimilarityService.drawOverlay(
  //           resultCanvas,
  //           overlayAnalysis.detection,
  //           overlayFeatureWinners,
  //           overlayAnalysis.sourceSize.width,
  //           overlayAnalysis.sourceSize.height,
  //           false,
  //           this.getResultOverlayScaleBoost(),
  //           this.getResultOverlayTextScaleBoost()
  //         );
  //       } else {
  //         this.pharaohSimilarityService.drawLegacyOverlay(
  //           resultCanvas,
  //           overlayAnalysis.detection,
  //           overlayAnalysis.featureWinners,
  //           overlayAnalysis.sourceSize.width,
  //           overlayAnalysis.sourceSize.height,
  //           false,
  //           1
  //         );
  //       }

  //       resolve();
  //     });
  //   });
  // }

  // private getActiveResultOverlayCanvas(): HTMLCanvasElement | null {
  //   if (!this.shouldUseRectangleResultOverlay()) {
  //     return null;
  //   }

  //   const fullFrameResultCanvas = this.fullFrameResultOverlayRef()?.nativeElement;
  //   if (fullFrameResultCanvas) {
  //     return fullFrameResultCanvas;
  //   }

  //   return null;
  // }

  // private clearResultOverlay(): void {
  //   const resultCanvas = this.getActiveResultOverlayCanvas();
  //   if (!resultCanvas) {
  //     return;
  //   }

  //   this.resizeResultOverlayCanvas(resultCanvas);
  //   this.pharaohSimilarityService.drawOverlay(resultCanvas, null);
  // }

  private getDisplayFeatureWinners(
    featureWinners: PharaohSimilarityFeatureWinner[]
  ): PharaohSimilarityFeatureWinner[] {
    if (this.activeCameraFacingMode() !== 'user') {
      return featureWinners;
    }

    const rightEyeLabel = getUIMessage('rightEye', this.uiLanguage());
    const leftEyeLabel = getUIMessage('leftEye', this.uiLanguage());

    return featureWinners.map((winner) => {
      if (winner.featureId === 'rightEye' || winner.label === rightEyeLabel) {
        return {
          ...winner,
          featureId: 'leftEye',
          label: leftEyeLabel,
          preferredSide: 'left',
        };
      }

      if (winner.featureId === 'leftEye' || winner.label === leftEyeLabel) {
        return {
          ...winner,
          featureId: 'rightEye',
          label: rightEyeLabel,
          preferredSide: 'right',
        };
      }

      return winner;
    });
  }

  private resizeResultOverlayCanvas(canvas: HTMLCanvasElement): void {
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

  private clearActiveOverlay(canvas: HTMLCanvasElement): void {
    this.pharaohSimilarityService.drawOverlay(canvas, null);
  }

  private resolveCopyValue(
    fallback: string,
    ...copySources: Array<PharaohSimilarityCameraCopyValue | undefined>
  ): string {
    const language = this.uiLanguage();

    for (const copySource of copySources) {
      const resolvedValue = this.resolveLocalizedValue(copySource, language);
      if (resolvedValue) {
        return resolvedValue;
      }
    }

    return fallback;
  }

  private resolveLocalizedValue(
    copy: PharaohSimilarityCameraCopyValue | undefined,
    language: 'en' | 'ar'
  ): string {
    if (!copy) {
      return '';
    }

    if (typeof copy === 'string') {
      return copy.trim();
    }

    return (copy[language] || copy.en || copy.ar || '').trim();
  }

  private hasExplicitMatchedResultText(): boolean {
    const configCopy = this.config()?.copy;
    const copyInput = this.copy();

    return hasExplicitCopyOverride(
      this.matchedResultPrefix(),
      copyInput?.matchedResultPrefix,
      configCopy?.matchedResultPrefix
    );
  }

  private hasExplicitMatchedActionPrefix(): boolean {
    const configCopy = this.config()?.copy;
    const copyInput = this.copy();

    return hasExplicitCopyOverride(
      this.matchedActionPrefix(),
      copyInput?.matchedActionPrefix,
      configCopy?.matchedActionPrefix
    );
  }

  private hasExplicitMatchedActionFallback(): boolean {
    const configCopy = this.config()?.copy;
    const copyInput = this.copy();

    return hasExplicitCopyOverride(
      undefined,
      copyInput?.matchedActionFallback,
      configCopy?.matchedActionFallback
    );
  }

  private syncUiLanguageWithTranslateService(): void {
    this.uiLanguage.set(this.resolveUiLanguage());
    this.translateLangSubscription = this.translateService.onLangChange.subscribe(() => {
      this.uiLanguage.set(this.resolveUiLanguage());
    });
  }

  private resolveUiLanguage(): 'en' | 'ar' {
    const activeLanguage =
      this.translateService.currentLang ||
      this.translateService.defaultLang ||
      this.translateService.getDefaultLang() ||
      'en';

    return activeLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  onUploadClick(): void {
    if (this.shouldDimActionsState()) {
      return;
    }

    this.uploadClick.emit();
  }

  private emitCameraPermissionStatus(
    permissionState: PharaohSimilarityCameraPermissionState
  ): void {
    if (permissionState === 'granted' || permissionState === 'denied') {
      this.cameraPermissionResolved.emit(permissionState);
    }
  }

  private resolveDisplayImageDataUrl(imageSource: string | HTMLCanvasElement): string {
    if (typeof imageSource === 'string') {
      return imageSource;
    }

    return compressCanvasDataUrl(imageSource, {
      mimeType: 'image/jpeg',
      quality: 0.84,
      minQuality: 0.7,
      maxBytes: 900 * 1024,
    });
  }

  private async resolveEmittedImageDataUrl(
    imageSource: string | HTMLCanvasElement,
    requireConfirmedFace: boolean
  ): Promise<string> {
    const compressionQuality = requireConfirmedFace ? 0.68 : 0.7;

    if (typeof imageSource === 'string') {
      return compressImageDataUrl(imageSource, compressionQuality);
    }

    return compressCanvasDataUrl(imageSource, {
      mimeType: 'image/jpeg',
      quality: compressionQuality,
      minQuality: 0.4,
      maxBytes: 450 * 1024,
    });
  }

  private getFinalAnalysisMaxLongEdge(): number {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 768;
    }

    return 960;
  }

  private getLiveAnalysisMaxLongEdge(): number {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 512;
    }

    return 512;
  }

  private getLiveAnalysisIntervalMs(): number {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 140;
    }

    return 120;
  }

  private handleLiveAnalysisAvailability(available: boolean): void {
    if (available) {
      this.liveAnalysisMissCount = 0;
      if (!this.liveAnalysisAvailable()) {
        this.liveAnalysisAvailable.set(true);
      }
      return;
    }

    this.liveAnalysisMissCount += 1;
    if (
      this.liveAnalysisMissCount >= PharaohSimilarityCameraComponent.LIVE_ANALYSIS_MISS_TOLERANCE
    ) {
      this.liveAnalysisAvailable.set(false);
    }
  }

  private resetLiveAnalysisAvailability(): void {
    this.liveAnalysisMissCount = 0;
    this.liveAnalysisAvailable.set(false);
  }
}
