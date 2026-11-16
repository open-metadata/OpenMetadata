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
import { expect, Locator, Page } from '@playwright/test';
import { resolve } from 'path';
import {
  disableAiAppMode,
  enableAiAppMode,
  stubUserPreferencesAppMode,
} from '../e2e/Utils/appMode';
import { waitForAllLoadersToDisappear } from './entity';
import { waitForPageLoaded } from './polling';
import { assertVisualReadFixtures } from './visualData';

export const VISUAL_THEMES = ['light', 'dark'] as const;
export type VisualTheme = (typeof VISUAL_THEMES)[number];

export const prepareVisualTheme = async (
  page: Page,
  theme: VisualTheme,
  mode: 'ai' | 'classic' = 'ai'
) => {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((preference) => {
    localStorage.setItem('ui-theme', preference);
  }, theme);
  if (mode === 'ai') {
    await enableAiAppMode(page);
  } else {
    await disableAiAppMode(page);
    await stubUserPreferencesAppMode(page, 'classic');
  }
};

/**
 * Wait out skeleton placeholders.
 *
 * `waitForPageLoaded` clears loader *spinners*, which is a different thing: a
 * widget that renders `<Skeleton />` while its query is in flight shows no
 * spinner, so the page reads as settled while half of it is still grey blocks.
 * A screenshot taken then records the skeletons, and the baseline only matches
 * while the next run is equally slow — which is how `data-quality.png` came to
 * hold a half-loaded page.
 *
 * Matched on the class rather than a testid because core-components' `Skeleton`
 * exposes none; `tw:animate-pulse` is what it always renders, and the substring
 * match sidesteps escaping the `tw:` prefix in a CSS selector.
 */
const waitForSkeletonsToResolve = async (page: Page) => {
  await expect
    .poll(() => page.locator('[class*="animate-pulse"]').count(), {
      timeout: 30_000,
      message:
        'Skeleton placeholders never resolved, so the screenshot would have recorded a half-loaded page',
    })
    .toBe(0);
};

export const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z');

const waitForPieChartsToPaint = async (page: Page) => {
  for (const chart of await page.locator('.custom-pie-chart:visible').all()) {
    // ECharts animates with JavaScript; screenshot CSS animation controls do
    // not finish its sweep. Require a full outer loop before capture.
    await expect
      .poll(() =>
        chart.locator('svg path').evaluateAll((paths: SVGPathElement[]) =>
          paths.some((path) => {
            const svg = path.ownerSVGElement;
            if (!svg || !path.getAttribute('d')) return false;
            const length = path.getTotalLength();
            if (!length) return false;
            const start = path.getPointAtLength(0);
            // CustomPieChart centers its SVG track at 50% in both dimensions.
            const radius = Math.hypot(
              start.x - svg.width.baseVal.value / 2,
              start.y - svg.height.baseVal.value / 2
            );
            if (!radius) return false;
            const circumference = 2 * Math.PI * radius;
            const end = path.getPointAtLength(circumference);

            return (
              length > circumference &&
              Math.hypot(start.x - end.x, start.y - end.y) < 0.1
            );
          })
        )
      )
      .toBe(true);
  }
};

const waitForChartGeometryToSettle = async (page: Page) => {
  // SVG sweeps and resize work can outlive React's loaders, especially after
  // collapsing the sidebar. Compare real frames so a temporary bar cap or
  // clip path cannot become a baseline merely because two screenshots match.
  for (const chart of await page.locator('.echarts-for-react:visible').all()) {
    await expect
      .poll(async () => {
        const before = await chart
          .locator('svg')
          .evaluateAll((elements) =>
            elements.map((element) => element.outerHTML)
          );
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              );
            })
        );
        const after = await chart
          .locator('svg')
          .evaluateAll((elements) =>
            elements.map((element) => element.outerHTML)
          );

        return (
          before.length > 0 && JSON.stringify(before) === JSON.stringify(after)
        );
      })
      .toBe(true);
  }
};

