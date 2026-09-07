/*
 *  Copyright 2024 Collate.
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

// The teams table keeps reflowing after its loaders clear (async detail counts
// hydrate and shift rows). dragTo snapshots both boxes up front and presses at
// those coordinates, so a drag begun mid-reflow presses on whatever slid into
// the old spot and no dragstart fires. Hold both rows still before pressing.
const waitForStableBox = async (locator: Locator) => {
  let previous: { x: number; y: number } | undefined;

  await expect(async () => {
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();

    const current = { x: box?.x ?? NaN, y: box?.y ?? NaN };
    const held = previous?.x === current.x && previous?.y === current.y;

    previous = current;

    expect(held, 'element is still moving').toBe(true);
  }).toPass({ timeout: 15_000, intervals: [200, 200, 400, 800] });
};

// TableV2 rows drag through react-aria's useDragAndDrop, whose mouse path is the
// native HTML drag-and-drop API — the same one dragTo drives. Manual mouse
// events do not reliably synthesise native drag in headless Chromium, so a real
// dragTo is required. force skips the actionability wait that the row hover
// overlays would otherwise block. Dropping at a row's centre lands "on" it (a
// move under that row); for a root move the caller passes the toolbar selector
// (isHeader) — it sits inside the DropZone but outside the grid, so a drop there
// routes to onRootDrop and moves the team to the table root.
export const dragAndDropElement = async (
  page: Page,
  dragElement: string,
  dropTarget: string,
  isHeader?: boolean
) => {
  const dragElementLocator = page.locator(`[data-row-key="${dragElement}"]`);
  const dropTargetLocator = isHeader
    ? page.locator(dropTarget)
    : page.locator(`[data-row-key="${dropTarget}"]`);

  // A rejection toast lives 60s (ERROR_TOAST_TIMEOUT) and covers the drop row,
  // so dismiss open error toasts rather than wait them out. Only error toasts
  // render a close button; success/info toasts self-dismiss.
  for (const close of await page.getByTestId('alert-icon-close').all()) {
    await close.click().catch(() => undefined);
  }
  await expect(page.getByTestId('alert-icon-close'))
    .toHaveCount(0, { timeout: 10_000 })
    .catch(() => undefined);

  await dragElementLocator.scrollIntoViewIfNeeded();
  await waitForStableBox(dragElementLocator);
  await waitForStableBox(dropTargetLocator);

  await dragElementLocator.dragTo(dropTargetLocator, {
    force: true, // eslint-disable-line playwright/no-force-option -- drag-and-drop requires force due to row hover overlays
    sourcePosition: { x: 10, y: 10 },
  });
};

export const openDragDropDropdown = async (page: Page, name: string) => {
  await page
    .locator(`[data-row-key="${name}"]`)
    .getByTestId('expand-icon')
    .click();
};

export const confirmationDragAndDropTeam = async (
  page: Page,
  dragTeam: string,
  dropTeam: string
) => {
  // Confirmation message before the transfer
  await expect(
    page.locator('[data-testid="confirmation-modal"] .ant-modal-body')
  ).toContainText(
    `Click on Confirm if you’d like to move ${dragTeam} team under ${dropTeam} team.`
  );

  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams/') &&
      response.request().method() === 'PATCH'
  );
  const teamsListResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams?parentTeam=') &&
      response.request().method() === 'GET'
  );
  await page.locator('.ant-modal-footer > .ant-btn-primary').click();
  await patchResponse;
  const teamsListResponseResult = await teamsListResponse;

  expect(teamsListResponseResult.status()).toBe(200);

  await expect(
    page.locator('[data-testid="confirmation-modal"]')
  ).not.toBeVisible();
};
