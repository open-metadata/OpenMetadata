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

// dragTo snapshots both boxes up front and presses at those coordinates, so a
// drag begun while the page is still reflowing presses on whatever slid into
// the old spot and no dragstart fires. Hold both elements still before pressing.
export const waitForStableBox = async (locator: Locator) => {
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

  // Ensure the element is draggable
  const draggable = await dragElementLocator.getAttribute('draggable');
  if (draggable !== 'true') {
    throw new Error('Element is not draggable');
  }

  // Perform drag and drop
  await dragElementLocator.dispatchEvent('dragstart');
  await dropTargetLocator.dispatchEvent('drop');
  await dragElementLocator.dispatchEvent('dragend');
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
