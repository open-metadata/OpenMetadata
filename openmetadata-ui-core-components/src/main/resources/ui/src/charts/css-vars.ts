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

// Browser-only: reads computed styles, so it lives outside the Node-safe
// `options/` builders.

const CSS_VAR = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/;

const resolveString = (value: string, styles: CSSStyleDeclaration): string => {
  const match = CSS_VAR.exec(value);
  if (!match) {
    return value;
  }
  const computed = styles.getPropertyValue(match[1]).trim();

  return computed || match[2] || value;
};

const resolveValue = (value: unknown, styles: CSSStyleDeclaration): unknown => {
  if (typeof value === 'string') {
    return resolveString(value, styles);
  }
  if (Array.isArray(value)) {
    const next = value.map((item) => resolveValue(item, styles));

    return next.some((item, index) => item !== value[index]) ? next : value;
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = resolveValue(item, styles);
      changed ||= next[key] !== item;
    }

    return changed ? next : value;
  }

  return value;
};

/**
 * Replaces `var(--token)` colour strings in an ECharts option with their
 * computed values on `element`. ECharts cannot parse CSS variables: the SVG
 * renderer still paints the resting state, but hover lightening and state
 * animation lose the fill, so a hovered slice or bar disappears. Returns the
 * same object when nothing changed.
 */
export const resolveCssVarColors = <T>(option: T, element: Element): T =>
  resolveValue(option, getComputedStyle(element)) as T;
