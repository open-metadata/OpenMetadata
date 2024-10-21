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
import { expect, Page } from '@playwright/test';
import { toastNotification } from './common';

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
  const dropdownIcon = page.locator(
    `[data-row-key=${name}] > .whitespace-nowrap > [data-testid="expand-icon"] > svg`
  );
  await dropdownIcon.click();
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

  const patchResponse = page.waitForResponse('/api/v1/teams/*');
  await page.locator('.ant-modal-footer > .ant-btn-primary').click();
  await patchResponse;

  await toastNotification(page, 'Team moved successfully!', 'success');
};
