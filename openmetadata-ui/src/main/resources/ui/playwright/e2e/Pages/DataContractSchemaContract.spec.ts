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
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import {
  deleteFixtureEntity,
  okJson,
  settleAll,
} from '../../utils/apiResponse';
import { fullUuid, uuid } from '../../utils/common';
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

/**
 * Seeds a contract activity event synchronously. The real event is written by
 * an event subscription that polls every 30s and lags far behind on a shared
 * CI server; what this spec asserts is that the asset feed shows and links
 * its contract's activity, not that the poller ran.
 */
const seedContractActivity = async (
  apiContext: APIRequestContext,
  contract: Contract,
  summary: string,
  change: { eventType: string; fieldName?: string; newValue?: string }
) => {
  const admin = await okJson<{ id: string; name: string }>(
    await apiContext.get('/api/v1/users/loggedInUser'),
    'Get logged-in user'
  );
  await okJson(
    await apiContext.post('/api/v1/activity/test-insert', {
      data: {
        id: fullUuid(),
        about: `<#E::dataContract::${contract.fullyQualifiedName}>`,
        entity: {
          id: contract.id,
          type: 'dataContract',
          name: contract.name,
          fullyQualifiedName: contract.fullyQualifiedName,
        },
        actor: { id: admin.id, type: 'user', name: admin.name },
        timestamp: Date.now(),
        summary,
        ...change,
      },
    }),
    'Seed contract activity'
  );
};

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
    // Each table gets its own service, so the contracts set on its schema
    // cannot leak into the shared schema other specs' tables live in.
    let approvedSchemaTable: TableClass;
    let draftSchemaTable: TableClass;
    let contractTable: TableClass;
    let approvedSchemaContract: Contract;
    let draftSchemaContract: Contract;
    let tableContract: Contract;

    const schemaFqn = (table: TableClass) =>
      table.schemaResponseData.fullyQualifiedName ?? '';

    test.beforeAll(async ({ browser }) => {
      approvedSchemaTable = new TableClass({
        service: new DatabaseServiceClass(),
      });
      draftSchemaTable = new TableClass({
        service: new DatabaseServiceClass(),
      });
      contractTable = new TableClass({
        service: new DatabaseServiceClass(),
      });
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await settleAll([
          approvedSchemaTable.create(apiContext),
          draftSchemaTable.create(apiContext),
          contractTable.create(apiContext),
        ]);
        [approvedSchemaContract, draftSchemaContract, tableContract] =
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
                id: contractTable.entityResponseData.id ?? '',
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
          [approvedSchemaContract, draftSchemaContract, tableContract]
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
          contractTable.delete(apiContext),
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
      browser,
      page,
    }) => {
      const schemaPath = `databaseSchema/${getEncodedFqn(
        schemaFqn(approvedSchemaTable)
      )}`;
      // The poller's own "Created dataContract: <name>" event lands whenever it
      // catches up, so the feed may hold one or two identical cards; the seed
      // marker keeps the locator on exactly one of them.
      const summary = `Created dataContract: ${
        approvedSchemaContract.name
      } (seed ${uuid()})`;
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await seedContractActivity(
          apiContext,
          approvedSchemaContract,
          summary,
          {
            eventType: 'EntityCreated',
          }
        );
      } finally {
        await afterAction();
      }

      await openActivityFeed(page, schemaPath);
      const contractLink = feedEntry(page, summary)
        .getByTestId('entity-link')
        .filter({ hasText: approvedSchemaContract.name });

      await expect(contractLink).toBeVisible();

      await contractLink.click();

      await expect(page).toHaveURL(new RegExp(`/${schemaPath}/contract$`));
      await expect(page.getByTestId('contract-title')).toHaveText(
        approvedSchemaContract.name
      );
    });

    test('table activity feed shows its contract status change', async ({
      browser,
      page,
    }) => {
      const summary = `Status of ${tableContract.name} changed to Approved`;
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await seedContractActivity(apiContext, tableContract, summary, {
          eventType: 'EntityUpdated',
          fieldName: 'entityStatus',
          newValue: 'Approved',
        });
      } finally {
        await afterAction();
      }

      await openActivityFeed(
        page,
        `table/${getEncodedFqn(
          contractTable.entityResponseData.fullyQualifiedName ?? ''
        )}`
      );

      await expect(feedEntry(page, summary)).toBeVisible();
    });
  }
);
