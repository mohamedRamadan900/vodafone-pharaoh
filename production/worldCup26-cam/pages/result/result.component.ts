import {
  AfterViewInit,
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { WorldCup26Service } from '../../services/world-cup26-cam.service';
import { WorldCup26CamSvgComponent } from '../../components/svg/svg.component';
import {
  CASH_WORLD_CUP26_ROUTE_SEGMENT,
  CONTENT_PATH,
  ROUTES,
  SHOW_OVERLAY_QUERY_PARAM,
  SHOW_OVERLAY_QUERY_VALUE,
  WC26_ICONS,
  WORLD_CUP26_ROUTE_SEGMENT,
} from '../../defines/defines';
import { WorldCup26CamButtonComponent } from '../../components/button/button.component';
import { PharaohProfile } from '../../../../shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh.model';
import { replaceLastUrlSegment } from '../../utils/navigate';
import { WorldCup26Buttons, WorldCup26Clicks, WorldCup26PageViews } from '../../config/reporting';

@Component({
  selector: 'app-world-cup26-cam-result',
  standalone: true,
  imports: [CommonModule, TranslateModule, WorldCup26CamSvgComponent, WorldCup26CamButtonComponent],
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultComponent {
  @ViewChild('actionsContainer')
  private readonly _actionsContainer?: ElementRef<HTMLElement>;

  private readonly _worldCup26Service = inject(WorldCup26Service);
  private readonly _translateService = inject(TranslateService);
  private readonly _router = inject(Router);
  private _actionsResizeObserver?: ResizeObserver;
  private _actionsMeasurementFrame?: number;

  protected readonly similarityPayload = this._worldCup26Service.similarityPayload;
  protected readonly transformResult = this._worldCup26Service.transformResult;
  protected readonly noTrials = this._worldCup26Service.noTrials;
  protected readonly hasWallet = this._worldCup26Service.hasWallet;
  protected readonly matchedPharaoh = computed(() => this.similarityPayload()?.matchedPharaoh);
  protected readonly congratsTextKey = computed(
    () =>
      `${CONTENT_PATH}.content.${this._worldCup26Service.isPostpaid() ? 'congratsTextRed' : 'congratsText'}`
  );
  protected readonly resultImageUrl = computed(
    () => this.transformResult()?.transformedImageUrl ?? null
  );
  protected readonly resultImageAlt = computed(() => {
    const pharaoh = this.matchedPharaoh();

    return pharaoh ? `${pharaoh.name} portrait` : '';
  });

  WC26_ICONS = WC26_ICONS;
  CONTENT_PATH = CONTENT_PATH;
  protected readonly frameLoaded = signal(false);
  protected readonly frameUrl = this._translateService.instant(`${CONTENT_PATH}.images.gemFrame`);

  private preloadFrame(): void {
    const img = new Image();

    img.onload = () => {
      this.frameLoaded.set(true);
    };

    img.onerror = () => {
      this.frameLoaded.set(false);
    };

    img.src = this.frameUrl;
  }
  protected readonly actionsWrapped = signal(false);
  backgroundImageUrl = signal<string>('');

  ngOnInit() {
    this._worldCup26Service.trackView(WorldCup26PageViews.resultPage(window.location.href));
  }

  ngAfterViewInit(): void {
    const actionsContainer = this._actionsContainer?.nativeElement;

    if (!actionsContainer) {
      return;
    }

    this._actionsResizeObserver = new ResizeObserver(() => {
      this.scheduleActionsWrapMeasurement();
    });

    this._actionsResizeObserver.observe(actionsContainer);
    this.scheduleActionsWrapMeasurement();
  }

  ngOnDestroy(): void {
    this._actionsResizeObserver?.disconnect();

    if (this._actionsMeasurementFrame !== undefined) {
      cancelAnimationFrame(this._actionsMeasurementFrame);
    }
  }

  constructor() {
    this.preloadFrame();
    this.setBackgroundImage();
    effect(() => {
      if (!this.resultImageUrl()) {
        void replaceLastUrlSegment(this._router, this.noTrials() ? ROUTES.HOME : ROUTES.CAMERA);
      }
    });

    this.showCashButton();
  }

  private setBackgroundImage(): void {
    const imageUrl = this._translateService.instant(`${CONTENT_PATH}.images.homeBG`);
    this.backgroundImageUrl.set(imageUrl);
  }

  private scheduleActionsWrapMeasurement(): void {
    if (this._actionsMeasurementFrame !== undefined) {
      cancelAnimationFrame(this._actionsMeasurementFrame);
    }

    if (this.actionsWrapped()) {
      this.actionsWrapped.set(false);
    }

    this._actionsMeasurementFrame = requestAnimationFrame(() => {
      this._actionsMeasurementFrame = undefined;
      this.updateActionsWrappedState();
    });
  }

  private updateActionsWrappedState(): void {
    const actionsContainer = this._actionsContainer?.nativeElement;

    if (!actionsContainer) {
      return;
    }

    const actionElements = Array.from(actionsContainer.children) as HTMLElement[];

    if (actionElements.length < 2) {
      this.actionsWrapped.set(actionElements.length === 1);
      return;
    }

    const firstTop = actionElements[0].offsetTop;
    this.actionsWrapped.set(actionElements.some((element) => element.offsetTop > firstTop));
  }

  protected async saveAndSharePicture(): Promise<void> {
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.save));
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.share));
    await this._worldCup26Service.saveAndShareResultPicture(this.resultImageUrl());
  }

  protected async createSticker(): Promise<void> {
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.vfCash));
    const cashWorldCup26Url = this.buildCashWorldCup26Url();
    const cashWorldCup26QueryParams = {
      [SHOW_OVERLAY_QUERY_PARAM]: SHOW_OVERLAY_QUERY_VALUE,
    };
    await this._router.navigate(cashWorldCup26Url, {
      queryParams: cashWorldCup26QueryParams,
    });
  }

  private buildCashWorldCup26Url(): string[] {
    const currentUrlTree = this._router.parseUrl(this._router.url);
    const currentSegments =
      currentUrlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
    const worldCup26SegmentIndex = currentSegments.indexOf(WORLD_CUP26_ROUTE_SEGMENT);

    if (worldCup26SegmentIndex === -1) {
      return ['/', CASH_WORLD_CUP26_ROUTE_SEGMENT];
    }

    const portalBaseSegments = currentSegments.slice(0, worldCup26SegmentIndex);

    return ['/', ...portalBaseSegments, CASH_WORLD_CUP26_ROUTE_SEGMENT];
  }

  showCashButton(): boolean {
    const value = this._translateService.instant(`${CONTENT_PATH}.images.temp`);
    return String(value).trim().toLowerCase() === 'true';
  }
}
