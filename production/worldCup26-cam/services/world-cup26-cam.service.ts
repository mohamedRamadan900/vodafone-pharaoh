import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import {
  EMPTY,
  Observable,
  catchError,
  delay,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import { ImageMock, InquiryMock } from '../defines/mocks';
import { APIConfig } from '../config/api.config';
import { WorldCup26CamRequestConfig } from 'src/app/feature-modules/worldCup26-cam/config/request-config';
import { DeviceSharingService } from '../../../shared/services/device-sharing.service';
import { AITransformResponse, WorldCup26RedemptionResponse } from '../models/world-cup26-cam.dto';
import { ErrorState, ErrorConfig, ErrorType } from '../models/error.model';
import { PharaohSimilarityResultOutput } from '../../../shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh-similarity-camera-view.model';
import { PharaohApiFlatItem } from '../../../shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh.model';
import { PharaohSimilarityCameraService } from '../../../shared/app-standalone-components/pharaoh-similarity-camera/services/pharaoh-similarity-camera.service';
import {
  resolveErrorType,
  buildErrorConfig,
  createErrorState,
  logError,
} from '../utils/error-handling';
import { InquiryDTO } from '../models/inquiry.dto';
import { IWorldCup26CamInquiryData } from '../models/mapped-inquiry';
import { mapInquiry } from '../utils/map-inquiry';
import { requestTimeout, showSpinner } from 'src/app/shared/constants/defines';
import {
  convertBlobToDataUrl,
  normalizeImageForSharing,
  resolveImageFormat,
} from '../utils/resolve-camera-config';
import {
  WorldCup26ApiTracking,
  WorldCup26ApiTrackingEvent,
  WorldCup26Click,
  WorldCup26View,
} from '../config/reporting';
import { TrackingService } from 'src/app/core/services/tracking.service';
import { CommonCacheService } from 'src/app/core/services/common-cache.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { StorageType } from 'src/app/shared/enums/storage.enum';
import {
  CAMERA_CONFIG,
  CHANNEL_TYPE,
  GIFTTYPE_POSTPAID,
  GIFTTYPE_PREPAID,
  RESULT_IMAGE_STORAGE_KEY,
  WORLD_CUP26_NOT_ELIGIBLE_ERROR_CODE,
  WORLD_CUP26_TIMEOUT_ERROR_CODE,
} from '../defines/defines';
import Compressor from 'compressorjs';
@Injectable({
  providedIn: 'root',
})
export class WorldCup26Service {
  private readonly http = inject(HttpClient);
  private readonly _trackingService = inject(TrackingService);
  private readonly _commonCacheService = inject(CommonCacheService);
  private readonly _storageService = inject(StorageService);
  private readonly deviceSharingService = inject(DeviceSharingService);
  private readonly pharaohSimilarityCameraService = inject(PharaohSimilarityCameraService);
  private readonly _defaultInquiryHeaders: Record<string, string> = {
    channel: CHANNEL_TYPE,
  };
  private _inquiryRequest$: Observable<IWorldCup26CamInquiryData> | null = null;
  private _turnIntoPharaohRequest$: Observable<AITransformResponse> | null = null;
  private readonly _pharaohsCache = new Map<string, PharaohApiFlatItem[]>();
  private readonly _pharaohsRequests = new Map<string, Observable<PharaohApiFlatItem[]>>();
  // Private signals (mutable)
  private readonly _uploadedPhoto = signal<string | null>(null);
  private readonly _transformResult = signal<AITransformResponse | null>(null);
  private readonly _similarityPayload = signal<PharaohSimilarityResultOutput | null>(null);
  private readonly _uploadProgress = signal(0);
  private readonly _processingProgress = signal(0);
  private readonly _isUploading = signal(false);
  private readonly _isProcessing = signal(false);
  private readonly _inquiryData = signal<IWorldCup26CamInquiryData | null>(null);
  private readonly _isInquiryLoading = signal(false);
  private readonly _isGenerationLoading = signal(false);
  private readonly _isEligible = signal(true);
  private readonly _istimeout = signal(false);
  private readonly _rawPharaohs = signal<PharaohApiFlatItem[] | null>(null);
  private readonly _stickerImageBase64 = signal<string | null>(null);
  // Public read-only signals
  readonly uploadedPhoto = this._uploadedPhoto.asReadonly();
  readonly transformResult = this._transformResult.asReadonly();
  readonly similarityPayload = this._similarityPayload.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();
  readonly processingProgress = this._processingProgress.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly inquiryData = this._inquiryData.asReadonly();
  readonly isInquiryLoading = this._isInquiryLoading.asReadonly();
  readonly isGenerationLoading = this._isGenerationLoading.asReadonly();
  readonly isEligible = this._isEligible.asReadonly();
  readonly istimeout = this._istimeout.asReadonly();
  readonly rawPharaohs = this._rawPharaohs.asReadonly();
  readonly stickerImageBase64 = this._stickerImageBase64.asReadonly();
  // Computed signals
  readonly hasError = computed(() => this._errorState() !== null);
  readonly hasTrials = computed(() => this._inquiryData()?.hasTrials ?? false);
  readonly noTrials = computed(() => this._inquiryData()?.noTrials ?? false);
  readonly hasWallet = computed(() => this._inquiryData()?.hasWallet ?? false);
  readonly isReady = computed(
    () =>
      !this._isUploading() &&
      !this._isProcessing() &&
      !this._isInquiryLoading() &&
      !this._isGenerationLoading() &&
      !this.hasError()
  );
  // Error signals (mutable)
  private readonly _errorState = signal<ErrorState | null>(null);
  private readonly _errorConfig = signal<ErrorConfig | null>(null);
  // Error signals (public read-only)
  readonly errorState = this._errorState.asReadonly();
  readonly errorConfig = this._errorConfig.asReadonly();
  setSimilarityPayload(payload: PharaohSimilarityResultOutput): void {
    this._similarityPayload.set(payload);
    this._transformResult.set(null);
  }
  turnIntoMatchedPharaoh(payload: PharaohSimilarityResultOutput): Observable<AITransformResponse> {
    if (this._turnIntoPharaohRequest$) {
      return this._turnIntoPharaohRequest$;
    }
    this.clearError();
    this._isProcessing.set(true);
    this._processingProgress.set(0);
    this._turnIntoPharaohRequest$ = this.resolveInquiryData().pipe(
      switchMap((inquiryData) => {
        if (!inquiryData.giftId) {
          return this.handleError(
            new Error('WorldCup26CamService.turnIntoMatchedPharaoh: missing gift id'),
            'WorldCup26CamService.turnIntoMatchedPharaoh'
          );
        }
        return this.redeemGift(inquiryData.giftId, payload).pipe(
          tap(() => this._processingProgress.set(60)),
          tap(() => {
            this._processingProgress.set(100);
          })
        );
      }),
      finalize(() => {
        this._isProcessing.set(false);
        this._processingProgress.set(0);
        this._turnIntoPharaohRequest$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    return this._turnIntoPharaohRequest$;
  }
  loadInquiry(): Observable<IWorldCup26CamInquiryData> {
    const cachedInquiryData = this._inquiryData();
    if (cachedInquiryData) {
      this.clearError();
      return of(cachedInquiryData);
    }
    if (this._inquiryRequest$) {
      return this._inquiryRequest$;
    }
    this.setCustomHeaders(this._defaultInquiryHeaders);
    this.clearError();
    this._isInquiryLoading.set(true);
    // this._inquiryRequest$ = of(InquiryMock)
    this._inquiryRequest$ = this.http
      .get<InquiryDTO[]>(APIConfig.Inquiry.url(), {
        context: new HttpContext().set(showSpinner, true),
      })

      .pipe(
        map((inquiry: InquiryDTO[]) => mapInquiry(inquiry)),
        tap((inquiryData) => this.applyInquiryData(inquiryData)),
        catchError((error) => {
          const backendCode = error?.error?.errorCode ?? error?.errorCode ?? error?.error?.code;
          this._isEligible.set(backendCode !== WORLD_CUP26_NOT_ELIGIBLE_ERROR_CODE);
          this._inquiryData.set(null);
          this.handleError(error, 'WorldCup26CamService.loadInquiry');
          return EMPTY;
        }),
        finalize(() => {
          this._isInquiryLoading.set(false);
          this._inquiryRequest$ = null;
          this.clearCustomHeaders();
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    return this._inquiryRequest$;
  }
  loadRawPharaohs(language: string): Observable<PharaohApiFlatItem[]> {
    const normalizedLanguage = (language || 'en').toLowerCase();
    const cachedPharaohs = this._pharaohsCache.get(normalizedLanguage);
    if (cachedPharaohs) {
      this._rawPharaohs.set(cachedPharaohs);
      this.syncPreloadedPharaohs(cachedPharaohs);
      return of(cachedPharaohs);
    }
    const activeRequest = this._pharaohsRequests.get(normalizedLanguage);
    if (activeRequest) {
      return activeRequest;
    }
    const request$ = this.http
      .get<
        PharaohApiFlatItem[] | { data?: PharaohApiFlatItem[]; items?: PharaohApiFlatItem[] }
      >(APIConfig.pharaohs_dataList.url(normalizedLanguage))
      .pipe(
        map((response) => this.extractPharaohRecords(response)),
        tap((pharaohs) => {
          this._pharaohsCache.set(normalizedLanguage, pharaohs);
          this._rawPharaohs.set(pharaohs);
          this.syncPreloadedPharaohs(pharaohs);
        }),
        catchError((error) => {
          this._rawPharaohs.set([]);
          return of([]);
        }),
        finalize(() => this._pharaohsRequests.delete(normalizedLanguage)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    this._pharaohsRequests.set(normalizedLanguage, request$);
    return request$;
  }
  private resolveInquiryData(): Observable<IWorldCup26CamInquiryData> {
    const cachedInquiryData = this._inquiryData();
    if (cachedInquiryData) {
      return of(cachedInquiryData);
    }
    return this.loadInquiry();
  }
  private setCustomHeaders(headers: Record<string, string>): void {
    this._commonCacheService.customHeader = { ...headers };
  }
  private clearCustomHeaders(): void {
    this._commonCacheService.customHeader = {};
  }
  prewarmPharaohSimilarityEngine(): void {
    void this.pharaohSimilarityCameraService.initMediaPipe();
    void this.pharaohSimilarityCameraService.warmUpGenderModel().catch(() => undefined);
  }
  private syncPreloadedPharaohs(pharaohs: PharaohApiFlatItem[]): void {
    this.pharaohSimilarityCameraService.setPreloadedPharaohs(pharaohs);
  }
  private extractPharaohRecords(
    response: PharaohApiFlatItem[] | { data?: PharaohApiFlatItem[]; items?: PharaohApiFlatItem[] }
  ): PharaohApiFlatItem[] {
    return Array.isArray(response) ? response : response.data || response.items || [];
  }
  private transformImage(
    payload: PharaohSimilarityResultOutput,
    giftToken: string
  ): Observable<AITransformResponse> {
    this._processingProgress.set(25);
    this.clearError();
    console.log(payload);
    return this.resolveBase64ImageContent(payload).pipe(
      switchMap((imageBase64) => {
        const mimeType = this.getMimeTypeFromDataUrl(payload.capturedImageUrl);
        if (!imageBase64) {
          return this.handleError(
            new Error('WorldCup26CamService.transformImage: missing image base64'),
            'WorldCup26CamService.transformImage'
          );
        }
        const body = WorldCup26CamRequestConfig.redemptionBody({
          giftId: giftToken,
          imageBase64,
          pharaohName: payload.matchedPharaoh?.ids ?? '',
          mimeType,
        });
        console.log('🚀 Redemption Request Body:', body);
        this.logRedemptionRequestBody(body);
        this._isGenerationLoading.set(true);

        return this.http
          .post<WorldCup26RedemptionResponse>(APIConfig.RedemptionAndGeneration.url(), body, {
            context: new HttpContext().set(requestTimeout, CAMERA_CONFIG.PROCESSING_TIMEOUT),
          })
          .pipe(
            map((response) => ({
              response,
              transformResult: this.buildTransformResult(payload, response),
            })),
            tap(({ response, transformResult }) => {
              this.clearError();
              this._similarityPayload.set(payload);
              this._transformResult.set(transformResult);
              this.setStickerImageBase64(response.imageContent || payload.capturedImageUrl || null);
              this.logResultState(transformResult);
              this.trackApiEvent(
                WorldCup26ApiTracking.generateImageSuccess(
                  payload.matchedPharaoh?.ids ?? '',
                  this.isPostpaid() ? GIFTTYPE_POSTPAID : GIFTTYPE_PREPAID
                )
              );
            }),
            map(({ transformResult }) => transformResult),
            catchError((error) => {
              this.trackApiEvent(
                WorldCup26ApiTracking.generateImageFailure(payload.matchedPharaoh?.ids ?? '', error)
              );

              const backendCode = error?.error?.errorCode ?? error?.errorCode ?? error?.error?.code;

              const isTimeout = backendCode === WORLD_CUP26_TIMEOUT_ERROR_CODE;

              this._istimeout.set(isTimeout);

              if (isTimeout) {
                return EMPTY;
              }

              return this.handleError(error, 'WorldCup26CamService.transformImage');
            }),
            finalize(() => {
              this._isGenerationLoading.set(false);
            })
          );
      })
    );
  }
  redeemGift(
    giftToken: string,
    payload: PharaohSimilarityResultOutput
  ): Observable<AITransformResponse> {
    return this.transformImage(payload, giftToken).pipe(
      tap(() => {
        this.clearInquiryCache();
      }),
      catchError((error) => this.handleError(error, 'WorldCup26CamService.redeemGift'))
    );
  }
  async saveResultPicture(imageSource: string | null): Promise<void> {
    const imageToDownload = imageSource;
    if (!imageToDownload) {
      return;
    }
    const { fileName } = this.createShareContext(imageToDownload);
    this.deviceSharingService.downloadImage(imageToDownload, fileName);
  }
  async saveAndShareResultPicture(imageSource: string | null): Promise<string | null> {
    const resolvedImageSource = imageSource;
    if (!resolvedImageSource) {
      return null;
    }
    const { fileName, shareOptions } = this.createShareContext(resolvedImageSource);
    const shareableImage = await normalizeImageForSharing(resolvedImageSource);
    const downloadableImage = shareableImage ?? resolvedImageSource;
    this.deviceSharingService.downloadImage(downloadableImage, fileName);
    if (!this.deviceSharingService.isIos() && !this.deviceSharingService.isAndroid()) {
      return downloadableImage;
    }
    if (!shareableImage) {
      return downloadableImage;
    }
    await this.deviceSharingService.shareImage(shareableImage, 942, shareOptions);
    return shareableImage;
  }
  async shareResultPicture(imageSource: string | null): Promise<string | null> {
    const resolvedImageSource = imageSource;
    if (!resolvedImageSource) {
      return null;
    }
    const { shareOptions } = this.createShareContext(resolvedImageSource);
    const shareableImage = await normalizeImageForSharing(resolvedImageSource);
    if (!shareableImage) {
      return null;
    }
    await this.deviceSharingService.shareImage(shareableImage, 942, shareOptions);
    return shareableImage;
  }
  private handleError(error: HttpErrorResponse | Error, context: string) {
    const errorType = resolveErrorType(error as HttpErrorResponse);
    const errorMessage = error instanceof HttpErrorResponse ? error.message : error.message;
    const statusCode = error instanceof HttpErrorResponse ? error.status : undefined;
    const backendCode =
      error instanceof HttpErrorResponse
        ? (error.error?.code ?? error.error?.errorCode)
        : undefined;
    const errorState = createErrorState(
      errorType,
      errorMessage,
      statusCode,
      backendCode as string | undefined,
      error
    );
    logError(errorState, context);
    const errorConfig = buildErrorConfig(errorType);
    this._errorState.set(errorState);
    this._errorConfig.set(errorConfig);
    return throwError(() => error);
  }
  private buildTransformResult(
    payload: PharaohSimilarityResultOutput,
    response?: WorldCup26RedemptionResponse
  ): AITransformResponse {
    const transformedImageBase64 = response?.imageContent || payload.capturedImageBase64 || '';
    const transformedImageUrl = transformedImageBase64
      ? this.normalizeResultImageSource(transformedImageBase64)
      : payload.capturedImageUrl;
    return {
      originalImageUrl: payload.capturedImageUrl,
      transformedImageUrl,
      transformedImageBase64,
      pharaohMatch: payload.matchedPharaoh,
      processedAt: new Date().toISOString(),
    };
  }
  private normalizeResultImageSource(imageSource: string): string {
    const normalizedImageSource = imageSource.trim();
    if (normalizedImageSource.startsWith('data:')) {
      return normalizedImageSource;
    }
    return `data:image/png;base64,${normalizedImageSource}`;
  }
  getMimeTypeFromDataUrl(capturedImageUrl: string): string {
    const match = capturedImageUrl.match(/^data:([^;]+);base64,/);
    return match?.[1] ?? 'image/jpeg';
  }
  private resolveBase64ImageContent(payload: PharaohSimilarityResultOutput): Observable<string> {
    return this.compressBase64Image(payload.capturedImageBase64 || '', 100, 0.6, 800, 800).pipe(
      tap((compressedBase64) => {
        const sizeKB = this.getBase64SizeKB(compressedBase64);
        console.log(
          `Compressed image size: ${this.getBase64SizeKB(compressedBase64).toFixed(2)} KB`
        );
      })
    );
  }
  private logRedemptionRequestBody(body: unknown): void {
    console.log('WorldCup26CamService redemption body', body);
  }
  private logResultState(result: AITransformResponse | null): void {
    console.log('WorldCup26CamService result', result);
  }
  private logStickerImageBase64(imageBase64: string | null): void {
    console.log('WorldCup26CamService baseImage64', imageBase64);
  }
  private createShareContext(imageSource: string): {
    fileName: string;
    shareOptions: {
      fileExtension: string;
      fileName: string;
      contentType: string;
      title: string;
    };
  } {
    const imageFormat = resolveImageFormat(imageSource);
    const fileName = this.buildResultFileName(imageFormat.fileExtension);
    return {
      fileName,
      shareOptions: {
        fileExtension: imageFormat.fileExtension,
        fileName,
        contentType: imageFormat.contentType,
        title: this._similarityPayload()?.matchedPharaoh?.name ?? 'World Cup 26 Result',
      },
    };
  }
  private buildResultFileName(fileExtension: string = 'png'): string {
    const pharaohName = this._similarityPayload()?.matchedPharaoh?.name ?? 'world-cup26-result';
    const normalizedName = pharaohName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${normalizedName || 'world-cup26-result'}.${fileExtension}`;
  }
  private applyInquiryData(inquiryData: IWorldCup26CamInquiryData): void {
    this._inquiryData.set(inquiryData);
    this._isEligible.set(true);
    this.clearError();
  }
  private clearInquiryCache(): void {
    this._inquiryData.set(null);
    this._inquiryRequest$ = null;
  }
  refreshInquiryInBackground(): void {
    this.clearInquiryCache();
    this.loadInquiry().pipe(take(1)).subscribe();
  }
  setStickerImageBase64(imageBase64: string | null): void {
    this._stickerImageBase64.set(imageBase64);
    if (imageBase64) {
      this._storageService.setStorage(
        RESULT_IMAGE_STORAGE_KEY,
        imageBase64,
        StorageType.localStorage
      );
    } else {
      this._storageService.clear(RESULT_IMAGE_STORAGE_KEY, StorageType.localStorage);
    }
    this.logStickerImageBase64(imageBase64);
  }
  clearStickerImageBase64(): void {
    this._stickerImageBase64.set(null);
  }
  trackClick(worldCup26Click: WorldCup26Click) {
    this._trackingService.trackEvent(worldCup26Click);
  }
  trackApiEvent(worldCup26ApiTrackingEvent: WorldCup26ApiTrackingEvent) {
    this._trackingService.trackEvent(worldCup26ApiTrackingEvent);
  }
  trackView(worldCup26View: WorldCup26View) {
    this._trackingService.trackView(worldCup26View);
  }
  isPostpaid(): boolean {
    let roles = this._commonCacheService.getActiveContractRoles();
    if (roles?.some((role) => role.indexOf('ROLE_SPOC') !== -1)) {
      return true;
    } else {
      return this._commonCacheService.getCurrentRole() == 'flex' &&
        this._commonCacheService?.currentUser?.contractType?.toLowerCase() == 'monthly control'
        ? false
        : this._commonCacheService?.currentUser?.contractType !== 'prepaid';
    }
  }
  /**
   * Clear error state
   */
  clearError(): void {
    this._errorState.set(null);
    this._errorConfig.set(null);
    this._isEligible.set(true);
    this._istimeout.set(false);
  }
  /**
   * Reset service state
   */
  reset(): void {
    this.clearInquiryCache();
    this._uploadedPhoto.set(null);
    this._transformResult.set(null);
    this._similarityPayload.set(null);
    this._uploadProgress.set(0);
    this._processingProgress.set(0);
    this._isUploading.set(false);
    this._isProcessing.set(false);
    this._isInquiryLoading.set(false);
    this._isEligible.set(true);
    this._stickerImageBase64.set(null);
    this.clearError();
  }
  compressBase64Image(
    base64: string,
    maxSizeKB: number = 100,
    initialQuality: number = 0.6,
    maxWidth: number = 800,
    maxHeight: number = 800
  ): Observable<string> {
    return new Observable((observer) => {
      if (!base64) {
        observer.error(new Error('Invalid base64 input'));
        return;
      }
      const file = this.base64ToFile(base64, 'image.jpg');
      let quality = initialQuality;
      const runCompression = () => {
        new Compressor(file, {
          quality,
          maxWidth,
          maxHeight,
          mimeType: 'image/jpeg',
          success: (result) => {
            this.fileToBase64(result as File).subscribe({
              next: (compressedBase64) => {
                // ✅ remove data:image/... prefix
                const pureBase64 = this.stripBase64Prefix(compressedBase64);
                const sizeKB = this.getBase64SizeKB(pureBase64);
                // 🔁 retry with lower quality if still too big
                if (sizeKB > maxSizeKB && quality > 0.1) {
                  quality -= 0.1;
                  runCompression();
                } else {
                  observer.next(pureBase64);
                  observer.complete();
                }
              },
              error: (err) => observer.error(err),
            });
          },
          error: (err) => observer.error(err),
        });
      };
      runCompression();
    });
  }
  private stripBase64Prefix(base64: string): string {
    if (!base64) return '';
    // removes: data:image/jpeg;base64,
    return base64.replace(/^data:.*;base64,/, '');
  }
  private base64ToFile(base64: string, filename: string): File {
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64: empty or undefined');
    }
    let cleanBase64 = base64;
    let mime = 'image/jpeg';
    // ✅ Case 1: full data URL
    if (base64.startsWith('data:')) {
      const matches = base64.match(/^data:(.*?);base64,(.*)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }
      mime = matches[1];
      cleanBase64 = matches[2];
    }
    if (!cleanBase64 || cleanBase64.length < 50) {
      throw new Error('Base64 string is too short or corrupted');
    }
    const byteString = atob(cleanBase64);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    return new File([byteArray], filename, { type: mime });
  }
  private fileToBase64(file: File): Observable<string> {
    return new Observable((observer) => {
      const reader = new FileReader();
      reader.onload = () => {
        observer.next(reader.result as string);
        observer.complete();
      };
      reader.onerror = (err) => observer.error(err);
      reader.readAsDataURL(file);
    });
  }
  private getBase64SizeKB(base64: string): number {
    if (!base64) return 0;
    const cleanBase64 = this.stripBase64Prefix(base64);
    return (cleanBase64.length * 3) / 4 / 1024;
  }
}
