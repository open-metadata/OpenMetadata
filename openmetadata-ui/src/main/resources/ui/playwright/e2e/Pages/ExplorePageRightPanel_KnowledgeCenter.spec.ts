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

import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { test as baseTest, expect } from '../../support/fixtures/userPages';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  getEntityDisplayName,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { performUserLogin } from '../../utils/user';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import {
  RIGHT_PANEL_TAB,
  RightPanelPageObject,
} from '../PageObject/Explore/RightPanelPageObject';
import {
  addOwnerInKCPanel,
  navigateToKCEntity,
} from '../Utils/ExplorePageRightPanelUtils';

// Test data setup
export const knowledgeCenter = new KnowledgeCenterClass();
const user1 = new UserClass();
export const testClassification = new ClassificationClass();
export const testTag = new TagClass({
  classification: testClassification.data.name,
});
export const testGlossary = new Glossary();
const testGlossaryTerm = new GlossaryTerm(testGlossary);
const testClassification2 = new ClassificationClass();
const testTag2 = new TagClass({
  classification: testClassification2.data.name,
});

const glossaryTermToUpdate =
  testGlossaryTerm.responseData?.displayName ??
  testGlossaryTerm.data.displayName;
const tagToUpdate =
  testTag.responseData?.displayName ?? testTag.data.displayName;

// Extend base test with right panel fixtures
export const test = baseTest.extend<{
  rightPanel: RightPanelPageObject;
  overview: OverviewPageObject;
}>({
  rightPanel: async ({ adminPage }, use) => {
    await use(new RightPanelPageObject(adminPage));
  },
  overview: async ({ rightPanel }, use) => {
    await use(new OverviewPageObject(rightPanel));
  },
});

