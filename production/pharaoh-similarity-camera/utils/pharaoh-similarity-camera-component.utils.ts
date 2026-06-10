import {
  PharaohSimilarityCameraCopyValue,
  PharaohSimilarityCameraFailureAction,
} from '../models/pharaoh.model';

type FailureCopyMap =
  | Partial<
      Record<
        string,
        { title?: string; buttonText?: string; action?: PharaohSimilarityCameraFailureAction }
      >
    >
  | undefined;

export function resolveConfiguredAssetValue(
  inputValue: string | undefined,
  configValue: string | undefined
): string | undefined {
  return inputValue ?? configValue;
}

export function hasExplicitCopyOverride(
  inputValue: PharaohSimilarityCameraCopyValue | undefined,
  copyValue: PharaohSimilarityCameraCopyValue | undefined,
  configValue: PharaohSimilarityCameraCopyValue | undefined
): boolean {
  return inputValue !== undefined || copyValue !== undefined || configValue !== undefined;
}

export function mergeFailureCopyMaps(
  inputFailureCopy: FailureCopyMap,
  configFailureCopy: FailureCopyMap
): FailureCopyMap {
  if (!inputFailureCopy) {
    return configFailureCopy;
  }

  if (!configFailureCopy) {
    return inputFailureCopy;
  }

  const mergedKeys = new Set([...Object.keys(configFailureCopy), ...Object.keys(inputFailureCopy)]);

  return Array.from(mergedKeys).reduce(
    (mergedCopy, key) => {
      mergedCopy[key] = {
        ...configFailureCopy[key],
        ...inputFailureCopy[key],
      };

      return mergedCopy;
    },
    {} as Record<
      string,
      { title?: string; buttonText?: string; action?: PharaohSimilarityCameraFailureAction }
    >
  );
}
