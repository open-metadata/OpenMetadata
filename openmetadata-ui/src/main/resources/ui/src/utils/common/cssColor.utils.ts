/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const CSS_COLOR_CACHE_MAX = 200;
// Browsers normalize computed colors to these notations; restricting the cache to them
// prevents unresolved custom-property text from being mistaken for a valid color.
const RESOLVED_COLOR_FORMAT =
  /^(?:#|rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\b/;
const cssColorCache = new Map<string, string>();

const getCssVariableName = (cssColor: string): string => {
  const value = cssColor.slice(4, -1).trim();
  const fallbackSeparator = value.indexOf(',');

  return (
    fallbackSeparator > 0 ? value.slice(0, fallbackSeparator) : value
  ).trim();
};

const isResolvedColor = (value: string): boolean =>
  value.length > 0 &&
  value !== 'rgba(0, 0, 0, 0)' &&
  RESOLVED_COLOR_FORMAT.test(value);

const cacheColor = (key: string, color: string): void => {
  if (cssColorCache.size >= CSS_COLOR_CACHE_MAX) {
    const oldestKey = cssColorCache.keys().next().value;
    if (oldestKey !== undefined) {
      cssColorCache.delete(oldestKey);
    }
  }
  cssColorCache.set(key, color);
};

const getVisualStateKey = (root: HTMLElement): string =>
  `${root.className}\u0000${root.getAttribute('style') ?? ''}`;

/**
 * Resolves a CSS custom property to a concrete color for Canvas/WebGL APIs.
 * Root classes and inline variables are part of the cache key because both
 * dark mode and custom branding can change the computed token at runtime.
 */
export const resolveCssColor = (
  cssColor: string,
  fallbackColor: string
): string => {
  if (typeof document === 'undefined') {
    return fallbackColor;
  }

  if (!cssColor.startsWith('var(')) {
    return cssColor;
  }

  const root = document.documentElement;
  const cacheKey = `${cssColor}\u0000${getVisualStateKey(root)}`;
  const cachedColor = cssColorCache.get(cacheKey);
  if (cachedColor) {
    cssColorCache.delete(cacheKey);
    cssColorCache.set(cacheKey, cachedColor);

    return cachedColor;
  }

  let probe: HTMLDivElement | undefined;

  try {
    probe = document.createElement('div');
    // Unlike `color`, background color cannot inherit an unrelated valid value
    // when a custom property is missing or invalid at computed-value time.
    probe.style.backgroundColor = cssColor;
    probe.style.display = 'none';
    (document.body ?? root).appendChild(probe);

    const cascadeColor = window.getComputedStyle(probe).backgroundColor;
    if (isResolvedColor(cascadeColor)) {
      cacheColor(cacheKey, cascadeColor);

      return cascadeColor;
    }

    const variableColor = window
      .getComputedStyle(root)
      .getPropertyValue(getCssVariableName(cssColor))
      .trim();
    if (isResolvedColor(variableColor)) {
      cacheColor(cacheKey, variableColor);

      return variableColor;
    }
  } catch {
    // Canvas styling is best-effort; callers provide a safe concrete fallback.
  } finally {
    probe?.remove();
  }

  return fallbackColor;
};
