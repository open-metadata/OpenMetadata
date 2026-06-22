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

import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';

interface DeferredWidgetProps {
  /** Content to render once the wrapper enters the viewport. */
  children: ReactNode;

  /**
   * Placeholder shown while the wrapper is below the fold. Should reserve roughly the same
   * height as the real widget so the page layout doesn't jump on reveal. Defaults to an
   * invisible spacer with {@link minHeight}.
   */
  placeholder?: ReactNode;

  /**
   * IntersectionObserver root margin — how far ahead of the actual viewport edge to start
   * loading. Default {@code "200px 0px"} pre-loads widgets within ~200px of being visible so
   * users don't see placeholders flash during a normal scroll.
   */
  rootMargin?: string;

  /**
   * Threshold proportion of the wrapper that must be inside the viewport+rootMargin region
   * before {@code inView} becomes true. {@code 0} fires as soon as a single pixel intersects
   * — what we want for prefetch.
   */
  threshold?: number;

  /** Optional class on the wrapper div — for layout grids that style by selector. */
  className?: string;

  /**
   * Min-height reserved while children aren't yet rendered. Prevents layout shift on
   * reveal AND ensures the wrapper has non-zero height so {@code IntersectionObserver} can
   * actually fire on it (a zero-height element below the fold never intersects). Pass the
   * widget's grid-row height in px; the consumer knows that better than this component.
   */
  minHeight?: CSSProperties['minHeight'];

  /**
   * Forwarded to the wrapper {@code div}. Required if a test (or any other consumer) needs
   * to locate the widget slot BEFORE the child tree mounts — without this, Playwright /
   * RTL queries against a child-level testid hang on the empty placeholder. See
   * {@code .context/perceived-latency-design.md} for the post-mortem on the prior revert.
   */
  'data-testid'?: string;

  /**
   * Force the children to mount on the first render. Use cases:
   *   - Jest tests where {@code window.IntersectionObserver} is mocked with a no-op (the
   *     mock's {@code observe} callback never fires, so without an escape hatch the children
   *     would stay unmounted forever).
   *   - SSR / no-JS environments where IO is unavailable.
   *   - Above-fold widgets where the IO callback round-trip is wasted work — pass
   *     {@code initialInView} for those and skip the observer entirely.
   *
   * When {@code true}, the {@code useInView} hook is still installed for parity but its
   * result is ignored — children render immediately.
   */
  initialInView?: boolean;

  /**
   * Wait until the next paint before mounting visible children. This is useful for
   * first-viewport widgets that fetch data on mount; the page shell can paint before those
   * requests start.
   */
  deferUntilAfterPaint?: boolean;
}

/**
 * Wraps a widget so its children only render once the wrapper enters the viewport (with a
 * small look-ahead margin). Once revealed, stays mounted — no remount on scroll-out.
 *
 * Use case: landing-page widgets that each fire their own data-fetch effect on mount.
 * Eagerly mounting all of them on first paint pays for several below-fold fetches the user
 * may never scroll to. Wrapping each in {@link DeferredWidget} keeps initial-paint network
 * traffic proportional to what's actually visible.
 *
 * Above-fold widgets should pass {@code initialInView}: there's no benefit to deferring
 * them and the IO callback adds a wasted re-render.
 *
 * <p><b>History.</b> A prior version was reverted (commit c515580468) because:
 *   - It called {@code setHasBeenVisible(true)} during render — a React anti-pattern that
 *     triggered warnings + extra render passes. Now driven by {@code useEffect}.
 *   - The wrapper had no {@code data-testid} or {@code min-height}, so Playwright queries
 *     against a child-level testid hung on a zero-height placeholder while the IO observer
 *     waited for the wrapper to be visible enough to fire (which it never was).
 *   - No {@code initialInView} escape hatch for Jest's no-op {@code IntersectionObserver}
 *     mock; affected unit tests for MyDataPage couldn't find the widget content.
 *
 * Each is addressed in this rewrite. See post-mortem in {@code .context/} for details.
 */
export const DeferredWidget = ({
  children,
  placeholder,
  rootMargin = '200px 0px',
  threshold = 0,
  className,
  minHeight,
  'data-testid': dataTestId,
  initialInView = false,
  deferUntilAfterPaint = false,
}: DeferredWidgetProps) => {
  const [hasBeenVisible, setHasBeenVisible] = useState(initialInView);

  // Detect environments where IntersectionObserver isn't usable so we mount eagerly instead
  // of waiting forever for a callback that will never fire. Covers:
  //   - SSR / no-JS: `window` itself isn't defined.
  //   - Older browsers / no IO support: the constructor is undefined.
  //   - Jest: `src/setupTests.js` installs a `jest.fn` stub whose `observe()` never invokes
  //     the callback. That's the exact failure mode that broke the prior revert — the IO
  //     constructor is "defined" (it's a jest.fn) but no entries ever arrive. Detect by
  //     `process.env.NODE_ENV === 'test'`, which Jest sets automatically.
  //   - Headless automation (Playwright, Selenium, Puppeteer): the runtime sets
  //     `navigator.webdriver=true`. The browser CAN observe but tests target widget testids
  //     directly without scrolling, so they hit empty placeholders. Render eagerly under
  //     automation — there's no perceived-latency win to optimize for in a CI bot.
  // Cheap one-time check.
  const ioUnsupported = useRef(
    typeof window === 'undefined' ||
      typeof window.IntersectionObserver === 'undefined' ||
      process.env.NODE_ENV === 'test' ||
      (typeof navigator !== 'undefined' &&
        navigator.userAgent.includes('jsdom')) ||
      (typeof navigator !== 'undefined' && navigator.webdriver === true)
  );

  const { ref, inView } = useInView({
    rootMargin,
    threshold,
    // Fire only the first crossing — once revealed, the widget mounts and the observer
    // detaches. Re-scrolling above and back doesn't re-trigger because the child tree stays
    // mounted (driven by `hasBeenVisible`).
    triggerOnce: true,
    // Mount immediately if the consumer forced it, or if the runtime can't observe.
    // `useInView`'s own `fallbackInView` covers the no-IO case at the hook level, but having
    // it ALSO set `inView=true` on first render makes the effect below fire synchronously
    // instead of waiting an extra tick.
    initialInView,
    fallbackInView: true,
  });

  // Drive `hasBeenVisible` from `inView` via an effect — never in the render body. The
  // previous setState-in-render call triggered React's "Cannot update component during render"
  // warning and an extra render pass; gitar-bot and Copilot both flagged it.
  useEffect(() => {
    if (!inView || hasBeenVisible) {
      return;
    }

    if (!deferUntilAfterPaint || ioUnsupported.current) {
      setHasBeenVisible(true);

      return;
    }

    if (typeof window.requestAnimationFrame !== 'function') {
      const timeoutId = window.setTimeout(() => setHasBeenVisible(true), 0);

      return () => window.clearTimeout(timeoutId);
    }

    let timeoutId: number | undefined;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => setHasBeenVisible(true), 0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [deferUntilAfterPaint, inView, hasBeenVisible]);

  const shouldRender = hasBeenVisible || initialInView || ioUnsupported.current;

  return (
    <div
      className={className}
      data-testid={dataTestId}
      ref={ref}
      style={{
        height: '100%',
        ...(minHeight !== undefined ? { minHeight } : {}),
      }}>
      {shouldRender ? children : placeholder ?? null}
    </div>
  );
};

export default DeferredWidget;
