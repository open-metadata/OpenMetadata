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
import { Page, test as base } from '@playwright/test';
import { CustomPropertySupportedEntityList } from '../../constant/customProperty';
import {
  CertificationSupportedServices,
  FollowSupportedServices,
} from '../../constant/service';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  getAuthContext,
  getToken,
  redirectToHomePage,
} from '../../utils/common';
import { CustomPropertyTypeByName } from '../../utils/customProperty';

const entities = {
  'Api Service': ApiServiceClass,
  'Api Collection': ApiCollectionClass,
  'Database Service': DatabaseServiceClass,
  'Dashboard Service': DashboardServiceClass,
  'Messaging Service': MessagingServiceClass,
  'Mlmodel Service': MlmodelServiceClass,
  'Pipeline Service': PipelineServiceClass,
  'Search Index Service': SearchIndexServiceClass,
  'Storage Service': StorageServiceClass,
  Database: DatabaseClass,
  'Database Schema': DatabaseSchemaClass,
  'Drive Service': DriveServiceClass,
} as const;

const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await afterAction();
});

Object.entries(entities).forEach(([key, EntityClass]) => {
  const entity = new EntityClass();
  const deleteEntity = new EntityClass();

  test.describe(key, () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await entity.create(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await entity.visitEntityPage(page);
    });

    /**
     * Tests domain management on services
     * @description Adds a domain, switches to another, then removes it from the service
     */
    test('Domain Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      await entity.domain(
        page,
        EntityDataClass.domain1.responseData,
        EntityDataClass.domain2.responseData,
        EntityDataClass.dataProduct1.responseData,
        EntityDataClass.dataProduct2.responseData,
        EntityDataClass.dataProduct3.responseData
      );
    });

    /**
     * Tests user ownership management
     * @description Adds user owners, updates the owner list, and removes owners from the service
     */
    test('User as Owner Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      const OWNER1 = EntityDataClass.user1.getUserDisplayName();
      const OWNER2 = EntityDataClass.user2.getUserDisplayName();
      const OWNER3 = EntityDataClass.user3.getUserDisplayName();
      await entity.owner(page, [OWNER1, OWNER3], [OWNER2]);
    });

    /**
     * Tests team ownership management
     * @description Adds team owners, updates the list, and removes teams from the service
     */
    test('Team as Owner Add, Update and Remove', async ({ page }) => {
      const OWNER1 = EntityDataClass.team1.responseData.displayName;
      const OWNER2 = EntityDataClass.team2.responseData.displayName;
      await entity.owner(page, [OWNER1], [OWNER2], 'Teams');
    });

    /**
     * Tests tier management
     * @description Assigns a tier to the service, updates it, and removes it
     */
    test('Tier Add, Update and Remove', async ({ page }) => {
      await entity.tier(page, 'Tier1', 'Tier5');
    });

    if (CertificationSupportedServices.includes(entity.endpoint)) {
      /**
       * Tests certification lifecycle
       * @description Adds a certification to the service, updates it, and removes it
       */
      test('Certification Add Remove', async ({ page }) => {
        await entity.certification(
          page,
          EntityDataClass.certificationTag1,
          EntityDataClass.certificationTag2
        );
      });
    }

    /**
     * Tests description updates
     * @description Edits the service description
     */
    test('Update description', async ({ page }) => {
      await entity.descriptionUpdate(page);
    });

    /**
     * Tests tag management
     * @description Adds tags to the service, updates them, and removes them
     */
    test('Tag Add, Update and Remove', async ({ page }) => {
      await entity.tag(page, 'PersonalData.Personal', 'PII.None', entity);
    });

    /**
     * Tests glossary term management
     * @description Assigns glossary terms to the service, updates them, and removes them
     */
    test('Glossary Term Add, Update and Remove', async ({ page }) => {
      await entity.glossaryTerm(
        page,
        EntityDataClass.glossaryTerm1.responseData,
        EntityDataClass.glossaryTerm2.responseData
      );
    });

    /**
     * Tests announcement lifecycle
     * @description Creates, edits, and deletes an announcement on the service
     */
    test(`Announcement create, edit & delete`, async ({ page }) => {
      test.slow();

      await entity.announcement(page);
    });

    /**
     * Tests inactive announcements
     * @description Creates an inactive announcement and then deletes it
     */
    test(`Inactive Announcement create & delete`, async ({ page }) => {
      // used slow as test contain page reload which might lead to timeout
      test.slow(true);
      await entity.inactiveAnnouncement(page);
    });

    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(entity.endpoint)) {
      const properties = Object.values(CustomPropertyTypeByName);
      const titleText = properties.join(', ');

      /**
       * Tests custom property management
       * @description Sets and updates supported custom property types on the service
       */
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
    if (FollowSupportedServices.includes(entity.endpoint)) {
      /**
       * Tests follow and unfollow actions
       * @description Follows the service and then unfollows it to verify state changes
       */
      test(`Follow & Un-follow entity for Database Entity`, async ({
        page,
      }) => {
        test.slow(true);

        const entityName = entity.entityResponseData?.['displayName'];
        await entity.followUnfollowEntity(page, entityName);
      });
    }

    /**
     * Tests display name updates
     * @description Renames the service by updating its display name
     */
    test(`Update displayName`, async ({ page }) => {
      await entity.renameEntity(page, entity.entity.name);
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.delete(apiContext);
      await afterAction();
    });
  });

  /**
   * Tests service deletion
   * @description Soft deletes the service and then hard deletes it to remove it permanently
   */
  test(`Delete ${key}`, async ({ page }) => {
    // increase timeout as it using single test for multiple steps
    test.slow(true);

    await redirectToHomePage(page);
    // get the token
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

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await afterAction();
});
