import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'arabicNumber',
  standalone: true,
  pure: false,
})
export class ArabicNumberPipe implements PipeTransform {
  private readonly translateService = inject(TranslateService);

  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    const normalizedValue = value.toString();

    if (this.resolveUiLanguage() !== 'ar') {
      return normalizedValue;
    }

    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    return normalizedValue
      .split('')
      .map((digit) => arabicNumbers[parseInt(digit, 10)] || digit)
      .join('');
  }

  private resolveUiLanguage(): 'en' | 'ar' {
    const activeLanguage =
      this.translateService.currentLang ||
      this.translateService.defaultLang ||
      this.translateService.getDefaultLang() ||
      'en';

    return activeLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
}
