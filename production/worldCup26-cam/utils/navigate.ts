import { NavigationExtras, Router, UrlTree } from '@angular/router';
import { CONTENT_PATH } from '../defines/defines';
import { TranslateService } from '@ngx-translate/core';

export interface ReplaceLastSegmentOptions {
  /**
   * Preserve existing query params from the current URL
   * @default true
   */
  preserveQueryParams?: boolean;

  /**
   * Preserve existing fragment from the current URL
   * @default true
   */
  preserveFragment?: boolean;

  /**
   * Additional Angular navigation extras
   */
  navigationExtras?: Omit<NavigationExtras, 'queryParams' | 'fragment'>;
}

/**
 * Replaces only the last segment of the current route path.
 *
 * Examples:
 * /portal/bf/home       -> /portal/bf/walkthrough
 * /bf/home              -> /bf/walkthrough
 * /a/b/c/details        -> /a/b/c/edit
 */
export function replaceLastUrlSegment(
  router: Router,
  newSegment: string,
  options: ReplaceLastSegmentOptions = {}
): Promise<boolean> {
  const { preserveQueryParams = true, preserveFragment = true, navigationExtras = {} } = options;

  const tree: UrlTree = router.parseUrl(router.url);

  const segments = tree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];

  if (!segments.length) {
    return router.navigate(['/', newSegment], {
      ...navigationExtras,
      queryParams: preserveQueryParams ? tree.queryParams : undefined,
      fragment: preserveFragment ? (tree.fragment ?? undefined) : undefined,
    });
  }

  segments[segments.length - 1] = newSegment;

  return router.navigate(['/', ...segments], {
    ...navigationExtras,
    queryParams: preserveQueryParams ? tree.queryParams : undefined,
    fragment: preserveFragment ? (tree.fragment ?? undefined) : undefined,
  });
}
export function navigateToApp(_translateService: TranslateService): void {
  window.location.href = _translateService.instant(`${CONTENT_PATH}.content.anaVodafoneLink`);
}
