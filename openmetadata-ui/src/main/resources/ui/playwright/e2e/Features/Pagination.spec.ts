/*
 *  Copyright 2025 Collate.
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
import { DataTypeTopic } from '../../../src/generated/entity/data/topic';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  testCompletePaginationWithSearch,
  testPaginationNavigation,
  uuid,
} from '../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Pagination Tests', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.describe('Pagination tests for Users page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      // Created concurrently: 20 sequential round-trips accumulate enough
      // latency under load to blow the 60s beforeAll budget on their own.
      const paginationUsers = Array.from({ length: 20 }, () => {
        const uniqueId = uuid();

        return new UserClass({
          firstName: `pw_pagination_User${uniqueId}`,
          lastName: `LastName${uniqueId}`,
          email: `pw_pagination_user${uniqueId}@example.com`,
          password: 'User@OMD123',
        });
      });

      await Promise.all(paginationUsers.map((user) => user.create(apiContext)));

      await afterAction();
    });

    test('should test Users complete flow with search', async ({ page }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: '/settings/members/users',
        normalApiPattern: '/api/v1/users',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'user',
        waitForLoadSelector: 'table',
      });
    });
  });

  test.describe('Table columns page pagination', () => {
    let database: DatabaseClass;
    let tableFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      database = new DatabaseClass();

      const columns = [];
      for (let i = 1; i <= 60; i++) {
        columns.push({
          name: `pw_test_column_${i}`,
          dataType: 'VARCHAR',
          dataLength: 255,
          dataTypeDisplay: 'varchar',
          description: `Test column ${i} for pagination testing`,
        });
      }

      database.table.columns = columns;

      await database.create(apiContext);
      tableFqn = database.tableResponseData.fullyQualifiedName;

      if (!tableFqn) {
        throw new Error('Failed to create table: tableFqn is undefined');
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await database.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Table columns', async ({ page }) => {
      await page.goto(`/table/${tableFqn}?pageSize=15`);
      await testPaginationNavigation(
        page,
        '/columns',
        '[data-testid="entity-table"]',
        false
      );
    });
  });

  test.describe('Topic schema fields page pagination', () => {
    let topic: TopicClass;
    let topicFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      topic = new TopicClass();
      topic.entity.messageSchema.schemaFields = Array.from(
        { length: 60 },
        (_, index) => ({
          name: `pw_test_field_${index + 1}`,
          dataType: DataTypeTopic.String,
          description: `Test field ${index + 1} for pagination testing`,
          tags: [],
        })
      );

      await topic.create(apiContext);
      topicFqn = topic.entityResponseData.fullyQualifiedName ?? '';

      if (!topicFqn) {
        throw new Error('Failed to create topic: topicFqn is undefined');
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await topic.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Topic schema fields', async ({ page }) => {
      await page.goto(`/topic/${topicFqn}?pageSize=15`);
      await testPaginationNavigation(
        page,
        '/columns',
        '[data-testid="topic-schema-fields-table"]',
        false
      );
    });

    test('should test Topic schema fields complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/topic/${topicFqn}?pageSize=15`,
        normalApiPattern: '/columns',
        searchApiPattern: '/columns/search',
        searchTestTerm: 'pw',
        searchParamName: 'columnSearch',
        waitForLoadSelector: '[data-testid="topic-schema-fields-table"]',
      });
    });
  });
});
