/*
 *  Copyright 2025 Collate.
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

/**
 * Static map of font size values to Tailwind classes.
 * Use this instead of dynamic template literals (e.g. `tw:text-${fontSize}`)
 * so that Tailwind's static scanner can detect all variants at build time.
 */
export const fontSizeClass: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', string> = {
  xs: 'tw:text-xs',
  sm: 'tw:text-sm',
  md: 'tw:text-md',
  lg: 'tw:text-lg',
  xl: 'tw:text-xl',
};

/**
 * Draws a 1px border on the ::after overlay, for elements whose own `outline` is already
 * taken by the focus ring.
 *
 * Rings are box-shadows, and WebKit does not pixel-snap box-shadows — so a ring used as a
 * border thins or disappears in Safari at fractional zoom. Outlines are snapped. An element
 * has only one outline, so on focusable elements the border moves to ::after and the
 * element's own outline stays free for focus.
 *
 * Layout-neutral. Requires `tw:relative` on the host. Supply the colour per variant with
 * `tw:after:outline-<color>`; state changes use `tw:<state>:after:outline-<color>`.
 *
 * Where the element's outline is NOT already in use, prefer the simpler
 * `tw:outline-1 tw:-outline-offset-1 tw:outline-<color>` directly on the element.
 */
export const borderAfter =
  'tw:after:pointer-events-none tw:after:absolute tw:after:inset-0 tw:after:rounded-[inherit] tw:after:outline-1 tw:after:-outline-offset-1';

/** 2px variant of {@link borderAfter}, for elements whose border was a `ring-2`. */
export const borderAfter2 =
  'tw:after:pointer-events-none tw:after:absolute tw:after:inset-0 tw:after:rounded-[inherit] tw:after:outline-2 tw:after:-outline-offset-2';
