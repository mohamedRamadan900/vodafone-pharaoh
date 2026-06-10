import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { WC26_ICONS } from '../../defines/defines';

export type SvgSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-world-cup26-cam-svg',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './svg.component.html',
  styleUrls: ['./svg.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldCup26CamSvgComponent {
  readonly svg = input.required<string>();
  readonly size = input<number>(3);
  readonly title = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly extraClasses = input<string | string[]>('');
  readonly viewBox = input<string>('0 0 32 32');
  readonly clickable = input(false);
  readonly disabled = input(false);
  readonly focusable = input(false);
  readonly fill = input<string | null>(null);
  readonly stroke = input<string | null>(null);
  readonly role = input<'img' | 'presentation'>('img');

  WC26_ICONS = WC26_ICONS;

  readonly clicked = output<void>();

  protected readonly sizeClass = computed(() => `icon-${this.size()}`);
  protected readonly classList = computed(() => {
    const classes = ['svg-icon', this.sizeClass()];

    const extra = this.extraClasses();
    if (Array.isArray(extra)) {
      classes.push(...extra);
    } else if (extra) {
      classes.push(...extra.split(' ').filter(Boolean));
    }

    if (this.clickable()) {
      classes.push('svg-icon-clickable');
    }

    if (this.disabled()) {
      classes.push('svg-icon-disabled');
    }

    return classes.join(' ');
  });

  protected readonly ariaHidden = computed(
    () => this.role() === 'presentation' && !this.ariaLabel() && !this.title()
  );

  protected onClick(): void {
    if (!this.clickable() || this.disabled()) {
      return;
    }

    this.clicked.emit();
  }
}
