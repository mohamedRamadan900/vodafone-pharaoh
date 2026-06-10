import { Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CONTENT_PATH } from '../../defines/defines';
import { WorldCup26Service } from '../../services/world-cup26-cam.service';

@Component({
  selector: 'app-world-cup26-spinner',
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.scss'],
  imports: [TranslateModule],
})
export class SpinnerWorldCupComponent {
  private readonly _translateService = inject(TranslateService);
  private readonly _worldCupService = inject(WorldCup26Service);
  isLoading = this._worldCupService.isGenerationLoading;
  CONTENT_PATH = CONTENT_PATH;
}
