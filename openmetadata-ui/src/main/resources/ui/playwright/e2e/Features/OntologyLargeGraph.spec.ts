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
import { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/isolatedUser';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
} from '../../utils/common';
import {
  createLargeOntology,
  LargeOntologyFixture,
  listConceptIds,
  openLargeOntology,
  readGraphVisibility,
  setAppMode,
} from '../../utils/ontologyLargeGraph';
import { readNodePositions } from '../../utils/ontologyStudio';

test.use({ isolatedUserOptions: { isAdmin: true } });

const APP_MODES = ['ai', 'classic'] as const;
// The node limit above which the graph draws a neighbourhood, from OntologyExplorer.constants.
const NODE_LIMIT = 500;

const findBox = (page: Page) => page.getByTestId('ontology-graph-search');
const panel = (page: Page) => page.getByTestId('ontology-concept-inspector');
const nodeList = (page: Page, count: number) =>
  page.getByRole('listbox', { name: `Concepts (${count})` });

const withFixture = async (
  count: number,
  body: (fixture: LargeOntologyFixture, api: APIRequestContext) => Promise<void>
) => {
  const api = await getWorkerAdminAPIContext();
  const fixture = await createLargeOntology(api, count);
  try {
    await body(fixture, api);
  } finally {
    await fixture.cleanup();
  }
};

const expectNodesDrawn = async (page: Page, total: number) => {
  await expect
    .poll(async () => (await readGraphVisibility(page)).visible, {
      message: 'nodes inside the canvas',
      timeout: 15_000,
    })
    .toBe(total);
};

const pressUntilFocused = async (
  page: Page,
  target: Locator,
  key = 'Tab',
  limit = 150
) => {
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press(key);
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return step + 1;
    }
  }
  throw new Error(`Focus never reached the target after ${limit} presses`);
};

