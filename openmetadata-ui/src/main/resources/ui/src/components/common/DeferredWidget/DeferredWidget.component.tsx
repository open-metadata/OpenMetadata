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

import { ReactNode, useState } from 'react';
import { useInView } from 'react-intersection-observer';

interface DeferredWidgetProps {
  /** Content to render once the wrapper enters the viewport. */
  children: ReactNode;

  /**
   * Placeholder shown while the wrapper is below the fold. Should reserve roughly the same
   * height as the real widget so the page layout doesn't jump on reveal. Defaults to an
   * invisible spacer — supply a skeleton if the widget is tall.
   */
  placeholder?: ReactNode;

  /**
   * IntersectionObserver root margin — how far ahead of the actual viewport edge to start
   * loading. Default {@code "200px 0px"} pre-loads widgets that are within ~200px of being
   * visible so users don't see placeholders flash during a normal scroll.
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
}

/**
 * Wraps a widget so its children only render once the wrapper enters the viewport (with a
 * small look-ahead margin). Once revealed, it stays mounted — no remount on scroll-out.
 *
 * Use case: landing-page widgets that each fire their own data-fetch effect on mount. Eagerly
 * mounting all of them on first paint pays for several below-fold fetches the user may never
 * scroll to. Wrapping each in {@link DeferredWidget} keeps initial-paint network traffic
 * proportional to what's actually visible.
 *
 * Caveat: if the user has very tall screens where the entire grid is above the fold, every
 * widget mounts immediately and this is a no-op (correct behavior — no over-optimization for
 * the rare-case).
 */
export const DeferredWidget = ({
  children,
  placeholder,
  rootMargin = '200px 0px',
  threshold = 0,
  className,
}: DeferredWidgetProps) => {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  const { ref, inView } = useInView({
    rootMargin,
    threshold,
    // Fire only the first crossing into view — once revealed, the widget mounts and the
    // observer detaches. Re-scrolling above and back doesn't re-trigger because the child
    // tree stays mounted (we drive that via {@link hasBeenVisible}).
    triggerOnce: true,
  });

  if (inView && !hasBeenVisible) {
    setHasBeenVisible(true);
  }

  return (
    <div className={className} ref={ref}>
      {hasBeenVisible ? children : placeholder ?? null}
    </div>
  );
};

export default DeferredWidget;
