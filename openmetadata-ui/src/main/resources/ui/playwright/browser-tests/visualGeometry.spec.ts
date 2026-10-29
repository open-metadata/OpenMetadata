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
import { expect, test } from '../support/fixtures/base';
import { withFullVisualTarget } from '../utils/visualRegression';

const formMarkup = (fixed = false) => `
  <style>
    body { margin: 0; }
    main { height: 100vh; display: flex; flex-direction: column; }
    header, footer { height: 80px; flex: 0 0 auto; }
    section { min-height: 0; flex: 1; overflow: auto; ${
      fixed ? 'max-height: 200px;' : ''
    } }
    form { height: 1800px; display: flex; flex-direction: column; margin: 0; }
    [data-testid=bottom] { margin-top: auto; }
  </style>
  <main><header>Connection setup</header><section><form data-testid="form">
    <div data-testid="top">Connection credentials</div>
    <div data-testid="bottom">Advanced connection settings</div>
  </form></section><footer>Test connection</footer></main>`;

test('full-target captures reveal both ends of a scrolling form without changing width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.setContent(formMarkup());
  await expect(page.getByTestId('bottom')).not.toBeInViewport();
  await withFullVisualTarget(page, page.getByTestId('form'), async () => {
    await expect(page.getByTestId('top')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('bottom')).toBeInViewport({ ratio: 1 });
    expect(page.viewportSize()?.width).toBe(1000);
  });
  expect(page.viewportSize()).toEqual({ width: 1000, height: 700 });
});

test('a failed capture restores the original viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.setContent(formMarkup());
  await expect(
    withFullVisualTarget(page, page.getByTestId('form'), async () => {
      await expect(page.getByTestId('bottom')).toBeInViewport({ ratio: 1 });
      throw new Error('Capture failed');
    })
  ).rejects.toThrow('Capture failed');
  expect(page.viewportSize()).toEqual({ width: 900, height: 600 });
});

test('a fixed-height clipping parent cannot produce a misleading full-target capture', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.setContent(formMarkup(true));
  await expect(
    withFullVisualTarget(page, page.getByTestId('form'), async () => {
      throw new Error('Clipped content reached capture');
    })
  ).rejects.toThrow('cannot reveal the full visual target');
  expect(page.viewportSize()).toEqual({ width: 900, height: 600 });
});

test('expanding forms fit at their final animated height', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.setContent(
    formMarkup() +
      '<style>form { height: 200px; transition: height 300ms; }</style>'
  );
  await page.getByTestId('form').evaluate((element) => {
    // Flush the collapsed layout so the browser creates a real transition.
    element.getBoundingClientRect();
    element.style.height = '1800px';
  });
  await withFullVisualTarget(page, page.getByTestId('form'), async () => {
    // Screenshot stabilization completes transitions before drawing pixels.
    await page.screenshot({ animations: 'disabled' });
    await expect(page.getByTestId('bottom')).toBeInViewport({ ratio: 1 });
  });
});

test('a target cannot hide its own horizontal content in a full-target capture', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.setContent(
    '<form data-testid="form" style="width:300px;overflow:hidden"><div style="width:600px">A wide connection field</div></form>'
  );
  await expect(
    withFullVisualTarget(page, page.getByTestId('form'), async () => {
      throw new Error('Clipped content reached capture');
    })
  ).rejects.toThrow('cannot reveal the full visual target');
  expect(page.viewportSize()).toEqual({ width: 900, height: 600 });
});
