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
import { isUndefined } from 'lodash';
import { CustomPropertySupportedEntityList } from '../../constant/customProperty';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import {
  assignDomain,
  createNewPage,
  generateRandomUsername,
  getApiContext,
  getAuthContext,
  getToken,
  redirectToHomePage,
  removeDomain,
  verifyDomainPropagation,
} from '../../utils/common';
import { CustomPropertyTypeByName } from '../../utils/customProperty';
import {
  addMultiOwner,
  removeOwner,
  removeOwnersFromList,
} from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';

const entities = [
  ApiEndpointClass,
  TableClass,
  StoredProcedureClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  DashboardDataModelClass,
  MetricClass,
] as const;

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

entities.forEach((EntityClass) => {
  const entity = new EntityClass();
  const deleteEntity = new EntityClass();
  const entityName = entity.getType();

  test.describe(entityName, () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await EntityDataClass.preRequisitesForTests(apiContext);
      await entity.create(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await entity.visitEntityPage(page);
    });

    test('Domain Add, Update and Remove', async ({ page }) => {
      await entity.domain(
        page,
        EntityDataClass.domain1.responseData,
        EntityDataClass.domain2.responseData
      );
    });

    test('Domain Propagation', async ({ page }) => {
      const serviceCategory = entity.serviceCategory;
      if (serviceCategory && 'service' in entity) {
        await visitServiceDetailsPage(
          page,
          {
            name: entity.service.name,
            type: serviceCategory,
          },
          false
        );

        await assignDomain(page, EntityDataClass.domain1.responseData);
        await verifyDomainPropagation(
          page,
          EntityDataClass.domain1.responseData,
          entity.entityResponseData?.['fullyQualifiedName']
        );

        await visitServiceDetailsPage(
          page,
          {
            name: entity.service.name,
            type: serviceCategory,
          },
          false
        );
        await removeDomain(page, EntityDataClass.domain1.responseData);
      }
    });

    test('User as Owner Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      const OWNER1 = EntityDataClass.user1.getUserName();
      const OWNER2 = EntityDataClass.user2.getUserName();
      const OWNER3 = EntityDataClass.user3.getUserName();
      await entity.owner(page, [OWNER1, OWNER3], [OWNER2]);
    });

    test.fixme('Team as Owner Add, Update and Remove', async ({ page }) => {
      const OWNER1 = EntityDataClass.team1.data.displayName;
      const OWNER2 = EntityDataClass.team2.data.displayName;
      await entity.owner(page, [OWNER1], [OWNER2], 'Teams');
    });

    test('User as Owner with unsorted list', async ({ page }) => {
      test.slow(true);

      const { afterAction, apiContext } = await getApiContext(page);
      const owner1Data = generateRandomUsername('PW_A_');
      const owner2Data = generateRandomUsername('PW_B_');
      const OWNER1 = new UserClass(owner1Data);
      const OWNER2 = new UserClass(owner2Data);
      await OWNER1.create(apiContext);
      await OWNER2.create(apiContext);

      await addMultiOwner({
        page,
        ownerNames: [OWNER2.getUserName()],
        activatorBtnDataTestId: 'edit-owner',
        resultTestId: 'data-assets-header',
        endpoint: entity.endpoint,
        type: 'Users',
      });

      await addMultiOwner({
        page,
        ownerNames: [OWNER1.getUserName()],
        activatorBtnDataTestId: 'edit-owner',
        resultTestId: 'data-assets-header',
        endpoint: entity.endpoint,
        type: 'Users',
        clearAll: false,
      });

      await removeOwnersFromList({
        page,
        ownerNames: [OWNER1.getUserName()],
        endpoint: entity.endpoint,
        dataTestId: 'data-assets-header',
      });

      await removeOwner({
        page,
        endpoint: entity.endpoint,
        ownerName: OWNER2.getUserName(),
        type: 'Users',
        dataTestId: 'data-assets-header',
      });

      await OWNER1.delete(apiContext);
      await OWNER2.delete(apiContext);
      await afterAction();
    });

    test('Tier Add, Update and Remove', async ({ page }) => {
      await entity.tier(
        page,
        'Tier1',
        EntityDataClass.tierTag1.data.displayName
      );
    });

    if (['Dashboard', 'Dashboard Data Model'].includes(entityName)) {
      test(`${entityName} page should show the project name`, async ({
        page,
      }) => {
        await expect(
          page.getByText((entity.entity as { project: string }).project)
        ).toBeVisible();
      });
    }

    test('Update description', async ({ page }) => {
      await entity.descriptionUpdate(page);
    });

    test('Tag Add, Update and Remove', async ({ page }) => {
      await entity.tag(page, 'PersonalData.Personal', 'PII.None');
    });

    test('Glossary Term Add, Update and Remove', async ({ page }) => {
      await entity.glossaryTerm(
        page,
        EntityDataClass.glossaryTerm1.responseData,
        EntityDataClass.glossaryTerm2.responseData
      );
    });

    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test.fixme(
        'Tag Add, Update and Remove for child entities',
        async ({ page }) => {
          await page.getByTestId(entity.childrenTabId ?? '').click();

          await entity.tagChildren({
            page: page,
            tag1: 'PersonalData.Personal',
            tag2: 'PII.None',
            rowId: entity.childrenSelectorId ?? '',
            rowSelector:
              entity.type === 'MlModel' ? 'data-testid' : 'data-row-key',
          });
        }
      );
    }

    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test.fixme(
        'Glossary Term Add, Update and Remove for child entities',
        async ({ page }) => {
          await page.getByTestId(entity.childrenTabId ?? '').click();

          await entity.glossaryTermChildren({
            page: page,
            glossaryTerm1: EntityDataClass.glossaryTerm1.responseData,
            glossaryTerm2: EntityDataClass.glossaryTerm2.responseData,
            rowId: entity.childrenSelectorId ?? '',
            rowSelector:
              entity.type === 'MlModel' ? 'data-testid' : 'data-row-key',
          });
        }
      );
    }

    test(`Announcement create & delete`, async ({ page }) => {
      await entity.announcement(page);
    });

    test(`Inactive Announcement create & delete`, async ({ page }) => {
      await entity.inactiveAnnouncement(page);
    });

    test(`UpVote & DownVote entity`, async ({ page }) => {
      await entity.upVote(page);
      await entity.downVote(page);
    });

    test(`Follow & Un-follow entity`, async ({ page }) => {
      const entityName = entity.entityResponseData?.['displayName'];
      await entity.followUnfollowEntity(page, entityName);
    });

    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(entity.endpoint)) {
      const properties = Object.values(CustomPropertyTypeByName);
      const titleText = properties.join(', ');

      test(`Set & Update ${titleText} Custom Property `, async ({ page }) => {
        // increase timeout as it using single test for multiple steps
        test.slow(true);

        const { apiContext, afterAction } = await getApiContext(page);
        await entity.prepareCustomProperty(apiContext);

        await test.step(`Set ${titleText} Custom Property`, async () => {
          for (const type of properties) {
            await entity.updateCustomProperty(
              page,
              entity.customPropertyValue[type].property,
              entity.customPropertyValue[type].value
            );
          }
        });

        await test.step(`Update ${titleText} Custom Property`, async () => {
          for (const type of properties) {
            await entity.updateCustomProperty(
              page,
              entity.customPropertyValue[type].property,
              entity.customPropertyValue[type].newValue
            );
          }
        });

        await entity.cleanupCustomProperty(apiContext);
        await afterAction();
      });
    }

    test(`Update displayName`, async ({ page }) => {
      await entity.renameEntity(page, entity.entity.name);
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      await entity.delete(apiContext);
      await EntityDataClass.postRequisitesForTests(apiContext);
      await afterAction();
    });
  });

  test(`Delete ${deleteEntity.getType()}`, async ({ page }) => {
    // increase timeout as it using single test for multiple steps
    test.slow(true);

    await redirectToHomePage(page);
    // get the token from localStorage
    const token = await getToken(page);

    // create a new context with the token
    const apiContext = await getAuthContext(token);
    await deleteEntity.create(apiContext);
    await redirectToHomePage(page);
    await deleteEntity.visitEntityPage(page);

    await test.step('Soft delete', async () => {
      await deleteEntity.softDeleteEntity(
        page,
        deleteEntity.entity.name,
        deleteEntity.entityResponseData?.['displayName']
      );
    });

    await test.step('Hard delete', async () => {
      await deleteEntity.hardDeleteEntity(
        page,
        deleteEntity.entity.name,
        deleteEntity.entityResponseData?.['displayName']
      );
    });
  });
});
