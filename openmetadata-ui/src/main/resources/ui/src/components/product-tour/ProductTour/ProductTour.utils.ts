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
import {
  REQUIRED_STABLE_LAYOUT_FRAMES,
  TARGET_WAIT_TIMEOUT_MS,
} from '../../../constants/product-tour/productTour.constants';
import { getBasePath } from '../../../utils/HistoryUtils';
import {
  TARGET_POLL_INTERVAL_MS,
  TOUR_HELPER_MARKER_CLASS_NAME,
  TOUR_SCROLL_MARGIN,
  TOUR_TRANSITION_FADE_MS,
  TOUR_TRANSITION_TIMEOUT_MS,
} from './ProductTour.constants';
const getRectKey = (selector: string) => {
  const rect = document.querySelector(selector)?.getBoundingClientRect();

  return rect?.width && rect.height
    ? `${rect.left}:${rect.top}:${rect.width}:${rect.height}`
    : undefined;
};

/**
 * Calls `onReady` once the step's target has rendered and stopped moving (a
 * page grows as its sections load in) and the page is settled, so react-tour
 * measures the target where it settles over a page showing its content. A
 * page can legitimately lack a target (a feature not installed, an empty
 * state), so the wait is capped; `getTourTarget` then points the step at the
 * page.
 */
export const waitForStableTarget = (
  selector: string,
  onReady: () => void,
  isPageSettled: () => boolean = () => true
) => {
  let pollId = 0;
  let stableFrames = 0;
  let previousKey: string | undefined;
  const timeoutId = window.setTimeout(() => {
    window.clearTimeout(pollId);
    onReady();
  }, TARGET_WAIT_TIMEOUT_MS);

  const check = () => {
    const currentKey = getRectKey(selector);
    stableFrames =
      currentKey && currentKey === previousKey && isPageSettled()
        ? stableFrames + 1
        : 0;
    previousKey = currentKey;

    if (stableFrames >= REQUIRED_STABLE_LAYOUT_FRAMES) {
      window.clearTimeout(timeoutId);
      onReady();

      return;
    }
    // A timer, not requestAnimationFrame: the browser does not render, and
    // runs no animation frames, while a view transition holds the previous
    // step on screen, which is exactly when this wait runs.
    pollId = window.setTimeout(check, TARGET_POLL_INTERVAL_MS);
  };

  check();

  return () => {
    window.clearTimeout(timeoutId);
    window.clearTimeout(pollId);
  };
};

/**
 * Pages scroll inside their own layout container, so a target can sit below
 * the fold, or under a prompt docked at the bottom of the page. The tour
 * scrolls it into view before react-tour measures it, and react-tour never
 * scrolls (see TOUR_IN_VIEW_THRESHOLD). A target that fits within the margins
 * is centred unless it already clears them. A taller one moves only when its
 * top, which the popover points at, is out of view: scrolling a tall target
 * whose top shows would only move its top off screen.
 */
export const scrollTargetIntoView = (selector: string) => {
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }
  const { top, bottom, height } = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const fitsWithinMargins = height <= viewportHeight - 2 * TOUR_SCROLL_MARGIN;
  const isOutOfView = fitsWithinMargins
    ? top < TOUR_SCROLL_MARGIN || bottom > viewportHeight - TOUR_SCROLL_MARGIN
    : top < 0 || top > viewportHeight - TOUR_SCROLL_MARGIN;

  if (isOutOfView) {
    target.scrollIntoView({ block: fitsWithinMargins ? 'center' : 'start' });
  }
};

/**
 * react-tour locks page scroll by setting `position`, `overflow` (and a
 * scrollbar `padding-right` on the body) inline on <html> and <body>, and
 * undoes it only on its own close path. The tour also unmounts it on every
 * page change and on finishing, which would leave the page unscrollable.
 */
export const releaseTourPageLock = () => {
  const { documentElement, body } = document;
  documentElement.style.removeProperty('position');
  documentElement.style.removeProperty('overflow');
  body.style.removeProperty('position');
  body.style.removeProperty('overflow');
  body.style.removeProperty('padding-right');
};

/**
 * The selector a step opens on: its own target, or the page when the target
 * is missing. react-tour closes the whole tour when a step's target is missing
 * as it opens, which happens when the target never rendered or went away after
 * it was waited for (a loading skeleton replaced by an empty state).
 */
export const getTourTarget = (selector: string, fallbackSelector: string) =>
  document.querySelector(selector) ? selector : fallbackSelector;

/**
 * react-tour focuses its popover, which is not focusable, so keyboard focus
 * stays on the page behind the mask. Moves it to the step's Next button.
 */
export const focusTourNextButton = () =>
  window.requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        `.${TOUR_HELPER_MARKER_CLASS_NAME} :is([data-tour-elem="right-arrow"], [data-testid="last-step-button"])`
      )
      ?.focus()
  );

/**
 * Leaves the tour with a full page load, at `path` or where the browser is,
 * so nothing the tour's fixtures put in the page's caches outlives it.
 */
export const leaveTour = (path?: string) => {
  if (path === undefined) {
    window.location.reload();
  } else {
    window.location.assign(`${getBasePath()}${path}`);
  }
};

/**
 * Moves the tour to another page inside a view transition: the browser keeps
 * the current step on screen, frozen, while `update` navigates and the next
 * page settles out of sight, then cross-fades to the next step once `isShown`
 * resolves. No blank or loading page is ever on screen. Browsers without view
 * transitions run `update` directly, and the page settles behind the mask.
 */
export const runInViewTransition = (
  update: () => void,
  isShown: Promise<void>
) => {
  if (typeof document.startViewTransition !== 'function') {
    update();

    return;
  }
  const transition = document.startViewTransition(async () => {
    update();
    await Promise.race([
      isShown,
      new Promise((resolve) => setTimeout(resolve, TOUR_TRANSITION_TIMEOUT_MS)),
    ]);
  });
  // A quicker cross-fade than the browser's, so stepping through pages
  // keeps pace with stepping within one.
  transition.ready
    .then(() =>
      document.getAnimations().forEach((animation) => {
        const { effect } = animation;
        if (
          effect instanceof KeyframeEffect &&
          effect.pseudoElement?.startsWith('::view-transition')
        ) {
          effect.updateTiming({ duration: TOUR_TRANSITION_FADE_MS });
        }
      })
    )
    // An aborted transition (another one started, the tab hidden) still
    // applies the update; only its animation is skipped.
    .catch(() => undefined);
  transition.finished.catch(() => undefined);
};
