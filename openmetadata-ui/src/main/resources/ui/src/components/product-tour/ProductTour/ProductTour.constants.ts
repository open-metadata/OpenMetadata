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

// Finds the popover; react-tour's own class names are generated.
export const TOUR_HELPER_MARKER_CLASS_NAME = 'product-tour-helper';

// react-tour hard-codes a white popover, arrow and #5e5e5e close icon, and its
// copy inherits the page colour: light-on-white in dark mode. Tokens make the
// popover follow the theme. The library's styles are injected unlayered at
// runtime, so they beat Tailwind's layered utilities unless marked important.
export const TOUR_HELPER_CLASS_NAME = [
  TOUR_HELPER_MARKER_CLASS_NAME,
  'tw:max-w-150!',
  'tw:bg-overlay-surface!',
  'tw:text-primary!',
  // The pointer arrow is the popover's ::after, drawn by a white border.
  'tw:after:bg-overlay-surface!',
  'tw:after:border-bg-overlay-surface!',
  // The close button's only hook is its `reactour__close` class.
  'tw:[&_[class*=close]]:text-fg-tertiary!',
  'tw:[&_[class*=close]:hover]:text-fg-secondary!',
].join(' ');

// The tour's mask, in the backdrop colour modals use, so it follows the theme.
// react-tour writes it into CSS, where a custom property resolves. The bridge
// var, not the raw --color-bg-overlay, which is unset outside dark mode.
export const TOUR_MASK_COLOR = 'var(--tw-background-color-overlay)';

// react-tour's keys to disable, leaving Escape to close the tour. On the last
// step the right arrow would close the tour instead of finishing it.
export const KEYBOARD_NAVIGATION_ESCAPE_ONLY: Array<'right' | 'left'> = [
  'right',
  'left',
];

// react-tour's pause before showing the next step on the same page. Long
// enough that a step on another page has already started its page change,
// which unmounts react-tour, before react-tour moves on by itself.
export const TOUR_STEP_WAIT_MS = 150;

// How far a target that fits on screen must clear the viewport edges, or the
// tour scrolls it to the middle; a prompt docked at the bottom of a page
// covers less than this.
export const TOUR_SCROLL_MARGIN = 200;

// Every target counts as in view for react-tour, so it never scrolls: once its
// own scroll ends it positions the popover from a ref that may be gone by
// then, and throws. scrollTargetIntoView scrolls instead, before react-tour
// measures the target.
export const TOUR_IN_VIEW_THRESHOLD = -Number.MAX_SAFE_INTEGER;

// How long a page must make no request before its step opens. Pages read
// fixtures, and their code is loaded as the tour starts, so a panel that
// fetches after the page's first data has answered well within this.
export const TOUR_PAGE_QUIET_MS = 50;

// Set on <html> while the next page settles; the page content is hidden
// meanwhile, so its loading states never show under the mask.
export const TOUR_PENDING_ATTRIBUTE = 'data-product-tour-pending';

// How long a page change may hold the current step on screen while the next
// page settles; past it the change completes behind the mask instead.
// Browsers abort a view transition whose update runs much longer.
export const TOUR_TRANSITION_TIMEOUT_MS = 3500;

// How often a page's target is checked while the tour waits for it to settle.
export const TARGET_POLL_INTERVAL_MS = 16;

// The cross-fade from one step to the next; the browser's default is 250 ms.
export const TOUR_TRANSITION_FADE_MS = 160;

// Set on <html> while the step on screen points at the page because its own
// target is missing; the tour spec fails on it, so a lost marker shows.
export const TOUR_FALLBACK_ATTRIBUTE = 'data-product-tour-fallback';
