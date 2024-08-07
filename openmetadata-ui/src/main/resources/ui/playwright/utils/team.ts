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
import { uuid } from './common';

export const createTeam = async (page: Page, isPublic?: boolean) => {
  const teamData = {
    name: `pw%team-${uuid()}`,
    displayName: `PW ${uuid()}`,
    email: `pwteam${uuid()}@example.com`,
    description: 'This is a PW team',
  };

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await page.fill('[data-testid="name"]', teamData.name);
  await page.fill('[data-testid="display-name"]', teamData.displayName);
  await page.fill('[data-testid="email"]', teamData.email);

  if (isPublic) {
    await page.getByTestId('isJoinable-switch-button').click();
  }

  await page
    .locator('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .isVisible();
  await page
    .locator('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .fill(teamData.description);

  const createTeamResponse = page.waitForResponse('/api/v1/teams');

  await page.locator('button[type="submit"]').click();

  await createTeamResponse;

  return teamData;
};

export const hardDeleteTeam = async (page: Page) => {
  await page
    .getByTestId('team-details-collapse')
    .getByTestId('manage-button')
    .click();
  await page.getByTestId('delete-button').click();

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await page.click('[data-testid="hard-delete-option"]');
  await page.check('[data-testid="hard-delete"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteResponse = page.waitForResponse(
    '/api/v1/teams/*?hardDelete=true&recursive=true'
  );

  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;

  await expect(page.locator('.Toastify__toast-body')).toHaveText(
    /deleted successfully!/
  );

  await page.click('.Toastify__close-button');
};
