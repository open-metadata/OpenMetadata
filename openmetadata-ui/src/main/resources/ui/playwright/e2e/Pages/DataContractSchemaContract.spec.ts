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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import {
  deleteFixtureEntity,
  okJson,
  settleAll,
} from '../../utils/apiResponse';
import { getApiContext, uuid } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

interface Contract {
  id: string;
  name: string;
  fullyQualifiedName: string;
}

interface ActivityEvent {
  entity: { id: string };
  fieldName?: string;
  newValue?: string;
}

// Activity is written by an event subscription that polls every 30s.
const ACTIVITY_TIMEOUT = 120_000;

const createContract = async (
  apiContext: APIRequestContext,
  entity: { id: string; type: string },
  entityStatus: 'Draft' | 'Approved'
) =>
  okJson<Contract>(
    await apiContext.post('/api/v1/dataContracts', {
      data: { name: `pw-contract-${uuid()}`, entity, entityStatus },
    }),
    'Create data contract'
  );

const waitForContractActivity = async (
  apiContext: APIRequestContext,
  entityPath: string,
  isExpected: (event: ActivityEvent) => boolean
) =>
  expect
    .poll(
      async () => {
        const { data } = await okJson<{ data: ActivityEvent[] }>(
          await apiContext.get(`/api/v1/activity/entity/${entityPath}`, {
            params: { days: 1, limit: 50 },
          }),
          'List entity activity'
        );

        return data.some(isExpected);
      },
      { timeout: ACTIVITY_TIMEOUT, intervals: [2_000, 5_000] }
    )
    .toBe(true);

const openActivityFeed = async (page: Page, entityPath: string) => {
  await page.goto(`/${entityPath}/activity_feed/all`);
  await waitForAllLoadersToDisappear(page);
};

const feedEntry = (page: Page, text: string) =>
  page.locator('#feedData [data-testid="message-container"]').filter({
    hasText: text,
  });

test.describe(
  'Data contract on a database schema',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    const approvedSchemaTable = new TableClass();
    const draftSchemaTable = new TableClass();
    const statusChangeTable = new TableClass();
    let approvedSchemaContract: Contract;
    let draftSchemaContract: Contract;
    let draftTableContract: Contract;

    const schemaFqn = (table: TableClass) =>
      table.schemaResponseData.fullyQualifiedName ?? '';

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await settleAll([
          approvedSchemaTable.create(apiContext),
          draftSchemaTable.create(apiContext),
          statusChangeTable.create(apiContext),
        ]);
        [approvedSchemaContract, draftSchemaContract, draftTableContract] =
          await Promise.all([
            createContract(
              apiContext,
              {
                id: approvedSchemaTable.schemaResponseData.id ?? '',
                type: 'databaseSchema',
              },
              'Approved'
            ),
            createContract(
              apiContext,
              {
                id: draftSchemaTable.schemaResponseData.id ?? '',
                type: 'databaseSchema',
              },
              'Draft'
            ),
            createContract(
              apiContext,
              {
                id: statusChangeTable.entityResponseData.id ?? '',
                type: 'table',
              },
              'Draft'
            ),
          ]);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await settleAll(
          [approvedSchemaContract, draftSchemaContract, draftTableContract]
            .filter(Boolean)
            .map((contract) =>
              deleteFixtureEntity(
                apiContext,
                `/api/v1/dataContracts/${contract.id}?hardDelete=true`
              )
            )
        );
        await settleAll([
          approvedSchemaTable.delete(apiContext),
          draftSchemaTable.delete(apiContext),
          statusChangeTable.delete(apiContext),
        ]);
      } finally {
        await afterAction();
      }
    });

    test('contract task and activity links open the asset Contract tab', async ({
      page,
    }) => {
      const contractPath = `/dataContract/${getEncodedFqn(
        approvedSchemaContract.fullyQualifiedName
      )}`;
      const schemaContractUrl = new RegExp(
        `/databaseSchema/${getEncodedFqn(
          schemaFqn(approvedSchemaTable)
        )}/contract$`
      );

      await test.step('task link lands on the schema Contract tab', async () => {
        await page.goto(`${contractPath}/activity_feed/tasks`);

        await expect(page).toHaveURL(schemaContractUrl);
        await expect(page.getByTestId('contract-title')).toHaveText(
          approvedSchemaContract.name
        );
      });

      await test.step('activity link lands on the schema Contract tab', async () => {
        await page.goto(contractPath);

        await expect(page).toHaveURL(schemaContractUrl);
        await expect(page.getByTestId('contract-title')).toHaveText(
          approvedSchemaContract.name
        );
      });
    });

    test('table inherits only an approved schema contract', async ({
      page,
    }) => {
      await test.step('approved schema contract is inherited', async () => {
        await page.goto(
          `/table/${getEncodedFqn(
            approvedSchemaTable.entityResponseData.fullyQualifiedName ?? ''
          )}/contract`
        );
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('contract-title')).toHaveText(
          approvedSchemaContract.name
        );
        await expect(
          page.getByTestId('contract-header-container').locator('.inherit-icon')
        ).toBeVisible();
      });

      await test.step('draft schema contract is not inherited', async () => {
        await page.goto(
          `/table/${getEncodedFqn(
            draftSchemaTable.entityResponseData.fullyQualifiedName ?? ''
          )}/contract`
        );
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('add-contract-button')).toBeVisible();
        await expect(page.getByTestId('contract-title')).toBeHidden();
      });
    });

    test('schema activity feed lists its contract and links to it', async ({
      page,
    }) => {
      test.slow();

      const schemaPath = `databaseSchema/${getEncodedFqn(
        schemaFqn(approvedSchemaTable)
      )}`;
      const { apiContext, afterAction } = await getApiContext(page);
      try {
        await waitForContractActivity(
          apiContext,
          `databaseSchema/${approvedSchemaTable.schemaResponseData.id}`,
          (event) => event.entity.id === approvedSchemaContract.id
        );
      } finally {
        await afterAction();
      }

      await openActivityFeed(page, schemaPath);
      const contractLink = page
        .locator('#feedData')
        .getByTestId('entity-link')
        .filter({ hasText: approvedSchemaContract.name });

      await expect(contractLink).toBeVisible();

      await contractLink.click();

      await expect(page).toHaveURL(new RegExp(`/${schemaPath}/contract$`));
      await expect(page.getByTestId('contract-title')).toHaveText(
        approvedSchemaContract.name
      );
    });

    test('contract approval appears in the table activity feed', async ({
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      try {
        await okJson(
          await apiContext.patch(
            `/api/v1/dataContracts/${draftTableContract.id}`,
            {
              data: [
                { op: 'replace', path: '/entityStatus', value: 'Approved' },
              ],
              headers: { 'Content-Type': 'application/json-patch+json' },
            }
          ),
          'Approve data contract'
        );
        await waitForContractActivity(
          apiContext,
          `table/${statusChangeTable.entityResponseData.id}`,
          (event) =>
            event.entity.id === draftTableContract.id &&
            event.fieldName === 'entityStatus' &&
            event.newValue === 'Approved'
        );
      } finally {
        await afterAction();
      }

      await openActivityFeed(
        page,
        `table/${getEncodedFqn(
          statusChangeTable.entityResponseData.fullyQualifiedName ?? ''
        )}`
      );

      await expect(
        feedEntry(
          page,
          `Status of ${draftTableContract.name} changed to Approved`
        )
      ).toBeVisible();
    });
  }
);
