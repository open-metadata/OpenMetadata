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
import { Locator, Page } from '@playwright/test';
import scenes from '../fixtures/visual/scenarios.json';
import { expect, test } from '../support/fixtures/base';
import { installVisualData, VisualDataState } from './visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
  waitForLineageCanvas,
} from './visualRegression';

interface VisualLocator {
  text?: string;
  testId?: string;
  role?: Parameters<Page['getByRole']>[0];
  name?: string;
  namePattern?: string;
  within?: string;
  has?: VisualLocator;
}

interface VisualAction extends VisualLocator {
  action: 'click' | 'fill' | 'press' | 'check' | 'hover';
  value?: string;
}

interface VisualScene {
  id: string;
  group: string;
  path: string;
  viewport?: { width: number; height: number };
  ready: VisualLocator;
  initialReady?: VisualLocator;
  target?: VisualLocator;
  absent?: VisualLocator[];
  state?: VisualDataState;
  text?: string;
  containsText?: string;
  actions?: VisualAction[];
  paintedLineage?: boolean;
  maxDiffPixelRatio?: number;
}

const locate = (page: Page, locator: VisualLocator): Locator => {
  const scope = locator.within ? page.getByTestId(locator.within) : page;
  let result: Locator;
  if (locator.text) {
    result = scope.getByText(locator.text, { exact: true });
  } else if (locator.testId) {
    result = scope.getByTestId(locator.testId);
  } else if (locator.role) {
    result = scope.getByRole(locator.role, {
      name: locator.namePattern
        ? new RegExp(locator.namePattern)
        : locator.name,
      exact: !locator.namePattern,
    });
  } else {
    throw new Error('A visual checkpoint needs an explicit test ID or role.');
  }

  return locator.has
    ? result.filter({ has: locate(page, locator.has) })
    : result;
};

export const registerVisualScenarios = (group: string) => {
  const scenarios = (scenes as VisualScene[]).filter(
    (scene) => scene.group === group
  );
  for (const theme of VISUAL_THEMES) {
    test.describe(`${group} ${theme}`, { tag: '@Platform' }, () => {
      for (const scene of scenarios) {
        test(scene.id, async ({ page }) => {
          test.setTimeout(60_000);
          const pageErrors: string[] = [];
          page.on('pageerror', (error) => pageErrors.push(error.message));
          if (scene.viewport) await page.setViewportSize(scene.viewport);
          await prepareVisualTheme(page, theme);
          await installVisualData(page, scene.state);
          // Each state gets its own page so settings caches, pending effects,
          // unsaved forms, and open portals cannot affect a later baseline.
          await gotoForScreenshot(page, scene.path, {
            readyTestId: 'app-shell',
          });
          if (scene.initialReady)
            await expect(locate(page, scene.initialReady)).toBeVisible();
          for (const action of scene.actions ?? []) {
            const target = locate(page, action);
            await expect(target).toBeVisible();
            switch (action.action) {
              case 'fill':
                await target.fill(action.value ?? '');
                break;
              case 'press':
                await target.press(action.value ?? 'Enter');
                break;
              case 'check':
                await target.check();
                break;
              case 'hover':
                await target.hover();
                break;
              case 'click':
                await target.click();
                break;
              default:
                throw new Error(
                  `Unsupported visual action: ${JSON.stringify(action)}`
                );
            }
          }
          if (group === 'Entity tabs') {
            const tab = scene.actions?.find((action) => action.role === 'tab');
            if (!tab)
              throw new Error(
                'Entity tab scenarios require an explicit tab action.'
              );
            await expect(locate(page, tab)).toHaveAttribute(
              'aria-selected',
              'true'
            );
          }
          await expect(locate(page, scene.ready)).toBeVisible();
          for (const missing of scene.absent ?? [])
            await expect(locate(page, missing)).toHaveCount(0);
          if (scene.text)
            await expect(locate(page, scene.ready)).toContainText(scene.text);
          if (scene.containsText)
            await expect(
              page.getByText(scene.containsText, { exact: true })
            ).not.toHaveCount(0);
          if (
            scene.state === 'error' &&
            !scene.ready.text &&
            !scene.containsText
          ) {
            throw new Error(
              'Error states require an explicit error feedback checkpoint.'
            );
          }
          if (scene.paintedLineage) await waitForLineageCanvas(page);
          await expectVisualScreenshot(page, scene.id, theme, {
            target: scene.target ? locate(page, scene.target) : undefined,
            allowErrorFeedback: scene.state === 'error',
            ...(scene.maxDiffPixelRatio !== undefined
              ? { maxDiffPixelRatio: scene.maxDiffPixelRatio }
              : {}),
          });
          if (scene.group === 'Forms' && scene.target) {
            // A focused form can omit the slideout header and footer.
            await expectVisualScreenshot(page, `${scene.id}-frame`, theme);
          }
          expect(
            pageErrors,
            'Visual pages must render without runtime errors'
          ).toEqual([]);
        });
      }
    });
  }
};
