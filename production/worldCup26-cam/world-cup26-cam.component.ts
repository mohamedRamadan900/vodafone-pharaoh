import {
  Component,
  inject,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { WorldCup26Service } from './services/world-cup26-cam.service';
import { CONTENT_PATH, ROUTES, WORLD_CUP26_CAM_OVERLAY_ACTIONS } from './defines/defines';
import { resolveWorldCup26CamOverlay } from 'src/app/feature-modules/worldCup26-cam/utils/overlay-error';
import { WorldCup26ErrorOverlayComponent } from './components/error-overlay/error-overlay.component';
import { navigateToApp } from './utils/navigate';
import { SpinnerWorldCupComponent } from './components/spinner/spinner.component';
@Component({
  selector: 'app-world-cup26-cam',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TranslateModule,
    WorldCup26ErrorOverlayComponent,
    SpinnerWorldCupComponent,
  ],
  templateUrl: './world-cup26-cam.component.html',
  styleUrls: ['./world-cup26-cam.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldCup26CamComponent {
  private readonly _router = inject(Router);
  private readonly _worldCup26Service = inject(WorldCup26Service);
  private readonly _translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _currentUrl = signal(this._router.url);
  protected readonly isLoading = this._worldCup26Service.isInquiryLoading;
  protected readonly isGenerationLoading = this._worldCup26Service.isGenerationLoading;
  protected readonly hasError = this._worldCup26Service.hasError;
  protected readonly error = this._worldCup26Service.errorState;
  protected readonly noTrials = this._worldCup26Service.noTrials;
  protected readonly isEligible = this._worldCup26Service.isEligible;
  protected readonly timedout = this._worldCup26Service.istimeout;
  protected readonly isResultRoute = computed(() => this.isResultUrl(this._currentUrl()));
  backgroundImageUrl = signal<string>('');
  CONTENT_PATH = CONTENT_PATH;
  constructor() {
    this.setBackgroundImage();
    this._worldCup26Service.prewarmPharaohSimilarityEngine();
    this.loadInquiry();
    this.preloadRawPharaohs(this.resolveActiveLanguage());
    this._router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this._currentUrl.set(this._router.url);
      });
    this._translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.preloadRawPharaohs(this.resolveActiveLanguage());
    });
  }
  private loadInquiry(): void {
    this._worldCup26Service.loadInquiry().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  protected readonly overlayConfig = computed(() =>
    resolveWorldCup26CamOverlay({
      noTrials: this.noTrials,
      isEligible: this.isEligible,
      timeout: this.timedout,
      hasError: this.hasError,
    })
  );
  protected readonly shouldShowErrorOverlay = computed(() => this.overlayConfig() !== null);
  private preloadRawPharaohs(language: string): void {
    this._worldCup26Service
      .loadRawPharaohs(language)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => EMPTY)
      )
      .subscribe();
  }
  private resolveActiveLanguage(): string {
    return (
      this._translateService.currentLang ||
      this._translateService.defaultLang ||
      this._translateService.getDefaultLang() ||
      'en'
    );
  }
  private setBackgroundImage(): void {
    const imageUrl = this._translateService.instant(`${CONTENT_PATH}.images.homeBG`);
    this.backgroundImageUrl.set(imageUrl);
  }
  private isResultUrl(url: string): boolean {
    const normalizedUrl = url.split('?')[0].split('#')[0];
    return normalizedUrl.endsWith(`/${ROUTES.RESULT}`);
  }
  private readonly actionHandlers: Record<string, () => void> = {
    [WORLD_CUP26_CAM_OVERLAY_ACTIONS.NAVIGATE_HOME]: () => {
      this._worldCup26Service.clearError();
      navigateToApp(this._translateService);
    },
    [WORLD_CUP26_CAM_OVERLAY_ACTIONS.RETRY]: () => {
      this._worldCup26Service.clearError();
      this.loadInquiry();
    },
  };
  protected handleErrorAction(): void {
    const overlayAction = this.overlayConfig()?.action;
    if (overlayAction) {
      this.actionHandlers[overlayAction]?.();
    }
  }
}