test.describe('Knowledge Center Right Panel Test Suite', () => {
  test.beforeAll(async ({ browser }) => {
    test.slow(true);
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await knowledgeCenter.create(apiContext);
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await testClassification2.create(apiContext);
      await testTag2.create(apiContext);
      await user1.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await knowledgeCenter.delete(apiContext);
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await testTag2.delete(apiContext);
      await testClassification2.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await user1.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.describe('Explore page right panel tests', () => {
    test.describe('Overview panel CRUD operations', () => {
      test('Should update description for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelVisible();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await overview.navigateToOverviewTab();
        await overview.shouldBeVisible();
        await overview.shouldShowDescriptionSection();

        const descriptionToUpdate = `knowledgeCenter Test description - ${uuid()}`;
        await overview.editDescription(descriptionToUpdate);
        await overview.shouldShowDescriptionWithText(descriptionToUpdate);
      });

      test('Should update/edit tags for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelVisible();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await overview.editTags(tagToUpdate);
        await overview.shouldShowTagsSection();
        await overview.shouldShowTag(tagToUpdate);
      });

      test('Should update/edit glossary terms for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelVisible();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await overview.editGlossaryTerms(glossaryTermToUpdate);
        await overview.shouldShowGlossaryTermsSection();
      });

      test('Should update owners for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelLoaded();
        await rightPanel.waitForPanelVisible();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await addOwnerInKCPanel(adminPage, user1.getUserDisplayName());
        await overview.shouldShowOwner(user1.getUserDisplayName());
      });
    });

    test.describe('Right panel validation by asset type', () => {
      test('validates visible/hidden tabs and tab content for knowledgeCenter', async ({
        adminPage,
        rightPanel,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelLoaded();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        // knowledgeCenter supports Overview tab only — Lineage, Data Quality, and Custom Properties are hidden
        await expect(
          rightPanel.getTabLocator(RIGHT_PANEL_TAB.OVERVIEW)
        ).toBeVisible();
        await expect(
          rightPanel.getTabLocator(RIGHT_PANEL_TAB.LINEAGE)
        ).not.toBeVisible();
        await expect(
          rightPanel.getTabLocator(RIGHT_PANEL_TAB.DATA_QUALITY)
        ).not.toBeVisible();
        await expect(
          rightPanel.getTabLocator(RIGHT_PANEL_TAB.CUSTOM_PROPERTIES)
        ).not.toBeVisible();
      });
    });

    test.describe('Overview panel - Removal operations', () => {
      test('Should remove tag for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelVisible();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await overview.editTags(tagToUpdate);
        await overview.shouldShowTagsSection();
        await overview.shouldShowTag(tagToUpdate);

        await overview.removeTag([tagToUpdate]);
        await waitForAllLoadersToDisappear(adminPage);

        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        const tagElement = adminPage.getByTestId(
          `tag-${testClassification.data.name}.${testTag.data.name}`
        );
        await expect(tagElement).not.toBeVisible();
      });

      test('Should remove glossary term for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelVisible();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await overview.editGlossaryTerms(glossaryTermToUpdate);
        await overview.shouldShowGlossaryTermsSection();

        await overview.removeGlossaryTerm([glossaryTermToUpdate]);
        await waitForAllLoadersToDisappear(adminPage);

        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        const glossarySection = adminPage.locator('.glossary-terms-section');
        await expect(
          glossarySection.getByText(glossaryTermToUpdate)
        ).not.toBeVisible();
      });

      test('Should remove user owner for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await rightPanel.waitForPanelLoaded();
        rightPanel.setEntityConfigByType('knowledgeCenter');

        await addOwnerInKCPanel(adminPage, user1.getUserDisplayName());
        await overview.shouldShowOwner(user1.getUserDisplayName());

        await overview.removeOwner([user1.getUserDisplayName()], 'Users');
        await waitForAllLoadersToDisappear(adminPage);

        await navigateToKCEntity(
          adminPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        const ownerElement = adminPage
          .locator('.owners-section')
          .getByText(user1.getUserDisplayName());
        await expect(ownerElement).not.toBeVisible();
      });
    });

    test.describe('Overview panel - Deleted entity verification', () => {
      test('Should verify deleted user not visible in owner selection for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
        browser,
      }) => {
        const deletedUser = new UserClass();
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          await deletedUser.create(apiContext);

          await navigateToKCEntity(
            adminPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await rightPanel.waitForPanelLoaded();
          rightPanel.setEntityConfigByType('knowledgeCenter');

          await addOwnerInKCPanel(adminPage, deletedUser.getUserDisplayName());
          await overview.shouldShowOwner(deletedUser.getUserDisplayName());

          await deletedUser.delete(apiContext);
          await adminPage.reload();
          await rightPanel.waitForPanelLoaded();

          const deletedOwnerLocator =
            await overview.verifyDeletedOwnerNotVisible(
              deletedUser.getUserDisplayName(),
              'Users'
            );
          await expect(deletedOwnerLocator).not.toBeVisible();
        } finally {
          await afterAction();
        }
      });

      test('Should verify deleted tag not visible in tag selection for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
        browser,
      }) => {
        const deletedClassification = new ClassificationClass();
        const deletedTag = new TagClass({
          classification: deletedClassification.data.name,
        });
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          await deletedClassification.create(apiContext);
          await deletedTag.create(apiContext);

          const deletedTagDisplayName =
            deletedTag.responseData?.displayName ?? deletedTag.data.displayName;

          await navigateToKCEntity(
            adminPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfigByType('knowledgeCenter');

          await overview.editTags(deletedTagDisplayName);
          await overview.shouldShowTag(deletedTagDisplayName);

          await deletedTag.delete(apiContext);
          await deletedClassification.delete(apiContext);
          await adminPage.reload();
          await rightPanel.waitForPanelLoaded();

          const deletedTagLocator = await overview.verifyDeletedTagNotVisible(
            deletedTagDisplayName
          );
          await expect(deletedTagLocator).not.toBeVisible();
        } finally {
          await afterAction();
        }
      });

      test('Should verify deleted glossary term not visible in selection for knowledgeCenter', async ({
        adminPage,
        rightPanel,
        overview,
        browser,
      }) => {
        const deletedGlossary = new Glossary();
        const deletedGlossaryTerm = new GlossaryTerm(deletedGlossary);
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          await deletedGlossary.create(apiContext);
          await deletedGlossaryTerm.create(apiContext);

          const deletedTermDisplayName =
            deletedGlossaryTerm.responseData?.displayName ??
            deletedGlossaryTerm.data.displayName;

          await navigateToKCEntity(
            adminPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfigByType('knowledgeCenter');

          await overview.editGlossaryTerms(deletedTermDisplayName);
          await overview.shouldShowGlossaryTermsSection();

          await deletedGlossaryTerm.delete(apiContext);
          await deletedGlossary.delete(apiContext);
          await adminPage.reload();
          await rightPanel.waitForPanelLoaded();

          const deletedTermLocator =
            await overview.verifyDeletedGlossaryTermNotVisible(
              deletedTermDisplayName
            );
          await expect(deletedTermLocator).not.toBeVisible();
        } finally {
          await afterAction();
        }
      });
    });

    test.describe('Data Steward User - Permission Verification', () => {
      test('Should allow Data Steward to edit description for knowledgeCenter', async ({
        dataStewardPage,
      }) => {
        await navigateToKCEntity(
          dataStewardPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataStewardPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDS = new RightPanelPageObject(dataStewardPage);
        rightPanelDS.setEntityConfigByType('knowledgeCenter');
        rightPanelDS.setRolePermissions('DataSteward');

        const overviewDS = new OverviewPageObject(rightPanelDS);
        await overviewDS.navigateToOverviewTab();

        const descriptionToUpdate = `DataSteward description - ${uuid()}`;
        await overviewDS.editDescription(descriptionToUpdate);
        await overviewDS.shouldShowDescriptionWithText(descriptionToUpdate);
      });

      test('Should allow Data Steward to edit owners for knowledgeCenter', async ({
        dataStewardPage,
      }) => {
        await navigateToKCEntity(
          dataStewardPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );

        const rightPanelDS = new RightPanelPageObject(dataStewardPage);
        await rightPanelDS.waitForPanelLoaded();
        rightPanelDS.setEntityConfigByType('knowledgeCenter');
        rightPanelDS.setRolePermissions('DataSteward');

        const overviewDS = new OverviewPageObject(rightPanelDS);
        await addOwnerInKCPanel(dataStewardPage, user1.getUserDisplayName());
        await overviewDS.shouldShowOwner(user1.getUserDisplayName());
      });

      test('Should allow Data Steward to edit tags for knowledgeCenter', async ({
        dataStewardPage,
      }) => {
        await navigateToKCEntity(
          dataStewardPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataStewardPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDS = new RightPanelPageObject(dataStewardPage);
        rightPanelDS.setEntityConfigByType('knowledgeCenter');
        rightPanelDS.setRolePermissions('DataSteward');

        const overviewDS = new OverviewPageObject(rightPanelDS);
        await overviewDS.editTags(tagToUpdate);
        await overviewDS.shouldShowTag(tagToUpdate);
      });

      test('Should allow Data Steward to edit glossary terms for knowledgeCenter', async ({
        dataStewardPage,
      }) => {
        await navigateToKCEntity(
          dataStewardPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataStewardPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDS = new RightPanelPageObject(dataStewardPage);
        rightPanelDS.setEntityConfigByType('knowledgeCenter');
        rightPanelDS.setRolePermissions('DataSteward');

        const overviewDS = new OverviewPageObject(rightPanelDS);
        await overviewDS.editGlossaryTerms(glossaryTermToUpdate);
        await overviewDS.shouldShowGlossaryTermsSection();
      });

      test('Should NOT show restricted edit buttons for Data Steward for knowledgeCenter', async ({
        dataStewardPage,
      }) => {
        await navigateToKCEntity(
          dataStewardPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataStewardPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDS = new RightPanelPageObject(dataStewardPage);
        rightPanelDS.setEntityConfigByType('knowledgeCenter');

        const overviewDS = new OverviewPageObject(rightPanelDS);
        await overviewDS.navigateToOverviewTab();

        // DataSteward: canEditDomains=false, canEditDataProducts=false
        // Note: edit-tier is not applicable for knowledgeCenter
        const summaryPanel = dataStewardPage.locator(
          '[data-testid="entity-summary-panel-container"]'
        );
        await expect(summaryPanel.getByTestId('add-domain')).not.toBeVisible();
        await expect(
          summaryPanel.getByTestId('edit-data-products')
        ).not.toBeVisible();
        await expect(summaryPanel.getByTestId('edit-tier')).not.toBeVisible();
      });
    });

    test.describe('Data Consumer User - Permission Verification', () => {
      test('Should allow Data Consumer to edit description for knowledgeCenter', async ({
        dataConsumerPage,
      }) => {
        await navigateToKCEntity(
          dataConsumerPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataConsumerPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
        rightPanelDC.setEntityConfigByType('knowledgeCenter');
        rightPanelDC.setRolePermissions('DataConsumer');

        const overviewDC = new OverviewPageObject(rightPanelDC);
        await overviewDC.navigateToOverviewTab();

        const descriptionToUpdate = `DataConsumer description - ${uuid()}`;
        await overviewDC.editDescription(descriptionToUpdate);
        await overviewDC.shouldShowDescriptionWithText(descriptionToUpdate);
      });

      test('Should allow Data Consumer to edit tags for knowledgeCenter', async ({
        dataConsumerPage,
      }) => {
        await navigateToKCEntity(
          dataConsumerPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataConsumerPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
        rightPanelDC.setEntityConfigByType('knowledgeCenter');
        rightPanelDC.setRolePermissions('DataConsumer');

        const overviewDC = new OverviewPageObject(rightPanelDC);
        await overviewDC.editTags(tagToUpdate);
        await overviewDC.shouldShowTag(tagToUpdate);
      });

      test('Should allow Data Consumer to edit glossary terms for knowledgeCenter', async ({
        dataConsumerPage,
      }) => {
        await navigateToKCEntity(
          dataConsumerPage,
          getEntityDisplayName(knowledgeCenter.responseData)
        );
        await dataConsumerPage
          .locator('[data-testid="entity-summary-panel-container"]')
          .waitFor({ state: 'visible' });

        const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
        rightPanelDC.setEntityConfigByType('knowledgeCenter');
        rightPanelDC.setRolePermissions('DataConsumer');

        const overviewDC = new OverviewPageObject(rightPanelDC);
        await overviewDC.editGlossaryTerms(glossaryTermToUpdate);
        await overviewDC.shouldShowGlossaryTermsSection();
      });

      test('Should follow Data Consumer role policies for ownerless knowledgeCenter', async ({
        browser,
      }) => {
        const { page: dataConsumerPage, afterAction } = await performUserLogin(
          browser,
          user1
        );

        try {
          await navigateToKCEntity(
            dataConsumerPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await dataConsumerPage
            .locator('[data-testid="entity-summary-panel-container"]')
            .waitFor({ state: 'visible' });

          const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
          rightPanelDC.setEntityConfigByType('knowledgeCenter');

          const overviewDC = new OverviewPageObject(rightPanelDC);
          await overviewDC.navigateToOverviewTab();

          // DataConsumer: canEditDomains=false, canEditDataProducts=false
          // Note: edit-tier is not applicable for knowledgeCenter
          const summaryPanel = dataConsumerPage.locator(
            '[data-testid="entity-summary-panel-container"]'
          );
          await expect(
            summaryPanel.getByTestId('add-domain')
          ).not.toBeVisible();
          await expect(
            summaryPanel.getByTestId('edit-data-products')
          ).not.toBeVisible();
        } finally {
          await afterAction();
        }
      });
    });

    test.describe('Overview panel - Description removal', () => {
      test('Should clear description for knowledgeCenter', async ({
        adminPage,
      }) => {
        const { page: authenticatedPage, afterAction } =
          await performAdminLogin(adminPage.context().browser()!);
        const rightPanel = new RightPanelPageObject(authenticatedPage);
        const localOverview = new OverviewPageObject(rightPanel);

        try {
          await navigateToKCEntity(
            authenticatedPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfigByType('knowledgeCenter');

          const descriptionText = `Description to remove - ${uuid()}`;
          await localOverview.editDescription(descriptionText);
          await localOverview.shouldShowDescriptionWithText(descriptionText);

          await localOverview.editDescription('');

          await navigateToKCEntity(
            authenticatedPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await rightPanel.waitForPanelVisible();

          const descElement = authenticatedPage
            .locator('.description-section')
            .getByText(descriptionText);
          await expect(descElement).not.toBeVisible();
        } finally {
          await afterAction();
        }
      });
    });

    test.describe('Overview panel - Multi-tag operations', () => {
      test('Should add multiple tags simultaneously for knowledgeCenter', async ({
        adminPage,
      }) => {
        const { page: authenticatedPage, afterAction } =
          await performAdminLogin(adminPage.context().browser()!);
        const rightPanel = new RightPanelPageObject(authenticatedPage);
        const localOverview = new OverviewPageObject(rightPanel);

        try {
          await navigateToKCEntity(
            authenticatedPage,
            getEntityDisplayName(knowledgeCenter.responseData)
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfigByType('knowledgeCenter');

          // Add first tag
          await localOverview.editTags(tagToUpdate);
          await localOverview.shouldShowTag(tagToUpdate);

          // Add second tag (via edit)
          const secondTag =
            testTag2.responseData?.displayName ?? testTag2.data.displayName;
          await localOverview.editTags(secondTag);
          await localOverview.shouldShowTag(secondTag);

          // Both tags should be visible
          await localOverview.shouldShowTag(tagToUpdate);
          await localOverview.shouldShowTag(secondTag);

          // Cleanup: remove both tags
          await localOverview.removeTag([secondTag]);
          await localOverview.removeTag([tagToUpdate]);
        } finally {
          await afterAction();
        }
      });
    });
  });
});
