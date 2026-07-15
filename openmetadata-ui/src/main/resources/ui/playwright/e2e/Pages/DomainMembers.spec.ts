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
import { expect, Page } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

const domain = new Domain();
const memberUser = new UserClass();
const memberTeam = new TeamClass();
memberTeam.setTeamType('Department');

const activePanelUpdateButton = (page: Page) =>
  page.getByRole('tabpanel').getByTestId('selectable-list-update-btn');

test.describe(
  'Domain Members (Users & Teams) Widget',
  { tag: ['@Governance', '@Platform'] },
  () => {
    test.beforeAll('Setup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await domain.create(apiContext);
      await memberUser.create(apiContext);
      await memberTeam.create(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await domain.delete(apiContext);
      await memberUser.delete(apiContext);
      await memberTeam.delete(apiContext);
      await afterAction();
    });

    test('admin can add and remove users & teams from the domain page', async ({
      page,
    }) => {
      test.slow();

      const userName = memberUser.responseData.name;
      const teamName = memberTeam.responseData.name;

      await test.step('Widget is visible on the Documentation tab', async () => {
        await redirectToHomePage(page);
        await domain.visitEntityPage(page);
        await waitForAllLoadersToDisappear(page);

        const widget = page.getByTestId('domain-members-widget');
        await widget.scrollIntoViewIfNeeded();

        await expect(widget).toBeVisible();
      });

      await test.step('Add a user and a non-Group team as members', async () => {
        await page
          .getByTestId('domain-members-widget')
          .getByTestId('add-domain-member-button')
          .click();

        await expect(page.getByTestId('select-owner-tabs')).toBeVisible();

        // newly created entities appear in the picker only once ES has
        // indexed them; re-issue the search until the item shows up
        await expect(async () => {
          const teamSearchResponse = page.waitForResponse(
            '**/api/v1/search/query?*index=team*'
          );
          await page.getByTestId('owner-select-teams-search-bar').clear();
          await page
            .getByTestId('owner-select-teams-search-bar')
            .fill(memberTeam.responseData.displayName);
          await teamSearchResponse;

          await expect(
            page.getByRole('listitem', {
              name: memberTeam.responseData.displayName,
            })
          ).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 90_000 });

        await page
          .getByRole('listitem', { name: memberTeam.responseData.displayName })
          .click();

        await page
          .getByTestId('select-owner-tabs')
          .getByRole('tab', { name: 'Users' })
          .click();

        // search by the first-name token: the generated dotted user name
        // (first.last.timestamp) does not match ES tokenization as one string
        const userSearchTerm = memberUser.data.firstName;

        await expect(async () => {
          const userSearchResponse = page.waitForResponse(
            '**/api/v1/search/query?*index=user*'
          );
          await page.getByTestId('owner-select-users-search-bar').clear();
          await page
            .getByTestId('owner-select-users-search-bar')
            .fill(userSearchTerm);
          await userSearchResponse;

          await expect(
            page.getByRole('listitem', { name: userSearchTerm })
          ).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 90_000 });

        await page.getByRole('listitem', { name: userSearchTerm }).click();

        const addMembersResponse = page.waitForResponse(
          '**/api/v1/domains/*/members/add'
        );
        const updateButton = activePanelUpdateButton(page);
        await expect(updateButton).toBeEnabled();
        await updateButton.click();

        const response = await addMembersResponse;

        expect(response.status()).toBe(200);
      });

      await test.step('Widget lists both new members', async () => {
        await expect(
          page.getByTestId(`domain-member-${userName}`)
        ).toBeVisible();
        await expect(
          page.getByTestId(`domain-member-${teamName}`)
        ).toBeVisible();
      });

      await test.step('Assignment is reflected on the user entity', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        const user = await (
          await apiContext.get(`/api/v1/users/name/${userName}?fields=domains`)
        ).json();

        expect(
          user.domains.some(
            (memberDomain: { id: string }) =>
              memberDomain.id === domain.responseData.id
          )
        ).toBe(true);

        await afterAction();
      });

      await test.step('Membership persists after page reload', async () => {
        // listing is search-index backed; poll through reloads until ES catches up
        await expect(async () => {
          await page.reload();
          await waitForAllLoadersToDisappear(page);

          await expect(
            page.getByTestId(`domain-member-${userName}`)
          ).toBeVisible({ timeout: 5000 });
        }).toPass({ timeout: 60_000 });
      });

      await test.step('Remove both members from the widget', async () => {
        await page
          .getByTestId('domain-members-widget')
          .getByTestId('edit-domain-member-button')
          .click();

        await expect(page.getByTestId('select-owner-tabs')).toBeVisible();

        for (const memberDisplayName of [
          memberUser.data.firstName,
          memberTeam.responseData.displayName,
        ]) {
          const pill = page
            .locator('.user-team-pills')
            .filter({ hasText: memberDisplayName });
          await expect(pill).toBeVisible();
          await pill.getByTestId('close-icon').click();
        }

        const removeMembersResponse = page.waitForResponse(
          '**/api/v1/domains/*/members/remove'
        );
        const updateButton = activePanelUpdateButton(page);
        await expect(updateButton).toBeEnabled();
        await updateButton.click();

        const response = await removeMembersResponse;

        expect(response.status()).toBe(200);

        await expect(
          page.getByTestId(`domain-member-${userName}`)
        ).not.toBeVisible();
        await expect(
          page.getByTestId(`domain-member-${teamName}`)
        ).not.toBeVisible();
      });

      await test.step('Removal is reflected on the user entity', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        const user = await (
          await apiContext.get(`/api/v1/users/name/${userName}?fields=domains`)
        ).json();

        expect(
          (user.domains ?? []).some(
            (memberDomain: { id: string }) =>
              memberDomain.id === domain.responseData.id
          )
        ).toBe(false);

        await afterAction();
      });
    });

    test('data consumer sees the widget read-only', async ({
      dataConsumerPage: page,
    }) => {
      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const widget = page.getByTestId('domain-members-widget');
      await widget.scrollIntoViewIfNeeded();

      await expect(widget).toBeVisible();
      await expect(
        widget.getByTestId('add-domain-member-button')
      ).not.toBeVisible();
      await expect(
        widget.getByTestId('edit-domain-member-button')
      ).not.toBeVisible();
    });
  }
);
