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
import { APIRequestContext } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getAuthContext, redirectToHomePage, uuid } from '../../utils/common';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { expect, test } from '../fixtures/pages';

type ImpersonatingBot = { id: string; displayName: string; token: string };

// Impersonation can only be granted when a bot is created, and BotClass does not grant it.
const createImpersonatingBot = async (
  apiContext: APIRequestContext
): Promise<ImpersonatingBot> => {
  const name = `pwimpbot${uuid()}`;
  const displayName = `Impersonating Bot ${name}`;
  const botUser = await okJson<{ id: string }>(
    await apiContext.post('/api/v1/users', {
      data: {
        name,
        displayName,
        email: `${name}@gmail.com`,
        isBot: true,
        authenticationMechanism: {
          authType: 'JWT',
          config: { JWTTokenExpiry: 'OneHour' },
        },
      },
    }),
    'impersonatingBotUser'
  );
  const bot = await okJson<{ id: string }>(
    await apiContext.post('/api/v1/bots', {
      data: { name, botUser: name, allowImpersonation: true },
    }),
    'impersonatingBot'
  );
  const { JWTToken } = await okJson<{ JWTToken: string }>(
    await apiContext.post('/api/v1/users/generateToken', {
      data: { id: botUser.id, JWTTokenExpiry: 'OneHour' },
    }),
    'impersonatingBotToken'
  );

  return { id: bot.id, displayName, token: JWTToken };
};

const versionEntryTestId = (version?: number) =>
  `version-entry-v${Number(version).toFixed(1)}`;

const patchDescriptionOnBehalfOf = async (
  bot: ImpersonatingBot,
  table: TableClass,
  userName: string
) => {
  const botContext = await getAuthContext(bot.token);
  const patched = await okJson<{ version: number }>(
    await botContext.patch(`/api/v1/tables/${table.entityResponseData.id}`, {
      data: [
        {
          op: 'add',
          path: '/description',
          value: 'Written by the bot on behalf of the user',
        },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
        'X-Impersonate-User': userName,
      },
    }),
    'impersonatedPatch'
  );
  await botContext.dispose();

  return patched.version;
};

test.describe('Version history of a change made through impersonation', () => {
  let table: TableClass;
  let user: UserClass;
  let bot: ImpersonatingBot;
  let createdVersion: number | undefined;
  let impersonatedVersion: number;

  test.beforeAll(
    'A bot edits a table on behalf of a user',
    async ({ browser }) => {
      table = new TableClass();
      user = new UserClass();
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      createdVersion = table.entityResponseData.version;
      await user.create(apiContext);
      bot = await createImpersonatingBot(apiContext);
      impersonatedVersion = await patchDescriptionOnBehalfOf(
        bot,
        table,
        user.responseData.name
      );
      await afterAction();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await user.delete(apiContext);
    await deleteFixtureEntity(
      apiContext,
      `/api/v1/bots/${bot.id}?hardDelete=true&recursive=false`
    );
    await afterAction();
  });

  test('names the bot that made the change for its author', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    const versionHistory = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/versions'),
      200
    );
    await page.getByTestId('version-button').click();
    await versionHistory;

    await expect(
      page
        .getByTestId(versionEntryTestId(impersonatedVersion))
        .getByTestId('version-impersonated-by')
    ).toContainText(bot.displayName);
    const createdEntry = page.getByTestId(versionEntryTestId(createdVersion));
    await expect(createdEntry).toBeVisible();
    await expect(
      createdEntry.getByTestId('version-impersonated-by')
    ).toHaveCount(0);
  });
});
