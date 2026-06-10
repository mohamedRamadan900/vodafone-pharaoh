import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonType = 'button' | 'submit' | 'reset';
export type ButtonIconPosition = 'start' | 'end';

@Component({
  selector: 'app-world-cup26-cam-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldCup26CamButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('medium');
  readonly type = input<ButtonType>('button');
  readonly labelKey = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly customClass = input<string | null>(null);
  readonly icon = input<string | null>(null);
  readonly iconPosition = input<ButtonIconPosition>('start');
  readonly disabled = input(false);
  readonly isLoading = input(false);
  readonly fullWidth = input(true);

  readonly clicked = output<void>();

  protected readonly isDisabled = computed(() => this.disabled() || this.isLoading());
  protected readonly buttonClasses = computed(() => {
    const classes = [
      'btn',
      `btn-${this.variant()}`,
      `btn-${this.size()}`,
      this.customClass() ?? '',
      this.fullWidth() ? 'btn-full' : '',
      this.isLoading() ? 'btn-loading' : '',
    ];

    return classes.filter(Boolean).join(' ');
  });

  protected onClick(): void {
    if (!this.isDisabled()) {
      this.clicked.emit();
    }
  }
}
