import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CONTENT_PATH, ROUTES } from '../../defines/defines';
import { WorldCup26CamButtonComponent } from '../../components/button/button.component';
import { replaceLastUrlSegment } from '../../utils/navigate';
import { WorldCup26Service } from '../../services/world-cup26-cam.service';
import { WorldCup26Buttons, WorldCup26Clicks, WorldCup26PageViews } from '../../config/reporting';

@Component({
  selector: 'app-world-cup26-cam-home',
  standalone: true,
  imports: [CommonModule, TranslateModule, WorldCup26CamButtonComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _worldCup26Service = inject(WorldCup26Service);

  backgroundImageUrl = signal<string>('');

  CONTENT_PATH = CONTENT_PATH;
  constructor() {
    this.setBackgroundImage();
  }
  ngOnInit() {
    this._worldCup26Service.trackView(WorldCup26PageViews.homePage(window.location.href));
  }
  navigateToWalkthrough(): void {
    this._worldCup26Service.trackClick(WorldCup26Clicks.click(WorldCup26Buttons.home));
    replaceLastUrlSegment(this._router, ROUTES.WALKTHROUGH);
  }

  private setBackgroundImage(): void {
    const imageUrl = this._translateService.instant(`${CONTENT_PATH}.images.homeBG`);
    this.backgroundImageUrl.set(imageUrl);
  }
}
