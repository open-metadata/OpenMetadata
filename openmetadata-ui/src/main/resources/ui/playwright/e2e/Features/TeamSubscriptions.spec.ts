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
import { expect, test } from '@playwright/test';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  closeSubscriptionModal,
  configureWebhook,
  fillEndpointAndSave,
  openSubscriptionModal,
  removeSubscription,
  selectWebhookType,
  verifyNoSubscription,
  verifyWebhookIcon,
} from '../../utils/teamSubscription';

let team: TeamClass;

test.describe('Team Subscriptions', { tag: ['@Platform', '@Teams'] }, () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    team = new TeamClass();
    await team.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await team.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Team Page', async ({ page }) => {
    await redirectToHomePage(page);
    await team.visitTeamPage(page);
    await waitForAllLoadersToDisappear(page);
  });

  test('should display subscription as None when no subscription configured', async ({
    page,
  }) => {
    await test.step('Verify no subscription is configured', async () => {
      await verifyNoSubscription(page);
    });
  });

  test('should open and close subscription edit modal', async ({ page }) => {
    test.slow();

    await test.step('Open subscription modal', async () => {
      await openSubscriptionModal(page);
    });

    await test.step('Close subscription modal', async () => {
      await closeSubscriptionModal(page);
    });
  });

  test('should configure MS Teams webhook subscription', async ({ page }) => {
    test.slow();

    const endpoint = 'https://outlook.office.com/webhook/test-ms-teams';

    await test.step('Open subscription modal and select MS Teams', async () => {
      await openSubscriptionModal(page);
      await selectWebhookType(page, 'MS Teams');
    });

    await test.step('Enter endpoint and save', async () => {
      await fillEndpointAndSave(page, endpoint);
    });

    await test.step('Verify MS Teams icon is displayed', async () => {
      await expect(page.getByTestId('subscription-modal')).not.toBeVisible();
      await verifyWebhookIcon(page, 'msTeams-icon', endpoint);
    });
  });

  test('should configure Slack webhook subscription', async ({ page }) => {
    test.slow();

    const endpoint = 'https://hooks.slack.com/services/test-slack-webhook';

    await test.step('Configure Slack webhook', async () => {
      await configureWebhook(page, 'Slack', endpoint);
    });

    await test.step('Verify Slack icon is displayed', async () => {
      await verifyWebhookIcon(page, 'slack-icon', endpoint);
    });
  });

  test('should configure Google Chat webhook subscription', async ({
    page,
  }) => {
    test.slow();

    const endpoint = 'https://chat.googleapis.com/v1/spaces/test-gchat';

    await test.step('Configure Google Chat webhook', async () => {
      await configureWebhook(page, 'G Chat', endpoint);
    });

    await test.step('Verify Google Chat icon is displayed', async () => {
      await verifyWebhookIcon(page, 'gChat-icon', endpoint);
    });
  });

  test('should configure Generic webhook subscription', async ({ page }) => {
    test.slow();

    const endpoint = 'https://example.com/webhook/generic-test';

    await test.step('Configure Generic webhook', async () => {
      await configureWebhook(page, 'Webhook', endpoint);
    });

    await test.step('Verify Generic webhook icon is displayed', async () => {
      await verifyWebhookIcon(page, 'generic-icon', endpoint);
    });
  });

  test('should validate endpoint URL format', async ({ page }) => {
    test.slow();

    await test.step('Open subscription modal and select webhook', async () => {
      await openSubscriptionModal(page);
      await selectWebhookType(page, 'Webhook');
    });

    await test.step('Enter invalid URL and verify error', async () => {
      await page
        .getByTestId('subscription-modal')
        .locator('#endpoint')
        .fill('invalid-url');

      await page.getByRole('button', { name: 'Confirm' }).click();

      await expect(
        page.getByText('Endpoint should be valid URL')
      ).toBeVisible();
    });

    await test.step('Close modal', async () => {
      await closeSubscriptionModal(page);
    });
  });

  test('should require endpoint when webhook type is selected', async ({
    page,
  }) => {
    test.slow();

    await test.step('Open subscription modal and select Slack', async () => {
      await openSubscriptionModal(page);
      await selectWebhookType(page, 'Slack');
    });

    await test.step('Submit without endpoint and verify error', async () => {
      const endpointInput = page
        .getByTestId('subscription-modal')
        .locator('#endpoint');
      const endpointValue = await endpointInput.inputValue();

      if (endpointValue) {
        await endpointInput.clear();
      }

      await page.getByRole('button', { name: 'Confirm' }).click();

      await expect(page.getByText('Endpoint are required')).toBeVisible();
    });

    await test.step('Close modal', async () => {
      await closeSubscriptionModal(page);
    });
  });

  test('should disable endpoint input when webhook type is None', async ({
    page,
  }) => {
    test.slow();

    await test.step('Open subscription modal', async () => {
      await openSubscriptionModal(page);
    });

    await test.step('Select Slack and verify endpoint is enabled', async () => {
      await selectWebhookType(page, 'Slack');

      await expect(
        page.getByTestId('subscription-modal').locator('#endpoint')
      ).toBeEnabled();
    });

    await test.step('Select None and verify endpoint is disabled', async () => {
      await selectWebhookType(page, 'None');

      await expect(
        page.getByTestId('subscription-modal').locator('#endpoint')
      ).toBeDisabled();
    });

    await test.step('Close modal', async () => {
      await closeSubscriptionModal(page);
    });
  });

  test('should update existing subscription to different webhook type', async ({
    page,
  }) => {
    test.slow();

    const msTeamsEndpoint = 'https://outlook.office.com/webhook/update-test';
    const genericEndpoint = 'https://example.com/webhook/updated';

    await test.step('Configure MS Teams webhook', async () => {
      await configureWebhook(page, 'MS Teams', msTeamsEndpoint);
      await expect(page.getByTestId('msTeams-icon')).toBeVisible();
    });

    await test.step('Update to Generic webhook', async () => {
      await openSubscriptionModal(page);
      await selectWebhookType(page, 'Webhook');
      await page.getByTestId('subscription-modal').locator('#endpoint').clear();
      await fillEndpointAndSave(page, genericEndpoint);
    });

    await test.step('Verify updated webhook icon', async () => {
      await expect(page.getByTestId('generic-icon')).toBeVisible();
      await expect(page.getByTestId('msTeams-icon')).not.toBeVisible();
    });
  });

  test('should remove subscription by setting webhook to None', async ({
    page,
  }) => {
    test.slow();

    await test.step('Configure Slack webhook', async () => {
      await configureWebhook(
        page,
        'Slack',
        'https://hooks.slack.com/services/test'
      );
      await expect(page.getByTestId('slack-icon')).toBeVisible();
    });

    await test.step('Remove subscription by selecting None', async () => {
      await removeSubscription(page);
    });

    await test.step('Verify subscription is removed', async () => {
      await expect(page.getByTestId('slack-icon')).not.toBeVisible();
      await verifyNoSubscription(page);
    });
  });

  test('should persist subscription after page reload', async ({ page }) => {
    test.slow();

    const endpoint = 'https://example.com/webhook/persist-test';

    await test.step('Configure Generic webhook', async () => {
      await configureWebhook(page, 'Webhook', endpoint);
    });

    await test.step('Reload page and verify persistence', async () => {
      await page.reload();
      await waitForAllLoadersToDisappear(page);

      await verifyWebhookIcon(page, 'generic-icon', endpoint);
    });
  });

  test('admin can edit subscriptions for any team', async ({ page }) => {
    test.slow();

    await test.step('Verify admin can see edit button', async () => {
      const editButton = page.getByTestId('edit-team-subscription');
      await expect(editButton).toBeVisible();
      await expect(editButton).toBeEnabled();
    });

    await test.step('Admin can configure all webhook types', async () => {
      await openSubscriptionModal(page);

      await selectWebhookType(page, 'MS Teams');
      await selectWebhookType(page, 'Slack');
      await selectWebhookType(page, 'G Chat');
      await selectWebhookType(page, 'Webhook');

      await closeSubscriptionModal(page);
    });
  });
});

