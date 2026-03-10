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
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TableClass } from '../../support/entity/TableClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { Domain } from '../../support/domain/Domain';
import { UserClass } from '../../support/user/UserClass';
import { RightPanelPageObject } from '../PageObject/Explore/RightPanelPageObject';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import { performAdminLogin } from '../../utils/admin';
import { getEntityFqn } from '../../utils/entityPanel';
import { uuid } from '../../utils/common';
import { navigateToGlossaryTermAssetsAndOpenPanel } from '../../utils/rightPanelNavigation';

const tableEntity = new TableClass();
const testGlossary = new Glossary();
const testGlossaryTerm = new GlossaryTerm(testGlossary);
const testClassification = new ClassificationClass();
const testTag = new TagClass({ classification: testClassification.data.name });
const domainEntity = new Domain();
const ownerUser = new UserClass();

test.describe('Glossary Term Assets Tab - Right Panel', () => {
  test.beforeAll(async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await tableEntity.create(apiContext);
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await domainEntity.create(apiContext);
      await ownerUser.create(apiContext);

      // Tag the table with the glossary term so it appears in the Assets tab
      await tableEntity.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/tags/-',
            value: {
              tagFQN: testGlossaryTerm.responseData.fullyQualifiedName,
              labelType: 'Manual',
              state: 'Confirmed',
              source: 'Glossary',
            },
          },
        ],
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await tableEntity.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await domainEntity.delete(apiContext);
      await ownerUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('Should open right panel when clicking asset in glossary term assets tab', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    await rightPanel.waitForPanelLoaded();

    await expect(rightPanel.getSummaryPanel()).toBeVisible();
  });

  test('Should display correct tabs for table entity in glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    rightPanel.setEntityConfig(tableEntity);
    await rightPanel.waitForPanelLoaded();

    const expectedTabs = rightPanel.getExpectedTabsForEntityType('Table');
    await rightPanel.assertExpectedTabsVisible(expectedTabs);
  });

  test('Should edit description from glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.shouldShowDescriptionSection();

    const description = `Glossary term asset description - ${uuid()}`;
    await overview.editDescription(description);
    await overview.shouldShowDescriptionWithText(description);
  });

  test('Should display entity name link in panel header in glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    await rightPanel.waitForPanelLoaded();

    await expect(
      rightPanel.getSummaryPanel().getByTestId('entity-link').first()
    ).toBeVisible();
  });

  test('Should display overview tab content in glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.shouldBeVisible();
    await overview.shouldShowDescriptionSection();
  });

  test('Should edit tags from glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    const tagDisplayName =
      testTag.responseData?.displayName ?? testTag.data.displayName;
    await overview.editTags(tagDisplayName);
    await overview.shouldShowTag(tagDisplayName);
  });

  test('Should assign tier from glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.assignTier('Tier1');
    await overview.shouldShowTier('Tier1');
  });

  test('Should edit owners from glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    await overview.addOwnerWithoutValidation(ownerUser.getUserDisplayName());
    await overview.shouldShowOwner(ownerUser.getUserDisplayName());
  });

  test('Should edit domain from glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    const domainDisplayName =
      domainEntity.responseData?.displayName ?? domainEntity.data.displayName;
    await overview.editDomain(domainDisplayName);
    await overview.shouldShowDomain(domainDisplayName);
  });

  test('Should edit glossary terms from glossary term assets context', async ({
    adminPage,
  }) => {
    test.slow();
    const fqn = getEntityFqn(tableEntity);
    await navigateToGlossaryTermAssetsAndOpenPanel(
      adminPage,
      testGlossaryTerm,
      fqn!
    );
    const rightPanel = new RightPanelPageObject(adminPage, tableEntity);
    const overview = new OverviewPageObject(rightPanel);
    await rightPanel.waitForPanelLoaded();

    await overview.navigateToOverviewTab();
    const termDisplayName =
      testGlossaryTerm.responseData?.displayName ??
      testGlossaryTerm.data.displayName;
    await overview.editGlossaryTerms(termDisplayName);
    await overview.shouldShowGlossaryTermsSection();
  });
});