test.describe(
  'Large ontology graph and keyboard route',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of APP_MODES) {
      test(`shows every node of a 400 concept ontology and keeps them all after Fit in ${mode} mode`, async ({
        isolatedUser,
        isolatedUserPage: page,
      }) => {
        test.slow();
        await withFixture(400, async (fixture, api) => {
          await setAppMode(api, isolatedUser.responseData.id, mode);
          await openLargeOntology(page, fixture);

          await expectNodesDrawn(page, 400);
          const loaded = await readGraphVisibility(page);
          expect(loaded.total).toBe(400);
          expect(loaded.zoom).toBeGreaterThan(0.05);

          await page.getByRole('button', { name: 'Fit to screen' }).click();
          await expectNodesDrawn(page, 400);
          const fitted = await readGraphVisibility(page);
          expect(fitted.zoom).toBeGreaterThan(0.05);
          await page.screenshot({
            path: test.info().outputPath(`g14-big-${mode}.png`),
          });
        });
      });

      test(`opens a concept from the Find result list with Enter in ${mode} mode`, async ({
        isolatedUser,
        isolatedUserPage: page,
      }) => {
        test.slow();
        await withFixture(400, async (fixture, api) => {
          await setAppMode(api, isolatedUser.responseData.id, mode);
          await openLargeOntology(page, fixture);
          await expectNodesDrawn(page, 400);

          await findBox(page).fill('Concept 39');

          const results = page.getByTestId('ontology-graph-search-results');
          await expect(results).toBeVisible();
          const labels = await results.getByRole('option').allTextContents();
          expect(labels[0]).toBe('Concept 39');
          expect(labels.length).toBeGreaterThan(1);
          await findBox(page).press('Enter');

          await expect(panel(page)).toContainText('Concept 39');
          await expect(results).toBeHidden();
          await page.screenshot({
            path: test.info().outputPath(`g14-find-${mode}.png`),
          });
        });
      });

      test(`gives the canvas no tab stop and reaches the node list in ${mode} mode`, async ({
        isolatedUser,
        isolatedUserPage: page,
      }) => {
        test.slow();
        await withFixture(400, async (fixture, api) => {
          await setAppMode(api, isolatedUser.responseData.id, mode);
          await openLargeOntology(page, fixture);
          await expectNodesDrawn(page, 400);
          await expect(page.locator('canvas[tabindex]')).toHaveCount(0);

          await page.evaluate(() =>
            (document.activeElement as HTMLElement)?.blur()
          );
          const stops: { tag: string; tabindex: string | null }[] = [];
          const list = nodeList(page, 400);
          let reached = false;
          for (let step = 0; step < 150 && !reached; step++) {
            await page.keyboard.press('Tab');
            stops.push(
              await page.evaluate(() => ({
                tag: document.activeElement?.tagName ?? '',
                tabindex:
                  document.activeElement?.getAttribute('tabindex') ?? null,
              }))
            );
            reached = await list.evaluate(
              (element) => element === document.activeElement
            );
          }

          expect(reached).toBe(true);
          expect(stops.map(({ tag }) => tag)).not.toContain('CANVAS');
          stops.forEach(({ tabindex }) => {
            expect(Number(tabindex ?? 0)).toBeLessThanOrEqual(0);
          });
          expect(stops.length).toBeGreaterThan(1);
          await page.screenshot({
            path: test.info().outputPath(`g14-tab-${mode}.png`),
          });
        });
      });

      test(`opens a concept from the node list and returns focus to it on Escape in ${mode} mode`, async ({
        isolatedUser,
        isolatedUserPage: page,
      }) => {
        test.slow();
        await withFixture(400, async (fixture, api) => {
          await setAppMode(api, isolatedUser.responseData.id, mode);
          await openLargeOntology(page, fixture);
          await expectNodesDrawn(page, 400);
          const list = nodeList(page, 400);

          await pressUntilFocused(page, list);
          await expect(
            list.getByRole('option', { name: 'Concept 0', exact: true })
          ).toBeVisible();
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');

          await expect(panel(page)).toContainText('Concept 1');
          await page.keyboard.press('Escape');

          await expect(panel(page)).toBeHidden();
          await expect(list).toBeFocused();
          await page.screenshot({
            path: test.info().outputPath(`g14-escape-${mode}.png`),
          });
        });
      });

      test(`returns focus to the Find box after a concept opened from it is closed in ${mode} mode`, async ({
        isolatedUser,
        isolatedUserPage: page,
      }) => {
        test.slow();
        await withFixture(50, async (fixture, api) => {
          await setAppMode(api, isolatedUser.responseData.id, mode);
          await openLargeOntology(page, fixture);
          await expectNodesDrawn(page, 50);

          await findBox(page).fill('Concept 7');
          await findBox(page).press('Enter');
          await expect(panel(page)).toContainText('Concept 7');
          await panel(page).getByRole('button', { name: 'Close' }).focus();
          await page.keyboard.press('Escape');
          // A focused icon button shows a tooltip, and its first Escape only closes that.
          if (await panel(page).isVisible()) {
            await page.keyboard.press('Escape');
          }

          await expect(panel(page)).toBeHidden();
          await expect(findBox(page)).toBeFocused();
        });
      });
    }

    test('closes the panel on Escape pressed in the Find box after a result opened', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      await withFixture(50, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        await openLargeOntology(page, fixture);
        await expectNodesDrawn(page, 50);

        await findBox(page).fill('Concept 7');
        await findBox(page).press('Enter');
        await expect(panel(page)).toContainText('Concept 7');
        await findBox(page).press('Escape');

        await expect(panel(page)).toBeHidden();
      });
    });

    test('shows nodes or the focused-view message at 50, 400 and 2,000 concepts, never a blank canvas', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.setTimeout(240_000);
      const api = await getWorkerAdminAPIContext();
      await setAppMode(api, isolatedUser.responseData.id, 'ai');
      for (const count of [50, 400, 2000]) {
        await test.step(`${count} concepts`, async () => {
          const fixture = await createLargeOntology(api, count);
          try {
            await openLargeOntology(page, fixture);
            if (count <= NODE_LIMIT) {
              await expectNodesDrawn(page, count);

              return;
            }
            const notice = page.getByTestId('ontology-graph-too-large');
            await expect(notice).toContainText('too many to draw at once');
            await expect(notice).toContainText('2000');
            await expect(
              notice.getByTestId('ontology-graph-concept-picker')
            ).toBeVisible();
            await expect(page.locator('.ontology-g6-container')).toHaveCount(0);
            await page.screenshot({
              path: test.info().outputPath('g14-sizes-2000.png'),
            });
          } finally {
            await fixture.cleanup();
          }
        });
      }
    });

    test('draws the neighbourhood of a concept found in a 2,000 concept ontology and offers Tree', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.setTimeout(180_000);
      await withFixture(2000, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        await openLargeOntology(page, fixture);
        await expect(
          page.getByTestId('ontology-graph-too-large')
        ).toBeVisible();

        await findBox(page).fill('Concept 1000');
        await findBox(page).press('Enter');

        await expect(
          page.getByTestId('ontology-graph-focused-notice')
        ).toContainText('Showing');
        await expect
          .poll(async () => (await readGraphVisibility(page)).visible, {
            timeout: 15_000,
          })
          .toBeGreaterThan(5);
        const drawn = await readGraphVisibility(page);
        expect(drawn.total).toBeLessThanOrEqual(120);
        expect(drawn.visible).toBe(drawn.total);

        await page.getByTestId('ontology-graph-open-tree').click();
        await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
      });
    });

    test('draws the neighbourhood of a concept picked from the too-large state', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.setTimeout(180_000);
      await withFixture(2000, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        await openLargeOntology(page, fixture);
        await page.getByTestId('ontology-graph-concept-picker').click();
        await page
          .getByTestId('ontology-graph-concept-picker-search')
          .fill('Concept 1000');
        await page.getByRole('option', { name: /^Concept 1000(?!\d)/ }).click();

        await expect(page.getByTestId('ontology-graph-too-large')).toHaveCount(
          0
        );
        await expect(
          page.getByTestId('ontology-graph-focused-notice')
        ).toContainText('Showing');
        await expect
          .poll(async () => (await readGraphVisibility(page)).visible, {
            timeout: 15_000,
          })
          .toBeGreaterThan(1);
      });
    });

    test('keeps the selected concept visible beside the panel through Fit and zoom', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.slow();
      await withFixture(400, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        const ids = await listConceptIds(api, fixture.ontology);
        await openLargeOntology(page, fixture);
        await expectNodesDrawn(page, 400);
        const selectedId = ids.get('Concept 120') ?? '';
        const positions = await readNodePositions(page);

        await page.mouse.click(
          positions[selectedId].x,
          positions[selectedId].y
        );

        await expect(panel(page)).toContainText('Concept 120');
        const beside = async () => {
          const box = await readGraphVisibility(page);
          const node = (await readNodePositions(page))[selectedId];
          const panelBox = await panel(page).boundingBox();

          return {
            insideCanvas:
              node.x >= box.canvas.left &&
              node.x <= box.canvas.left + box.canvas.width &&
              node.y >= box.canvas.top &&
              node.y <= box.canvas.top + box.canvas.height,
            leftOfPanel: node.x < (panelBox?.x ?? 0),
          };
        };
        await expect
          .poll(beside)
          .toEqual({ insideCanvas: true, leftOfPanel: true });
        // With the drawer open the canvas toolbar centres in the narrowed canvas and sits
        // over the zoom controls, so they are pressed from the keyboard like a user would.
        await clickIgnoringToasts(
          page.getByRole('button', { name: 'Fit to screen' })
        );
        await expect
          .poll(beside)
          .toEqual({ insideCanvas: true, leftOfPanel: true });
        await expectNodesDrawn(page, 400);
        await clickIgnoringToasts(
          page.getByRole('button', { name: 'Zoom In' })
        );
        await expect
          .poll(beside)
          .toEqual({ insideCanvas: true, leftOfPanel: true });
        await page.screenshot({
          path: test.info().outputPath('g14-focus.png'),
        });
      });
    });

    test('lists every concept in Tree with one selected and walks them with the arrow keys', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.slow();
      await withFixture(400, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        const ids = await listConceptIds(api, fixture.ontology);
        await openLargeOntology(page, fixture, ids.get('Concept 399'));
        await page.getByTestId('submode-tab-tree').click();

        // Past 200 rows the tree mounts only the rows on screen; the keyboard below still reaches
        // the last of the 400.
        const rows = page.getByRole('treegrid').getByRole('row');
        await expect(rows).not.toHaveCount(0);
        expect(await rows.count()).toBeLessThan(400);
        await expect(
          page.getByTestId(`ontology-tree-term-${ids.get('Concept 0')}`)
        ).toBeVisible();

        const rowOf = (label: string) =>
          page.getByTestId(`ontology-tree-term-${ids.get(label)}`);
        await rowOf('Concept 0').focus();
        await page.keyboard.press('ArrowDown');
        await expect(rowOf('Concept 1')).toBeFocused();
        await page.keyboard.press('End');
        // The tree lists parents before children, so the last row is the last leaf of the last branch.
        await expect(rowOf('Concept 340')).toBeFocused();
        await page.keyboard.press('Home');
        await expect(rowOf('Concept 0')).toBeFocused();
        await page.screenshot({ path: test.info().outputPath('g14-tree.png') });
      });
    });

    test('keeps a usable canvas and the whole Find box at 1024 pixels with the panel open', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.slow();
      await withFixture(400, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        await page.setViewportSize({ width: 1024, height: 900 });
        await openLargeOntology(page, fixture);
        await expectNodesDrawn(page, 400);

        const list = nodeList(page, 400);
        await pressUntilFocused(page, list);
        await page.keyboard.press('Enter');
        await expect(panel(page)).toContainText('Concept 0');

        // ADR:2026-11-12-ontology-studio-drawers-are-40vw-with-a-420px-floor: at 1024px the
        // 420px drawer leaves too little canvas for all 400 nodes, so the selection is what
        // stays in view beside it; the whole Find box is back once the panel closes.
        const selectedId =
          (await listConceptIds(api, fixture.ontology)).get('Concept 0') ?? '';
        await expect
          .poll(async () => {
            const { canvas } = await readGraphVisibility(page);
            const node = (await readNodePositions(page))[selectedId];
            const panelBox = await panel(page).boundingBox();

            return (
              Boolean(node) &&
              node.x >= canvas.left &&
              node.x < (panelBox?.x ?? 0)
            );
          })
          .toBe(true);
        await page.keyboard.press('Escape');
        await expect(panel(page)).toBeHidden();
        const find = await findBox(page).boundingBox();
        expect(find?.width).toBeGreaterThanOrEqual(150);
        expect((find?.x ?? 0) + (find?.width ?? 0)).toBeLessThanOrEqual(1024);
        await page.screenshot({
          path: test.info().outputPath('g14-narrow.png'),
        });
      });
    });

    test('draws readable nodes and edges in dark mode', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.slow();
      await withFixture(400, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        await page.addInitScript(() =>
          localStorage.setItem('ui-theme', 'dark')
        );
        await openLargeOntology(page, fixture);

        await expectNodesDrawn(page, 400);
        const luminance = await page.evaluate(() => {
          const [red, green, blue] = getComputedStyle(document.body)
            .backgroundColor.match(/\d+/g)!
            .map(Number);

          return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        });
        await expect(page.locator('html')).toHaveClass(/dark-mode/);
        expect(luminance).toBeLessThan(0.3);
        await page.screenshot({ path: test.info().outputPath('g14-dark.png') });
      });
    });

    test('keeps a small ontology readable at full size and still authorable', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.slow();
      await withFixture(8, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        await openLargeOntology(page, fixture);
        await expectNodesDrawn(page, 8);
        const view = await readGraphVisibility(page);
        expect(view.zoom).toBeGreaterThan(0.5);
        expect(view.zoom).toBeLessThanOrEqual(1);

        await page.getByTestId('mode-tab-edit').click();
        await expectNodesDrawn(page, 8);
        const addConcept = page.getByTestId('ontology-add-concept');
        await expect(addConcept).toBeEnabled();
        await addConcept.click();
        await expect(
          page.getByTestId('ontology-new-class-panel')
        ).toBeVisible();
        await page.getByTestId('new-class-label').fill('Late arrival');
        await expect(page.getByTestId('new-class-create')).toBeEnabled();
        await page.screenshot({
          path: test.info().outputPath('g14-small.png'),
        });
      });
    });

    test('shows every concept in Tree when the selection sits late in a small ontology', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      test.slow();
      await withFixture(8, async (fixture, api) => {
        await setAppMode(api, isolatedUser.responseData.id, 'ai');
        const ids = await listConceptIds(api, fixture.ontology);
        await openLargeOntology(page, fixture, ids.get('Concept 7'));
        await page.getByTestId('submode-tab-tree').click();

        await expect(page.getByRole('treegrid').getByRole('row')).toHaveCount(
          8
        );
        await expect(page.getByTestId('ontology-tree-previous')).toHaveCount(0);
      });
    });
  }
);
