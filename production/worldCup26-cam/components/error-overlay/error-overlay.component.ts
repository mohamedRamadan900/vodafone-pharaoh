import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CONTENT_PATH, WorldCup26CamOverlayDescriptor } from '../../defines/defines';
import { WorldCup26CamButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-world-cup26-error-overlay',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './error-overlay.component.html',
  styleUrls: ['./error-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldCup26ErrorOverlayComponent {
  private readonly _translateService = inject(TranslateService);
  readonly overlay = input.required<WorldCup26CamOverlayDescriptor>();
  backgroundImageUrl = signal<string>('');
  readonly action = output<void>();

  constructor() {
    this.setBackgroundImage();
  }
  protected onAction(): void {
    this.action.emit();
  }
  private setBackgroundImage(): void {
    const imageUrl = this._translateService.instant(`${CONTENT_PATH}.images.homeBG`);
    this.backgroundImageUrl.set(imageUrl);
  }
}
