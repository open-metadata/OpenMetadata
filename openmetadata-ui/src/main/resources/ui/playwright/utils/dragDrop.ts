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

const pointOf = async (locator: Locator, position: 'center' | 'top') => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Drag target is not visible in the viewport');
  }
  const y = position === 'top' ? box.y + 8 : box.y + box.height / 2;

  return { x: box.x + box.width / 2, y };
};

// TableV2 rows drag via react-aria's pointer-based useDragAndDrop, not HTML5
// draggable, so this drives a real pointer gesture. The stepped moves are load
// bearing: react-aria needs movement to start the drag and to register a drop
// over the target instead of cancelling. Dropping on a row triggers a move
// under it; dropping near the table top (isHeader) lands on the root DropZone
// surface, which moves the team to the table root.
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

  const source = await pointOf(dragElementLocator, 'center');
  const target = await pointOf(dropTargetLocator, isHeader ? 'top' : 'center');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 8, source.y + 8, { steps: 6 });
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
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