const waitForCanvasPaint = async (canvases: Locator, message: string) => {
  await expect(canvases).not.toHaveCount(0);
  await expect
    .poll(
      () =>
        canvases.evaluateAll((elements: HTMLCanvasElement[]) =>
          elements.some((element) => {
            if (
              !element.width ||
              !element.height ||
              !element.getClientRects().length
            )
              return false;
            const pixels = element
              .getContext('2d')
              ?.getImageData(0, 0, element.width, element.height).data;

            return (
              pixels?.some((alpha, index) => index % 4 === 3 && alpha > 0) ??
              false
            );
          })
        ),
      { message }
    )
    .toBe(true);
};

export const waitForLineageCanvas = async (page: Page) => {
  // Connections are painted independently of React Flow's DOM nodes.
  await waitForCanvasPaint(
    page.getByTestId('rf__wrapper').locator('.lineage-canvas-container canvas'),
    'Lineage connections must finish painting before capture'
  );
};

export const waitForOntologyCanvas = async (page: Page) => {
  // The graph uses several canvas layers, including empty interaction layers.
  // Its toolbar can mount before any layer has drawn the graph itself.
  await waitForCanvasPaint(
    page.getByTestId('ontology-explorer').locator('canvas'),
    'Ontology nodes must finish painting before capture'
  );
};
/** Shared options for every toHaveScreenshot assertion in the visual suite. */
export const SCREENSHOT_OPTS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.01,
  // This footer uses React Query's client-side completion timestamp, not an API
  // date. Its elapsed-time text varies with fetch/render speed even with fixtures.
  // Preserve the footer and action layout while excluding only that live label.
  stylePath: resolve(__dirname, '../fixtures/visual/screenshot.css'),
};

// Scroll behaviour only. `animation: none` used to live here too, but rc-motion
// drives every Ant overlay off animationend: suppressing the animation leaves
// the dropdown stuck with `pointer-events: none`, so a trusted click falls
// through to whatever is underneath. toHaveScreenshot already pins animations
// at capture time via SCREENSHOT_OPTS, so freezing them here bought nothing and
// cost every interactive baseline a dispatchEvent workaround.
const FREEZE_CSS = `
  * { scroll-behavior: auto !important; }
`;

/**
 * Anchor the browser date while allowing elapsed time during interactions.
 *
 * The shared page-loaded guard waits for DOM content and loader spinners.
 * Network-idle waits cannot settle reliably while catalog polling is active.
 */
export const gotoForScreenshot = async (
  page: Page,
  path: string,
  { readyTestId }: { readyTestId?: string } = {}
) => {
  // Lodash debounce compares successive Date.now() readings. A fixed Date
  // with running timers continually reschedules it, so search never completes.
  await page.clock.setSystemTime(FIXED_DATE);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForPageLoaded(page);
  // Lazily mounted routes (the AI shell's pages) can pass the loader and
  // skeleton checks before their content exists at all, recording a blank
  // page. Waiting for an element the page always renders closes that gap.
  if (readyTestId) {
    await expect(page.getByTestId(readyTestId)).toBeVisible();
  }
  await waitForSkeletonsToResolve(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.scrollingElement ?? document.documentElement).scrollTo(0, 0);
    // Entity pages and drawers can scroll independently of the document.
    document
      .querySelectorAll<HTMLElement>('body, body *')
      .forEach((element) => {
        if (element.scrollTop || element.scrollLeft) {
          element.scrollTo(0, 0);
        }
      });
  });
};