test.describe(
  'Team Subscriptions - Owner Permission Tests',
  { tag: ['@Platform', '@Teams'] },
  () => {
    const ownerUser = new UserClass();
    let ownerTeam: TeamClass;

    test.beforeAll('Setup team with owner', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await ownerUser.create(apiContext);

      const id = uuid();
      ownerTeam = new TeamClass({
        name: `pw-team-owner-${id}`,
        displayName: `PW Team Owner ${id}`,
        description: 'Team with owner for subscription tests',
        teamType: 'Group',
        owners: [
          {
            displayName: ownerUser.responseData.displayName,
            fullyQualifiedName: ownerUser.responseData.fullyQualifiedName,
            id: ownerUser.responseData.id,
            name: ownerUser.responseData.name,
            type: 'user',
          },
        ],
      });

      await ownerTeam.create(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ownerTeam.delete(apiContext);
      await ownerUser.delete(apiContext);
      await afterAction();
    });

    test('team owner can manage subscriptions', async ({ browser }) => {
      test.slow();

      const ownerPage = await browser.newPage();

      try {
        await ownerUser.login(ownerPage);
        await redirectToHomePage(ownerPage);
        await ownerTeam.visitTeamPage(ownerPage);
        await waitForAllLoadersToDisappear(ownerPage);

        await test.step('Owner can see edit button', async () => {
          await expect(
            ownerPage.getByTestId('edit-team-subscription')
          ).toBeVisible();
        });

        await test.step('Owner can configure webhook', async () => {
          await configureWebhook(
            ownerPage,
            'Webhook',
            'https://example.com/owner-webhook'
          );
          await verifyWebhookIcon(
            ownerPage,
            'generic-icon',
            'https://example.com/owner-webhook'
          );
        });

        await test.step('Owner can update webhook type', async () => {
          await openSubscriptionModal(ownerPage);
          await selectWebhookType(ownerPage, 'Slack');
          await ownerPage
            .getByTestId('subscription-modal')
            .locator('#endpoint')
            .clear();
          await fillEndpointAndSave(
            ownerPage,
            'https://hooks.slack.com/services/owner-test'
          );
          await verifyWebhookIcon(
            ownerPage,
            'slack-icon',
            'https://hooks.slack.com/services/owner-test'
          );
        });

        await test.step('Owner can remove subscription', async () => {
          await removeSubscription(ownerPage);
          await verifyNoSubscription(ownerPage);
        });
      } finally {
        await ownerPage.close();
      }
    });

    test('team member without owner role cannot edit subscriptions', async ({
      browser,
    }) => {
      test.slow();

      const memberUser = new UserClass();
      let memberTeam: TeamClass;

      try {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await test.step('Create team with member (non-owner)', async () => {
          await memberUser.create(apiContext);

          const id = uuid();
          memberTeam = new TeamClass({
            name: `pw-team-member-${id}`,
            displayName: `PW Team Member ${id}`,
            description: 'Team with member for subscription tests',
            teamType: 'Group',
            users: [memberUser.responseData.id],
          });

          await memberTeam.create(apiContext);
        });

        await afterAction();

        await test.step('Verify member cannot edit subscriptions', async () => {
          const memberPage = await browser.newPage();
          await memberUser.login(memberPage);
          await redirectToHomePage(memberPage);
          await memberTeam.visitTeamPage(memberPage);
          await waitForAllLoadersToDisappear(memberPage);

          await expect(
            memberPage.getByTestId('edit-team-subscription')
          ).not.toBeVisible();

          await memberPage.close();
        });
      } finally {
        await test.step('Cleanup resources', async () => {
          const { apiContext, afterAction } = await performAdminLogin(browser);
          if (memberTeam) {
            await memberTeam.delete(apiContext);
          }
          await memberUser.delete(apiContext);
          await afterAction();
        });
      }
    });
  }
);

