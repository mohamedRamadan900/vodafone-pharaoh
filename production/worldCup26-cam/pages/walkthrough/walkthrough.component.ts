import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CONTENT_PATH, ROUTES, WC26_ICONS } from '../../defines/defines';
import { replaceLastUrlSegment } from '../../utils/navigate';
import { WorldCup26CamButtonComponent } from '../../components/button/button.component';
import { ArabicNumberPipe } from '../../pipes/arabic-number.pipe';
import { WorldCup26Service } from '../../services/world-cup26-cam.service';
import { WorldCup26Buttons, WorldCup26Clicks, WorldCup26PageViews } from '../../config/reporting';

@Component({
  selector: 'app-world-cup26-cam-walkthrough',
  standalone: true,
  imports: [CommonModule, TranslateModule, WorldCup26CamButtonComponent, ArabicNumberPipe],
  templateUrl: './walkthrough.component.html',
  styleUrls: ['./walkthrough.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalkthroughComponent {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _worldCup26Service = inject(WorldCup26Service);

  backgroundImageUrl = signal<string>('');

  CONTENT_PATH = CONTENT_PATH;
  WC26_ICONS = WC26_ICONS;
  constructor() {
    this.setBackgroundImage();
  }
  ngOnInit() {
    this._worldCup26Service.trackView(WorldCup26PageViews.walkthroughPage(window.location.href));
  }

  navigateToCameraComponent(): void {
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.walkthrough));
    replaceLastUrlSegment(this._router, ROUTES.CAMERA);
  }

  private setBackgroundImage(): void {
    const imageUrl = this._translateService.instant(`${CONTENT_PATH}.images.homeBG`);
    this.backgroundImageUrl.set(imageUrl);
  }

  getSteps(): string[] {
    const stepsText = this._translateService.instant(`${CONTENT_PATH}.content.steps`);
    return stepsText
      .split(',')
      .map((step: string) => step.trim())
      .filter(Boolean);
  }
}
