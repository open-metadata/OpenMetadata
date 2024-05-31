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
import { APIRequestContext, Page, request, test } from '@playwright/test';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Admin } from '../../support/user/Admin';

const entities = [
  new DashboardClass(),
  new PipelineClass(),
  new TopicClass(),
  new MlModelClass(),
  new ContainerClass(),
  new SearchIndexClass(),
  new DashboardDataModelClass(),
] as const;

test.describe.configure({ mode: 'serial' });

let page: Page;
let apiContext: APIRequestContext;
const admin = new Admin();

test.describe('Entity detail page', () => {
  test.beforeAll(async ({ browser }) => {
    // create a new page
    page = await browser.newPage();

    // login with admin user
    await admin.login(page);
    await page.waitForURL('**/my-data');

    // get the token from localStorage
    const token = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('om-session') ?? '{}')?.state
          ?.oidcIdToken ?? ''
    );

    // create a new context with the token
    apiContext = await request.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    // call the pre-requisites for tests
    await EntityDataClass.preRequisitesForTests(apiContext);
  });

  entities.forEach((entity) => {
    test.describe(entity.getType(), () => {
      test.beforeAll(async () => {
        // create a new entity
        await entity.create(apiContext);
        await entity.visitEntityPage(page);
      });

      test('Domain Add, Update and Remove', async () => {
        await entity.domain(
          page,
          EntityDataClass.domain1.responseData,
          EntityDataClass.domain2.responseData
        );
      });

      test('User as Owner Add, Update and Remove', async () => {
        const OWNER1 = 'Aaron Johnson';
        const OWNER2 = 'Cynthia Meyer';
        await entity.owner(page, OWNER1, OWNER2);
      });

      test('Team as Owner Add, Update and Remove', async () => {
        const OWNER1 = 'Marketplace';
        const OWNER2 = 'DevOps';
        await entity.owner(page, OWNER1, OWNER2, 'Teams');
      });

      test('Tier Add, Update and Remove', async () => {
        await entity.tier(page, 'Tier1', 'Tier5');
      });

      test('Update description', async () => {
        await entity.descriptionUpdate(page);
      });

      test('Tag Add, Update and Remove', async () => {
        await entity.tag(page, 'PersonalData.Personal', 'PII.None');
      });

      test('Glossary Term Add, Update and Remove', async () => {
        await entity.glossaryTerm(
          page,
          EntityDataClass.glossaryTerm1.responseData,
          EntityDataClass.glossaryTerm2.responseData
        );
      });

      test.afterAll(async () => {
        // delete the entity
        await entity.delete(apiContext);
      });
    });
  });

  test.afterAll(async () => {
    // call the post-requisites for tests
    await EntityDataClass.postRequisitesForTests(apiContext);
    await admin.logout(page);
    await apiContext.dispose();
    await page.close();
  });
});
