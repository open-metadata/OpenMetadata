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

import { expect, test } from '../../support/fixtures/userPages';
import { Domain } from '../../support/domain/Domain';
import { DataProduct } from '../../support/domain/DataProduct';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import { RightPanelPageObject } from '../PageObject/Explore/RightPanelPageObject';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { navigateToDomainDataProductsAndOpenPanel } from '../../utils/rightPanelNavigation';

const domainEntity = new Domain();
const dataProductEntity = new DataProduct([domainEntity]);
const testClassification = new ClassificationClass();
const testTag = new TagClass({ classification: testClassification.data.name });
const testGlossary = new Glossary();
const testGlossaryTerm = new GlossaryTerm(testGlossary);
const ownerUser = new UserClass();

test.describe('Domain Data Products Tab - Right Panel', () => {
  test.beforeAll(async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await domainEntity.create(apiContext);
      dataProductEntity.createDomain = false;
      await dataProductEntity.create(apiContext);
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await ownerUser.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await dataProductEntity.delete(apiContext);
      await domainEntity.delete(apiContext);
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await ownerUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('Should open right panel when clicking data product card in domain', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    await rightPanel.waitForPanelLoaded();

    await expect(rightPanel.getSummaryPanel()).toBeVisible();
  });

  test('Should display data product name link in panel in domain context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    await rightPanel.waitForPanelLoaded();

    await expect(
      rightPanel.getSummaryPanel().getByTestId('entity-link').first()
    ).toBeVisible();
  });

  test('Should display overview tab for data product', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    await rightPanel.waitForPanelLoaded();

    const overviewTab = rightPanel.getTabLocator('overview');
    await expect(overviewTab).toBeVisible();
  });

  test('Should edit description for data product from domain context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.shouldShowDescriptionSection();

    const description = `Data product description - ${uuid()}`;
    await overview.editDescription(description);
    await overview.shouldShowDescriptionWithText(description);
  });

  test('Should display overview tab content for data product in domain context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.shouldBeVisible();
    await overview.shouldShowDescriptionSection();
  });

  test('Should edit tags for data product from domain context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    const tagDisplayName =
      testTag.responseData?.displayName ?? testTag.data.displayName;
    await overview.editTags(tagDisplayName);
    await overview.shouldShowTag(tagDisplayName);
  });

  test('Should assign tier for data product from domain context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.assignTier('Tier1');
    await overview.shouldShowTier('Tier1');
  });

  test('Should edit owners for data product from domain context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.addOwnerWithoutValidation(ownerUser.getUserDisplayName());
    await overview.shouldShowOwner(ownerUser.getUserDisplayName());
  });

  test('Should not display glossary terms section in domain data products context', async ({
    adminPage,
  }) => {
    test.slow();
    await navigateToDomainDataProductsAndOpenPanel(
      adminPage,
      domainEntity,
      dataProductEntity
    );

    const rightPanel = new RightPanelPageObject(adminPage);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    const glossaryTermSection = rightPanel.getSummaryPanel().locator(
      '.glossary-terms-section'
    );
    await expect(glossaryTermSection).not.toBeVisible();
  });
});
