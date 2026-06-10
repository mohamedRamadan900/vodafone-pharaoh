import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, lastValueFrom } from 'rxjs';
import { WorldCup26Service } from '../../services/world-cup26-cam.service';
import { CONTENT_PATH, ROUTES } from '../../defines/defines';
import { replaceLastUrlSegment } from '../../utils/navigate';
import { resolveWorldCup26CameraConfig } from '../../utils/resolve-camera-config';
import { PharaohSimilarityCameraComponent } from '../../../../shared/app-standalone-components/pharaoh-similarity-camera/pharaoh-similarity-camera.component';
import {
  PharaohProfile,
  PharaohSimilarityCameraConfig,
  PharaohSimilarityCameraCopyConfig,
  PharaohSimilarityCameraPermissionState,
} from '../../../../shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh.model';
import { PharaohSimilarityResultOutput } from '../../../../shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh-similarity-camera-view.model';
import { WorldCup26Buttons, WorldCup26Clicks, WorldCup26PageViews } from '../../config/reporting';

@Component({
  selector: 'app-world-cup26-cam-camera',
  standalone: true,
  imports: [CommonModule, TranslateModule, PharaohSimilarityCameraComponent],
  templateUrl: './camera.component.html',
  styleUrls: ['./camera.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraComponent {
  private readonly _router = inject(Router);
  private readonly _worldCup26Service = inject(WorldCup26Service);
  private readonly _translateService = inject(TranslateService);
  private readonly _matchedPharaoh = signal<PharaohProfile | null>(null);
  private readonly _activeLanguage = signal(this.resolveActiveLanguage());
  private readonly _translateLangSubscription: Subscription;

  protected readonly isProcessing = this._worldCup26Service.isProcessing;
  protected readonly isGenerationLoading = this._worldCup26Service.isGenerationLoading;
  protected readonly rawPharaohs = this._worldCup26Service.rawPharaohs;
  protected readonly backgroundImageUrl = computed(() => {
    this._activeLanguage();

    return this._translateService.instant(`${CONTENT_PATH}.images.homeBG`);
  });
  protected readonly rectangleFrameUrl = computed(() => {
    this._activeLanguage();

    return this._translateService.instant(`${CONTENT_PATH}.images.rectFrame`);
  });
  protected readonly faceFrameOverlayUrl = computed(() => {
    this._activeLanguage();

    return this._translateService.instant(`${CONTENT_PATH}.images.faceFrameOverlay`);
  });
  protected readonly errorIconUrl = computed(() => {
    this._activeLanguage();

    return this._translateService.instant(`${CONTENT_PATH}.images.error`);
  });
  protected readonly cameraConfig = computed<PharaohSimilarityCameraConfig>(() => {
    this._activeLanguage();

    const baseConfig = resolveWorldCup26CameraConfig(this._translateService);

    return {
      ...baseConfig,
      copy: {
        ...baseConfig.copy,
        ...this.resolveMatchedCopy(this._matchedPharaoh()),
      },
    };
  });

  CONTENT_PATH = CONTENT_PATH;

  constructor() {
    this._translateLangSubscription = this._translateService.onLangChange.subscribe(() => {
      this._activeLanguage.set(this.resolveActiveLanguage());
    });
  }
  ngOnInit() {
    this._worldCup26Service.trackView(WorldCup26PageViews.cameraPage(window.location.href));
  }

  ngOnDestroy(): void {
    this._translateLangSubscription.unsubscribe();
  }

  onSimilarityDetected(payload: PharaohSimilarityResultOutput): void {
    this._matchedPharaoh.set(payload.matchedPharaoh);
    this._worldCup26Service.setSimilarityPayload(payload);
  }

  async onTurnIntoMatchedPharaoh(payload: PharaohSimilarityResultOutput): Promise<void> {
    // this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.transform));
    try {
      await lastValueFrom(this._worldCup26Service.turnIntoMatchedPharaoh(payload));
      await replaceLastUrlSegment(this._router, ROUTES.RESULT);
      this._worldCup26Service.refreshInquiryInBackground();
    } catch {
      return;
    }
  }
  trackUploadClick() {
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.upload));
  }
  trackCaptureClick() {
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.capture));
  }

  trackCameraPermissionStatus(permissionState: PharaohSimilarityCameraPermissionState): void {
    if (permissionState === 'granted') {
      this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.allowCamera));
      return;
    }

    if (permissionState === 'denied') {
      this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.denyCamera));
    }
  }

  private resolveMatchedCopy(
    pharaoh: PharaohProfile | null
  ): Partial<PharaohSimilarityCameraCopyConfig> {
    if (!pharaoh) {
      return {};
    }
    return {
      matchedResultPrefix: this.normalizeCopy(
        this._translateService.instant(`${CONTENT_PATH}.content.lookingLike`, {
          gender: this.resolveGenderCopy(pharaoh.gender),
          pharaohName: this._matchedPharaoh()?.name ?? '',
        })
      ),
      matchedActionPrefix: this.resolveActionPrefix(),
    };
  }

  private resolveGenderCopy(gender: PharaohProfile['gender']): string {
    const genderKey = gender === 'female' ? 'queen' : 'king';

    return this.normalizeCopy(
      this._translateService.instant(`${CONTENT_PATH}.content.${genderKey}`)
    );
  }

  private resolveActionPrefix(): string {
    const actionKey = this._worldCup26Service.isPostpaid() ? 'turnMeIntoBtnRed' : 'turnMeIntoBtn';
    const actionTemplate = this._translateService
      .instant(`${CONTENT_PATH}.content.${actionKey}`)
      .replace('{{pharaohName}}', this._matchedPharaoh()?.name ?? '');
    return actionTemplate;
  }

  private normalizeCopy(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private resolveActiveLanguage(): string {
    return (
      this._translateService.currentLang ||
      this._translateService.defaultLang ||
      this._translateService.getDefaultLang() ||
      'en'
    );
  }
}