export const expectVisualScreenshot = async (
  page: Page,
  name: string,
  theme: VisualTheme,
  options: NonNullable<
    Parameters<ReturnType<typeof expect<Page>>['toHaveScreenshot']>[0]
  > & { target?: Locator; allowErrorFeedback?: boolean } = {}
) => {
  assertVisualReadFixtures();
  // Classic deliberately resolves dark preferences to light. Requiring the
  // actual root theme prevents a duplicate light image from claiming dark coverage.
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/\bdark-mode\b/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/\bdark-mode\b/);
  }
  await waitForAllLoadersToDisappear(page);
  await waitForSkeletonsToResolve(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await waitForPieChartsToPaint(page);
  await waitForChartGeometryToSettle(page);
  // Keep the anchored clock advancing: React can replace chart options while
  // the assertion settles, and a fixed Date would freeze the new sweep at zero.
  const {
    target = page,
    allowErrorFeedback = false,
    ...screenshotOptions
  } = options;
  // An unmodeled API must fail even if its notification arrives after readiness.
  assertVisualReadFixtures();
  if (!allowErrorFeedback) {
    await expect(
      page.getByRole('alertdialog'),
      'Resolved visual pages must not contain an error notification'
    ).toHaveCount(0);
    await expect(
      page.getByText('Something went wrong', { exact: true })
    ).toHaveCount(0);
    await expect(page.getByText(/^Error while fetching/)).toHaveCount(0);
    await expect(page.getByText(/^(NaN|Invalid date)$/i)).toHaveCount(0);
  }

  await expect(target).toHaveScreenshot(
    `${name}${theme === 'dark' ? '-dark' : ''}.png`,
    {
      ...SCREENSHOT_OPTS,
      ...screenshotOptions,
    }
  );
  assertVisualReadFixtures();
  if (!allowErrorFeedback) {
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
};

export const withFullVisualTarget = async <T>(
  page: Page,
  target: Locator,
  capture: () => Promise<T>
): Promise<T> => {
  const originalViewport = page.viewportSize();
  if (!originalViewport)
    throw new Error('Full-target captures require an explicit viewport.');

  let height = originalViewport.height;
  try {
    // Screenshot animation stabilization can enlarge an accordion after sizing;
    // wait for the target's real layout to settle before measuring its clips.
    await target.scrollIntoViewIfNeeded();
    for (let attempt = 0; attempt < 4; attempt++) {
      const clipped = await target.evaluate((element) => {
        // Locator screenshots can include thousands of blank pixels when a
        // scrolling ancestor clips the target. Reveal it using real layout,
        // preserving the tested width and the component's production styles.
        for (
          let parent: Element | null = element;
          parent;
          parent = parent.parentElement
        ) {
          parent.scrollTop = 0;
          parent.scrollLeft = 0;
        }
        const rectangle = element.getBoundingClientRect();
        let top = 0;
        let bottom = window.innerHeight;
        let left = 0;
        let right = window.innerWidth;
        const clips = (value: string) =>
          /^(auto|scroll|hidden|clip)$/.test(value);
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          const bounds = parent.getBoundingClientRect();
          if (clips(style.overflowY)) {
            top = Math.max(top, bounds.top + parent.clientTop);
            bottom = Math.min(
              bottom,
              bounds.top + parent.clientTop + parent.clientHeight
            );
          }
          if (clips(style.overflowX)) {
            left = Math.max(left, bounds.left + parent.clientLeft);
            right = Math.min(
              right,
              bounds.left + parent.clientLeft + parent.clientWidth
            );
          }
        }
        const ownStyle = getComputedStyle(element);
        return {
          vertical:
            Math.max(0, top - rectangle.top) +
            Math.max(0, rectangle.bottom - bottom) +
            (clips(ownStyle.overflowY)
              ? Math.max(0, element.scrollHeight - element.clientHeight)
              : 0),
          horizontal:
            Math.max(0, left - rectangle.left) +
            Math.max(0, rectangle.right - right) +
            (clips(ownStyle.overflowX)
              ? Math.max(0, element.scrollWidth - element.clientWidth)
              : 0),
        };
      });
      if (clipped.vertical <= 1 && clipped.horizontal <= 1)
        return await capture();
      if (clipped.horizontal > 1 || attempt === 3) break;
      height += Math.ceil(clipped.vertical) + 2;
      // Bound raster memory on CI workers; oversized or fixed-height panels
      // must fail explicitly rather than accepting an image of clipped content.
      if (height > 16_000) break;
      await page.setViewportSize({ width: originalViewport.width, height });
    }
    throw new Error('Viewport resizing cannot reveal the full visual target.');
  } finally {
    if (!page.isClosed()) await page.setViewportSize(originalViewport);
  }
};