test.describe(
  'Team Subscriptions - Data Consumer Tests',
  { tag: ['@Platform', '@Teams'] },
  () => {
    const dataConsumerUser = new UserClass();
    let restrictedTeam: TeamClass;

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await dataConsumerUser.create(apiContext);
      restrictedTeam = new TeamClass();
      await restrictedTeam.create(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await restrictedTeam.delete(apiContext);
      await dataConsumerUser.delete(apiContext);
      await afterAction();
    });

    test('data consumer cannot edit team subscriptions', async ({
      browser,
    }) => {
      const page = await browser.newPage();

      await test.step(
        'Login as data consumer and visit team page',
        async () => {
          await dataConsumerUser.login(page);
          await redirectToHomePage(page);
          await restrictedTeam.visitTeamPage(page);
          await waitForAllLoadersToDisappear(page);
        }
      );

      await test.step('Verify edit button is not visible', async () => {
        await expect(
          page.getByTestId('edit-team-subscription')
        ).not.toBeVisible();
      });

      await test.step(
        'Verify subscription details are visible (read-only)',
        async () => {
          const subscriptionSection = page.getByTestId('teams-subscription');
          await expect(subscriptionSection).toBeVisible();
        }
      );

      await page.close();
    });
  }
);

test.describe(
  'Team Subscriptions - Data Steward Tests',
  { tag: ['@Platform', '@Teams'] },
  () => {
    const dataStewardUser = new UserClass();
    let stewardTeam: TeamClass;

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await dataStewardUser.create(apiContext);
      await dataStewardUser.setDataStewardRole(apiContext);
      stewardTeam = new TeamClass();
      await stewardTeam.create(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await stewardTeam.delete(apiContext);
      await dataStewardUser.delete(apiContext);
      await afterAction();
    });

    test('data steward cannot edit team subscriptions', async ({ browser }) => {
      const page = await browser.newPage();

      await test.step('Login as data steward and visit team page', async () => {
        await dataStewardUser.login(page);
        await redirectToHomePage(page);
        await stewardTeam.visitTeamPage(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify edit button is not visible', async () => {
        await expect(
          page.getByTestId('edit-team-subscription')
        ).not.toBeVisible();
      });

      await page.close();
    });
  }
);
