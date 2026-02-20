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
import test, { expect } from '@playwright/test';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../support/team/TeamClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clearMockedWebSocket,
  emitDeleteFailure,
  expectGlossaryNotVisible,
  expectGlossaryVisible,
  initiateDelete,
  mockDeleteApiSuccess,
  setupMockedWebSocket,
  waitForGlossaryListRefetch,
} from '../../utils/asyncDelete';
import {
  clickOutside,
  descriptionBox,
  getAuthContext,
  getRandomLastName,
  getToken,
  redirectToHomePage,
  toastNotification,
  uuid,
  visitGlossaryPage,
} from '../../utils/common';
import {
  addMultiOwner,
  assignGlossaryTerm,
  assignGlossaryTermToChildren,
  assignTag,
  updateDescription,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  addAssetToGlossaryTerm,
  addMultiOwnerInDialog,
  addReferences,
  addRelatedTerms,
  addSynonyms,
  approveGlossaryTermTask,
  approveTagsTask,
  assignTagToGlossaryTerm,
  changeTermHierarchyFromModal,
  checkGlossaryTermDetails,
  confirmationDragAndDropGlossary,
  createDescriptionTaskForGlossary,
  createGlossary,
  createGlossaryTerm,
  createGlossaryTerms,
  createTagTaskForGlossary,
  deleteGlossaryOrGlossaryTerm,
  deselectColumns,
  dragAndDropColumn,
  dragAndDropTerm,
  fillGlossaryTermDetails,
  filterStatus,
  goToAssetsTab,
  openColumnDropdown,
  performExpandAll,
  renameGlossaryTerm,
  selectActiveGlossary,
  selectActiveGlossaryTerm,
  selectColumns,
  setupGlossaryDenyPermissionTest,
  toggleBulkActionColumnsSelection,
  updateGlossaryReviewer,
  updateGlossaryTermDataFromTree,
  updateGlossaryTermOwners,
  updateGlossaryTermReviewers,
  validateGlossaryTerm,
  verifyAllColumns,
  verifyAssetModalFilters,
  verifyColumnsVisibility,
  verifyGlossaryDetails,
  verifyGlossaryWorkflowReviewerCase,
  verifyTaskCreated,
  verifyWorkflowInstanceExists,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';
import { TaskDetails } from '../../utils/task';
import { performUserLogin } from '../../utils/user';

const user1 = new UserClass();
const user2 = new UserClass();
const team = new TeamClass();
const user3 = new UserClass();
const user4 = new UserClass();
const adminUser = new UserClass();

test.describe('Glossary tests', () => {
  test.beforeAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await user2.create(apiContext);
    await user1.create(apiContext);
    await user3.create(apiContext);
    await user4.create(apiContext);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    team.data.users = [user2.responseData.id];
    await team.create(apiContext);
    await afterAction();
  });

  test('Glossary & terms creation for reviewer as user', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user3);
    const glossary1 = new Glossary();
    glossary1.data.owners = [{ name: 'admin', type: 'user' }];
    glossary1.data.mutuallyExclusive = true;
    glossary1.data.reviewers = [
      { name: `${user3.data.firstName}${user3.data.lastName}`, type: 'user' },
    ];
    glossary1.data.terms = [new GlossaryTerm(glossary1)];

    await test.step('Create Glossary', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossary(page, glossary1.data, false);
      await verifyGlossaryDetails(page, glossary1.data);
    });

    await test.step('Create Glossary Terms', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossaryTerms(page, glossary1.data);
    });

    await test.step(
      'Approve Glossary Term from Glossary Listing for reviewer user',
      async () => {
        await redirectToHomePage(page1);
        await sidebarClick(page1, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page1, glossary1.data.name);
        await verifyTaskCreated(
          page1,
          glossary1.data.fullyQualifiedName,
          glossary1.data.terms[0].data.name
        );

        // Check reviewer's notifications before approval
        await page1.getByTestId('task-notifications').click();
        await page1.waitForSelector('.ant-dropdown');
        const firstNotification = page1
          .locator('.ant-list-items > .ant-list-item')
          .first();

        await expect(firstNotification).toContainText(
          `Approval required for ${glossary1.data.terms[0].data.name}`
        );
        await expect(firstNotification).toContainText(
          glossary1.data.fullyQualifiedName
        );

        await clickOutside(page1);

        await approveGlossaryTermTask(page1, glossary1.data.terms[0].data);
        await redirectToHomePage(page1);
        await sidebarClick(page1, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page1, glossary1.data.name);
        await validateGlossaryTerm(
          page1,
          glossary1.data.terms[0].data,
          'Approved'
        );

        await afterActionUser1();
      }
    );

    await glossary1.delete(apiContext);
    await afterAction();
  });

  test('Glossary & terms creation for reviewer as team', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user2);

    const glossary2 = new Glossary();
    glossary2.data.owners = [{ name: 'admin', type: 'user' }];
    glossary2.data.reviewers = [{ name: team.data.displayName, type: 'team' }];
    glossary2.data.terms = [new GlossaryTerm(glossary2)];

    await test.step('Create Glossary', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossary(page, glossary2.data, false);
      await verifyGlossaryDetails(page, glossary2.data);
    });

    await test.step('Create Glossary Terms', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossaryTerms(page, glossary2.data);
    });

    await test.step(
      'Approve Glossary Term from Glossary Listing for reviewer team',
      async () => {
        await redirectToHomePage(page1);
        await sidebarClick(page1, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page1, glossary2.data.name);

        await verifyTaskCreated(
          page1,
          glossary2.data.fullyQualifiedName,
          glossary2.data.terms[0].data.name
        );

        await approveGlossaryTermTask(page1, glossary2.data.terms[0].data);

        await redirectToHomePage(page1);
        await sidebarClick(page1, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page1, glossary2.data.name);
        await validateGlossaryTerm(
          page1,
          glossary2.data.terms[0].data,
          'Approved'
        );

        await afterActionUser1();
      }
    );

    await glossary2.delete(apiContext);
    await afterAction();
  });

  test('Update Glossary and Glossary Term', async ({ browser }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];

    /* We are creating another Glossary in order to avoid glossaryTerm2 to be moved to IN_REVIEW Status. */
    const glossary2 = new Glossary();
    const glossaryTerm2 = new GlossaryTerm(glossary2);
    glossary2.data.terms = [glossaryTerm2];

    const user3 = new UserClass();
    const user4 = new UserClass();

    await glossary1.create(apiContext);
    await glossary2.create(apiContext);
    await glossaryTerm1.create(apiContext);
    await glossaryTerm2.create(apiContext);
    await user3.create(apiContext);
    await user4.create(apiContext);

    try {
      await test.step('Update Glossary', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);

        // Update description
        await updateDescription(page, 'Demo description to be updated');

        // Update Owners
        await addMultiOwner({
          page,
          ownerNames: [user3.getUserDisplayName()],
          activatorBtnDataTestId: 'add-owner',
          resultTestId: 'glossary-right-panel-owner-link',
          endpoint: EntityTypeEndpoint.Glossary,
          isSelectableInsideForm: false,
          type: 'Users',
        });

        // Update Reviewer
        await addMultiOwner({
          page,
          ownerNames: [user3.getUserDisplayName()],
          activatorBtnDataTestId: 'Add',
          resultTestId: 'glossary-reviewer-name',
          endpoint: EntityTypeEndpoint.Glossary,
          type: 'Users',
        });

        await assignTag(
          page,
          'PersonalData.Personal',
          'Add',
          EntityTypeEndpoint.Glossary,
          'tabs'
        );
      });

      await test.step('Update Glossary Term', async () => {
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);
        await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);
        // Update description
        await updateDescription(page, 'Demo description to be updated');

        // Update Synonyms
        await addSynonyms(page, [getRandomLastName(), getRandomLastName()]);

        // Update References
        const references = [
          { name: getRandomLastName(), url: 'http://example.com' },
          { name: getRandomLastName(), url: 'http://trial.com' },
        ];
        await addReferences(page, references);

        // Update Related Terms
        await addRelatedTerms(page, [glossaryTerm2]);

        // Update Tag
        await assignTagToGlossaryTerm(
          page,
          'PersonalData.Personal',
          'Add',
          'glossary-term'
        );
      });
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossaryTerm2.delete(apiContext);
      await glossary1.delete(apiContext);
      await glossary2.delete(apiContext);
      await user3.delete(apiContext);
      await user4.delete(apiContext);
      await afterAction();
    }
  });

  test('Add, Update and Verify Data Glossary Term', async ({ browser }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const owner1 = new UserClass();
    const reviewer1 = new UserClass();

    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await owner1.create(apiContext);
      await reviewer1.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await updateGlossaryTermOwners(page, glossaryTerm1.data, [
        {
          name: `${owner1.data.firstName}${owner1.data.lastName}`,
          type: 'user',
        },
      ]);

      await updateGlossaryTermReviewers(page, glossaryTerm1.data, [
        {
          name: `${reviewer1.data.firstName}${reviewer1.data.lastName}`,
          type: 'user',
        },
      ]);

      await openColumnDropdown(page);
      const checkboxLabels = ['Reviewer'];
      await selectColumns(page, checkboxLabels);
      await verifyColumnsVisibility(page, checkboxLabels, true);

      // Verify the Reviewer
      expect(
        page.getByTestId(reviewer1.responseData?.['displayName'])
      ).toBeVisible();

      // Verify the Owner
      await expect(
        page.getByTestId(owner1.responseData?.['displayName'])
      ).toBeVisible();

      await checkGlossaryTermDetails(
        page,
        glossaryTerm1.data,
        owner1,
        reviewer1
      );
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await owner1.delete(apiContext);
      await reviewer1.delete(apiContext);
      await afterAction();
    }
  });

  test('Approve and reject glossary term from Glossary Listing', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user3);
    const glossary1 = new Glossary();

    glossary1.data.owners = [{ name: 'admin', type: 'user' }];
    glossary1.data.mutuallyExclusive = true;
    glossary1.data.reviewers = [
      { name: `${user3.data.firstName}${user3.data.lastName}`, type: 'user' },
    ];
    glossary1.data.terms = [
      new GlossaryTerm(glossary1),
      new GlossaryTerm(glossary1),
    ];

    await test.step('Create Glossary and Terms', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossary(page, glossary1.data, false);
      await verifyGlossaryDetails(page, glossary1.data);
      await createGlossaryTerms(page, glossary1.data);
    });

    await test.step('Approve and Reject Glossary Term', async () => {
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary1.data.name);
      await verifyTaskCreated(
        page1,
        glossary1.data.fullyQualifiedName,
        glossary1.data.terms[0].data.name
      );
      await verifyTaskCreated(
        page1,
        glossary1.data.fullyQualifiedName,
        glossary1.data.terms[1].data.name
      );
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary1.data.name);

      const taskResolve = page1.waitForResponse('/api/v1/feed/tasks/*/resolve');
      await page1
        .getByTestId(`${glossary1.data.terms[0].data.name}-approve-btn`)
        .click();
      await taskResolve;
      await toastNotification(page1, /Task resolved successfully/);

      await validateGlossaryTerm(
        page1,
        glossary1.data.terms[0].data,
        'Approved'
      );

      await page1
        .getByTestId(`${glossary1.data.terms[1].data.name}-reject-btn`)
        .click();
      await taskResolve;

      await expect(
        page1.getByTestId(`${glossary1.data.terms[1].data.name}`)
      ).not.toBeVisible();

      await afterActionUser1();
    });

    await glossary1.delete(apiContext);
    await afterAction();
  });

  test('Add and Remove Assets', async ({ browser }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossaryTerm2 = new GlossaryTerm(glossary1);
    glossary1.data.mutuallyExclusive = true;
    glossary1.data.terms = [glossaryTerm1, glossaryTerm2];

    const glossary2 = new Glossary();
    const glossaryTerm3 = new GlossaryTerm(glossary2);
    const glossaryTerm4 = new GlossaryTerm(glossary2);
    glossary2.data.terms = [glossaryTerm3, glossaryTerm4];

    await glossary1.create(apiContext);
    await glossary2.create(apiContext);
    await glossaryTerm1.create(apiContext);
    await glossaryTerm2.create(apiContext);
    await glossaryTerm3.create(apiContext);
    await glossaryTerm4.create(apiContext);

    const dashboardEntity = new DashboardClass();
    await dashboardEntity.create(apiContext);

    try {
      await test.step('Add asset to glossary term using entity', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);

        await selectActiveGlossary(page, glossary2.data.displayName);
        await goToAssetsTab(page, glossaryTerm3.data.displayName);

        await page.waitForSelector(
          "text=Looks like you haven't added any data assets yet."
        );

        await dashboardEntity.visitEntityPage(page);

        // Dashboard Entity Right Panel
        await page.click(
          '[data-testid="KnowledgePanel.GlossaryTerms"] [data-testid="glossary-container"] [data-testid="add-tag"]'
        );

        // Select 1st term
        await page.click('[data-testid="tag-selector"] #tagsForm_tags');

        const glossaryRequest = page.waitForResponse(
          `/api/v1/search/query?q=*&index=glossary_term_search_index&from=0&size=25&deleted=false&track_total_hits=true&getHierarchy=true`
        );
        await page.type(
          '[data-testid="tag-selector"] #tagsForm_tags',
          glossaryTerm1.data.name
        );
        await glossaryRequest;

        await page.getByText(glossaryTerm1.data.displayName).click();
        await page.waitForSelector(
          '[data-testid="tag-selector"]:has-text("' +
            glossaryTerm1.data.displayName +
            '")'
        );

        // Select 2nd term
        await page.click('[data-testid="tag-selector"] #tagsForm_tags');

        const glossaryRequest2 = page.waitForResponse(
          `/api/v1/search/query?q=*&index=glossary_term_search_index&from=0&size=25&deleted=false&track_total_hits=true&getHierarchy=true`
        );
        await page.type(
          '[data-testid="tag-selector"] #tagsForm_tags',
          glossaryTerm2.data.name
        );
        await glossaryRequest2;

        await page.getByText(glossaryTerm2.data.displayName).click();

        await page.waitForSelector(
          '[data-testid="tag-selector"]:has-text("' +
            glossaryTerm2.data.displayName +
            '")'
        );

        const patchRequest = page.waitForResponse(`/api/v1/dashboards/*`);

        await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

        await page.getByTestId('saveAssociatedTag').click();
        await patchRequest;

        await toastNotification(
          page,
          /mutually exclusive and can't be assigned together/
        );

        // Add non mutually exclusive tags
        await page.click(
          '[data-testid="KnowledgePanel.GlossaryTerms"] [data-testid="glossary-container"] [data-testid="add-tag"]'
        );

        // Select 1st term
        await page.click('[data-testid="tag-selector"] #tagsForm_tags');

        const glossaryRequest3 = page.waitForResponse(
          `/api/v1/search/query?q=*&index=glossary_term_search_index&from=0&size=25&deleted=false&track_total_hits=true&getHierarchy=true`
        );
        await page.type(
          '[data-testid="tag-selector"] #tagsForm_tags',
          glossaryTerm3.data.name
        );
        await glossaryRequest3;

        await page.getByText(glossaryTerm3.data.displayName).click();
        await page.waitForSelector(
          '[data-testid="tag-selector"]:has-text("' +
            glossaryTerm3.data.displayName +
            '")'
        );

        // Select 2nd term
        await page.click('[data-testid="tag-selector"] #tagsForm_tags');

        const glossaryRequest4 = page.waitForResponse(
          `/api/v1/search/query?q=*&index=glossary_term_search_index&from=0&size=25&deleted=false&track_total_hits=true&getHierarchy=true`
        );
        await page.type(
          '[data-testid="tag-selector"] #tagsForm_tags',
          glossaryTerm4.data.name
        );
        await glossaryRequest4;

        await page.getByText(glossaryTerm4.data.displayName).click();

        await page.waitForSelector(
          '[data-testid="tag-selector"]:has-text("' +
            glossaryTerm4.data.displayName +
            '")'
        );

        const patchRequest2 = page.waitForResponse(`/api/v1/dashboards/*`);

        await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

        await page.getByTestId('saveAssociatedTag').click();
        await patchRequest2;

        // Check if the terms are present
        await expect(
          page
            .getByTestId('KnowledgePanel.GlossaryTerms')
            .getByTestId('glossary-container')
            .getByTestId(`tag-${glossaryTerm3.responseData.fullyQualifiedName}`)
        ).toBeVisible();

        await expect(
          page
            .getByTestId('KnowledgePanel.GlossaryTerms')
            .getByTestId('glossary-container')
            .getByTestId(`tag-${glossaryTerm4.responseData.fullyQualifiedName}`)
        ).toBeVisible();

        // Check if the icons are present

        const icons = page.locator(
          '[data-testid="KnowledgePanel.GlossaryTerms"] [data-testid="glossary-container"] [data-testid="glossary-icon"]'
        );

        expect(await icons.count()).toBe(2);

        // Add Glossary to Dashboard Charts
        await page.click(
          '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] > [data-testid="entity-tags"] [data-testid="add-tag"]'
        );

        await page.click('[data-testid="tag-selector"]');

        const glossaryRequest5 = page.waitForResponse(
          `/api/v1/search/query?q=*&index=glossary_term_search_index&from=0&size=25&deleted=false&track_total_hits=true&getHierarchy=true`
        );
        await page.type(
          '[data-testid="tag-selector"] #tagsForm_tags',
          glossaryTerm3.data.name
        );
        await glossaryRequest5;

        await page
          .getByRole('tree')
          .getByTestId(`tag-${glossaryTerm3.data.fullyQualifiedName}`)
          .click();

        await page.waitForSelector(
          '[data-testid="tag-selector"]:has-text("' +
            glossaryTerm3.data.displayName +
            '")'
        );

        const patchRequest3 = page.waitForResponse(`/api/v1/charts/*`);

        await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

        await page.getByTestId('saveAssociatedTag').click();
        await patchRequest3;

        // Check if the term is present
        const tagSelectorText = await page
          .locator(
            '[data-testid="glossary-tags-0"] [data-testid="glossary-container"] [data-testid="tags"]'
          )
          .innerText();

        expect(tagSelectorText).toContain(glossaryTerm3.data.displayName);

        // Check if the icon is visible
        const icon = page.locator(
          '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] [data-testid="glossary-icon"]'
        );

        expect(await icon.isVisible()).toBe(true);

        await sidebarClick(page, SidebarItem.GLOSSARY);

        await selectActiveGlossary(page, glossary2.data.displayName);
        await goToAssetsTab(page, glossaryTerm3.data.displayName, 2);

        // Check if the selected asset are present
        const assetContainer = page.locator(
          '[data-testid="table-container"] .assets-data-container'
        );

        const assetContainerText = await assetContainer.innerText();

        expect(assetContainerText).toContain(dashboardEntity.entity.name);
        expect(assetContainerText).toContain(
          dashboardEntity.charts.displayName
        );
      });
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossaryTerm2.delete(apiContext);
      await glossaryTerm3.delete(apiContext);
      await glossaryTerm4.delete(apiContext);
      await glossary1.delete(apiContext);
      await glossary2.delete(apiContext);
      await dashboardEntity.delete(apiContext);
      await afterAction();
    }
  });

  test('Rename Glossary Term and verify assets', async ({ browser }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const table = new TableClass();
    const table1 = new TableClass();
    const topic = new TopicClass();
    const dashboard = new DashboardClass();

    await table.create(apiContext);
    await topic.create(apiContext);
    await dashboard.create(apiContext);
    await table1.create(apiContext);

    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];
    await glossary1.create(apiContext);
    await glossaryTerm1.create(apiContext);

    const assetsToBeAddedViaUI = [table, topic, dashboard];
    const allAssets = [...assetsToBeAddedViaUI, table1];

    try {
      await test.step('Assign Glossary Term to table column', async () => {
        await redirectToHomePage(page);
        await table1.visitEntityPage(page);

        await assignGlossaryTermToChildren({
          page,
          glossaryTerm: glossaryTerm1.responseData,
          rowId: table1.childrenSelectorId ?? '',
          entityEndpoint: 'tables',
        });
      });

      await test.step('Rename Glossary Term', async () => {
        const newName = `PW.${uuid()}%${getRandomLastName()}`;
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);
        await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);

        const queryRes1 = page.waitForResponse(
          '/api/v1/search/query?q=*&index=all&from=0&*'
        );
        await page.getByTestId('assets').click();
        await queryRes1;
        await addAssetToGlossaryTerm(page, assetsToBeAddedViaUI, true);
        await renameGlossaryTerm(page, glossaryTerm1, newName);

        await page.click('[data-testid="overview"]');
        const queryRes = page.waitForResponse(
          '/api/v1/search/query?q=*&index=all&from=0&*'
        );
        await page.getByTestId('assets').click();
        await queryRes;
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
        await page.waitForSelector('.ant-tabs-tab-active:has-text("Assets")');

        await expect(
          page.getByTestId('assets').getByTestId('filter-count')
        ).toContainText(`${allAssets.length}`);
      });

      await test.step(
        'Verify the entity page by clicking on asset',
        async () => {
          await redirectToHomePage(page);
          await table.visitEntityPage(page);

          await expect(
            page
              .getByTestId('KnowledgePanel.GlossaryTerms')
              .getByTestId('glossary-container')
              .getByTestId(
                `tag-${glossaryTerm1.responseData.fullyQualifiedName}`
              )
          ).toBeVisible();

          await redirectToHomePage(page);
          await topic.visitEntityPage(page);

          await expect(
            page
              .getByTestId('KnowledgePanel.GlossaryTerms')
              .getByTestId('glossary-container')
              .getByTestId(
                `tag-${glossaryTerm1.responseData.fullyQualifiedName}`
              )
          ).toBeVisible();

          await redirectToHomePage(page);
          await dashboard.visitEntityPage(page);

          await expect(
            page
              .getByTestId('KnowledgePanel.GlossaryTerms')
              .getByTestId('glossary-container')
              .getByTestId(
                `tag-${glossaryTerm1.responseData.fullyQualifiedName}`
              )
          ).toBeVisible();

          await redirectToHomePage(page);
          await table1.visitEntityPage(page);

          await expect(
            page
              .locator(`[data-row-key="${table1.childrenSelectorId}"]`)
              .getByTestId('glossary-container')
              .getByTestId(
                `tag-${glossaryTerm1.responseData.fullyQualifiedName}`
              )
          ).toBeVisible();
        }
      );

      await test.step('Rename the same entity again', async () => {
        const newName = `PW Space.${uuid()}%${getRandomLastName()}`;
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);
        await goToAssetsTab(
          page,
          glossaryTerm1.data.displayName,
          allAssets.length
        );
        await renameGlossaryTerm(page, glossaryTerm1, newName);
        await page.click('[data-testid="overview"]');
        const queryRes = page.waitForResponse(
          '/api/v1/search/query?q=*&index=all&from=0&*'
        );
        await page.getByTestId('assets').click();
        await queryRes;
        await page.waitForSelector('.ant-tabs-tab-active:has-text("Assets")');

        await expect(
          page.getByTestId('assets').getByTestId('filter-count')
        ).toContainText(`${allAssets.length}`);
      });
    } finally {
      await table.delete(apiContext);
      await topic.delete(apiContext);
      await dashboard.delete(apiContext);
      await table1.delete(apiContext);
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Verify asset selection modal filters are shown upfront', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);

    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];
    await glossary1.create(apiContext);
    await glossaryTerm1.create(apiContext);

    try {
      await test.step(
        'Verify filters are visible upfront and can be applied',
        async () => {
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(page, glossary1.data.displayName);
          await goToAssetsTab(page, glossaryTerm1.data.displayName);
          await verifyAssetModalFilters(page);
        }
      );
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Drag and Drop Glossary Term', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossaryTerm2 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1, glossaryTerm2];

    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await glossaryTerm2.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await test.step('Drag and Drop Glossary Term', async () => {
        await dragAndDropTerm(
          page,
          glossaryTerm1.data.displayName,
          glossaryTerm2.data.displayName
        );

        await confirmationDragAndDropGlossary(
          page,
          glossaryTerm1.data.name,
          glossaryTerm2.data.name
        );

        await expect(
          page.getByRole('cell', {
            name: glossaryTerm1.responseData.displayName,
          })
        ).not.toBeVisible();

        await performExpandAll(page);

        await expect(
          page.getByRole('cell', {
            name: glossaryTerm1.responseData.displayName,
          })
        ).toBeVisible();
      });

      await test.step(
        'Drag and Drop Glossary Term back at parent level',
        async () => {
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(page, glossary1.data.displayName);
          await performExpandAll(page);

          await dragAndDropTerm(
            page,
            glossaryTerm1.data.displayName,
            'Terms' // Header Cell
          );

          await confirmationDragAndDropGlossary(
            page,
            glossaryTerm1.data.name,
            glossary1.responseData.displayName,
            true
          );

          // verify the term is moved back at parent level
          await expect(
            page.getByRole('cell', {
              name: glossaryTerm1.responseData.displayName,
            })
          ).toBeVisible();
        }
      );
    } finally {
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Drag and Drop Glossary Term Approved Terms having reviewer', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossaryTerm2 = new GlossaryTerm(glossary1);
    const user1 = new UserClass();
    glossary1.data.terms = [glossaryTerm1, glossaryTerm2];

    try {
      await user1.create(apiContext);
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await glossaryTerm2.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await test.step('Update Glossary Term Reviewer', async () => {
        await updateGlossaryReviewer(page, [
          `${user1.data.firstName}${user1.data.lastName}`,
        ]);
      });

      await test.step('Drag and Drop Glossary Term', async () => {
        await dragAndDropTerm(
          page,
          glossaryTerm1.data.displayName,
          glossaryTerm2.data.displayName
        );

        await confirmationDragAndDropGlossary(
          page,
          glossaryTerm1.data.name,
          glossaryTerm2.data.name,
          false,
          true
        );

        await expect(
          page.getByRole('cell', {
            name: glossaryTerm1.responseData.displayName,
          })
        ).not.toBeVisible();

        await performExpandAll(page);

        await expect(
          page.getByRole('cell', {
            name: glossaryTerm1.responseData.displayName,
          })
        ).toBeVisible();
      });
    } finally {
      await user1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Change glossary term hierarchy using menu options', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossaryTerm2 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1, glossaryTerm2];

    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await glossaryTerm2.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);

      await changeTermHierarchyFromModal(
        page,
        glossaryTerm2.responseData.displayName,
        glossaryTerm2.responseData.fullyQualifiedName
      );

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await expect(
        page.getByRole('cell', {
          name: glossaryTerm1.responseData.displayName,
        })
      ).not.toBeVisible();

      await performExpandAll(page);

      await expect(
        page.getByRole('cell', {
          name: glossaryTerm1.responseData.displayName,
        })
      ).toBeVisible();
    } finally {
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Change glossary term hierarchy using menu options across glossary', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossary2 = new Glossary();
    const glossaryTerm2 = new GlossaryTerm(glossary2);
    glossary1.data.terms = [glossaryTerm1];
    glossary2.data.terms = [glossaryTerm2];

    try {
      await glossary1.create(apiContext);
      await glossary2.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await glossaryTerm2.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);

      await changeTermHierarchyFromModal(
        page,
        glossaryTerm2.responseData.displayName,
        glossaryTerm2.responseData.fullyQualifiedName,
        true
      );

      // Verify the term is no longer in the source glossary (glossary1)
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await expect(
        page.getByRole('cell', {
          name: glossaryTerm1.responseData.displayName,
        })
      ).not.toBeVisible();

      await selectActiveGlossary(page, glossary2.data.displayName);

      await performExpandAll(page);

      await expect(
        page.getByRole('cell', {
          name: glossaryTerm1.responseData.displayName,
        })
      ).toBeVisible();

      await test.step('Delete glossary to verify broken relation', async () => {
        await glossary1.delete(apiContext);
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary2.data.displayName);

        // check .ant-alert-error is not visible
        await expect(page.getByTestId('alert-bar')).not.toBeVisible();
      });
    } finally {
      await glossary2.delete(apiContext);
      await afterAction();
    }
  });

  test('Assign Glossary Term to entity and check assets', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const table = new TableClass();
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];

    try {
      await table.create(apiContext);
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await table.visitEntityPage(page);
      await assignGlossaryTerm(
        page,
        glossaryTerm1.responseData,
        'Add',
        EntityTypeEndpoint.Table
      );
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await goToAssetsTab(page, glossaryTerm1.data.displayName, 1);
      const entityFqn = get(table, 'entityResponseData.fullyQualifiedName');

      await expect(
        page.getByTestId(`table-data-card_${entityFqn}`)
      ).toBeVisible();
    } finally {
      await table.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Request description task for Glossary', async ({ browser }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const user1 = new UserClass();

    try {
      await user1.create(apiContext);
      await glossary1.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      const value: TaskDetails = {
        term: glossary1.data.name,
        assignee: user1.responseData.name,
      };

      await page.getByTestId('request-description').click();

      await createDescriptionTaskForGlossary(page, value, glossary1);

      const taskResolve = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
      await page.click(
        '.ant-btn-compact-first-item:has-text("Accept Suggestion")'
      );
      await taskResolve;

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await expect(
        page.locator('[data-testid="viewer-container"]')
      ).toContainText('Updated description');
    } finally {
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Request description task for Glossary Term', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const user1 = new UserClass();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];

    try {
      await user1.create(apiContext);
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);

      const value: TaskDetails = {
        term: glossaryTerm1.data.name,
        assignee: user1.responseData.name,
      };

      await page.getByTestId('request-description').click();

      await createDescriptionTaskForGlossary(page, value, glossaryTerm1, false);

      const taskResolve = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
      await page.click(
        '.ant-btn-compact-first-item:has-text("Accept Suggestion")'
      );
      await taskResolve;

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);

      const viewerContainerText = await page.textContent(
        '[data-testid="viewer-container"]'
      );

      expect(viewerContainerText).toContain('Updated description');
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Request tags for Glossary', async ({ browser }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user2);

    const glossary1 = new Glossary();
    try {
      await glossary1.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      const value: TaskDetails = {
        term: glossary1.data.name,
        assignee: user2.responseData.name,
        tag: 'PersonalData.Personal',
      };

      await page.getByTestId('request-entity-tags').click();
      await createTagTaskForGlossary(page, value, glossary1);
      await approveTagsTask(page1, value, glossary1);
    } finally {
      await glossary1.delete(apiContext);
      await afterAction();
      await afterActionUser1();
    }
  });

  test('Delete Glossary and Glossary Term using Delete Modal', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];
    await glossary1.create(apiContext);
    await glossaryTerm1.create(apiContext);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary1.data.displayName);

    // Delete Glossary Term
    await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);
    await deleteGlossaryOrGlossaryTerm(page, glossaryTerm1.data.name, true);

    // Delete Glossary
    await deleteGlossaryOrGlossaryTerm(page, glossary1.data.name);
    await afterAction();
  });

  test('Async Delete - single delete success', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();

    try {
      await glossary1.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await expectGlossaryVisible(page, glossary1.data.displayName);

      await initiateDelete(page);

      await expect(
        page.getByRole('menuitem', { name: glossary1.data.displayName })
      ).not.toBeVisible();
    } finally {
      await afterAction();
    }
  });

  test('Async Delete - WebSocket failure triggers recovery', async ({
    browser,
  }) => {
    // Create page and set up mocked WebSocket BEFORE navigation
    const page = await browser.newPage();
    await setupMockedWebSocket(page);

    // Login on this page (WebSocket is fully mocked, no real server connection)
    const admin = new AdminClass();
    await admin.login(page);
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    const glossary1 = new Glossary();

    try {
      await glossary1.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await expectGlossaryVisible(page, glossary1.data.displayName);

      // Mock API to return success with jobId (but don't actually delete)
      const jobId = await mockDeleteApiSuccess(page, 'glossaries');

      // Initiate delete - UI will optimistically remove the glossary
      await initiateDelete(page);
      await toastNotification(page, /Delete operation initiated/i);
      await expectGlossaryNotVisible(page, glossary1.data.displayName);

      // Simulate WebSocket failure event - this should trigger recovery
      const refetch = waitForGlossaryListRefetch(page);
      emitDeleteFailure(jobId, glossary1.data.name);
      await refetch;

      // Item should be restored after failure
      await expectGlossaryVisible(page, glossary1.data.displayName);
    } finally {
      clearMockedWebSocket();
      await glossary1.delete(apiContext);
      await apiContext.dispose();
      await page.close();
    }
  });

  test('Async Delete - multiple deletes all succeed', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossaryA = new Glossary();
    const glossaryB = new Glossary();
    const glossaryC = new Glossary();

    try {
      await glossaryA.create(apiContext);
      await glossaryB.create(apiContext);
      await glossaryC.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await expectGlossaryVisible(page, glossaryA.data.displayName);
      await expectGlossaryVisible(page, glossaryB.data.displayName);
      await expectGlossaryVisible(page, glossaryC.data.displayName);

      // Delete A
      await selectActiveGlossary(page, glossaryA.data.displayName);
      await initiateDelete(page);

      // Delete B
      await selectActiveGlossary(page, glossaryB.data.displayName);
      await initiateDelete(page);

      // A and B deleted, C remains
      await expect(
        page.getByRole('menuitem', { name: glossaryA.data.displayName })
      ).not.toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: glossaryB.data.displayName })
      ).not.toBeVisible();

      await expectGlossaryVisible(page, glossaryC.data.displayName);
    } finally {
      await glossaryC.delete(apiContext);
      await afterAction();
    }
  });

  test('Async Delete - multiple deletes with mixed results', async ({
    browser,
  }) => {
    test.slow(true);

    // Create page and set up mocked WebSocket BEFORE navigation
    const page = await browser.newPage();
    await setupMockedWebSocket(page);

    // Login on this page
    const admin = new AdminClass();
    await admin.login(page);
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    const glossaryA = new Glossary();
    const glossaryB = new Glossary();
    const glossaryC = new Glossary();

    try {
      await glossaryA.create(apiContext);
      await glossaryB.create(apiContext);
      await glossaryC.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await expectGlossaryVisible(page, glossaryA.data.displayName);
      await expectGlossaryVisible(page, glossaryB.data.displayName);
      await expectGlossaryVisible(page, glossaryC.data.displayName);

      // Delete A (succeeds - not mocked, real deletion)
      await selectActiveGlossary(page, glossaryA.data.displayName);
      await initiateDelete(page);
      await toastNotification(page, /Delete operation initiated/i);

      // Delete B (fails via mocked WebSocket event)
      await selectActiveGlossary(page, glossaryB.data.displayName);
      const jobIdB = await mockDeleteApiSuccess(page, 'glossaries');
      await initiateDelete(page);
      await toastNotification(page, /Delete operation initiated/i);

      const refetch = waitForGlossaryListRefetch(page);
      emitDeleteFailure(jobIdB, glossaryB.data.name);
      await refetch;

      // A deleted, B restored, C untouched
      await expect(
        page.getByRole('menuitem', { name: glossaryA.data.displayName })
      ).not.toBeVisible();

      await expectGlossaryVisible(page, glossaryB.data.displayName);
      await expectGlossaryVisible(page, glossaryC.data.displayName);
    } finally {
      clearMockedWebSocket();
      await glossaryB.delete(apiContext);
      await glossaryC.delete(apiContext);
      await apiContext.dispose();
      await page.close();
    }
  });

  test('Verify Expand All For Nested Glossary Terms', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    await glossary1.create(apiContext);
    await glossaryTerm1.create(apiContext);
    const glossaryTerm2 = new GlossaryTerm(
      glossary1,
      glossaryTerm1.responseData.fullyQualifiedName
    );
    await glossaryTerm2.create(apiContext);
    const glossaryTerm3 = new GlossaryTerm(
      glossary1,
      glossaryTerm2.responseData.fullyQualifiedName
    );
    await glossaryTerm3.create(apiContext);

    try {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);
      await page.getByTestId('terms').click();
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await performExpandAll(page);

      await expect(
        page.getByRole('cell', { name: glossaryTerm2.data.displayName })
      ).toBeVisible();
      await expect(
        page.getByRole('cell', { name: glossaryTerm3.data.displayName })
      ).toBeVisible();
    } finally {
      await glossaryTerm3.delete(apiContext);
      await glossaryTerm2.delete(apiContext);
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Column selection and visibility for Glossary Terms table', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossaryTerm2 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1, glossaryTerm2];

    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await glossaryTerm2.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await test.step(
        'Open column dropdown and select columns and check if they are visible',
        async () => {
          await openColumnDropdown(page);
          const checkboxLabels = ['Reviewer', 'Synonyms'];
          await selectColumns(page, checkboxLabels);
          await verifyColumnsVisibility(page, checkboxLabels, true);

          await page.reload();
          await page.waitForLoadState('networkidle');
          await verifyColumnsVisibility(page, checkboxLabels, true);
        }
      );

      await test.step(
        'Open column dropdown and deselect columns and check if they are hidden',
        async () => {
          await openColumnDropdown(page);
          const checkboxLabels = ['Reviewer', 'Owners'];
          await deselectColumns(page, checkboxLabels);
          await verifyColumnsVisibility(page, checkboxLabels, false);

          await page.reload();
          await page.waitForLoadState('networkidle');
          await verifyColumnsVisibility(page, checkboxLabels, false);
        }
      );

      await test.step('View All columns selection', async () => {
        await toggleBulkActionColumnsSelection(page, false);
        const tableColumns = [
          'TERMS',
          'DESCRIPTION',
          'REVIEWER',
          'SYNONYMS',
          'OWNERS',
          'STATUS',
          'ACTIONS',
        ];
        await verifyAllColumns(page, tableColumns, true);

        await page.reload();
        await page.waitForLoadState('networkidle');
        await verifyAllColumns(page, tableColumns, true);
      });

      await test.step('Hide All columns selection', async () => {
        await toggleBulkActionColumnsSelection(page, true);
        const tableColumns = [
          'DESCRIPTION',
          'REVIEWER',
          'SYNONYMS',
          'OWNERS',
          'STATUS',
        ];
        await verifyAllColumns(page, tableColumns, false);

        await page.reload();
        await page.waitForLoadState('networkidle');
        await verifyAllColumns(page, tableColumns, false);
      });
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossaryTerm2.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Glossary Terms Table Status filtering', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossaryTerm2 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1, glossaryTerm2];

    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await glossaryTerm2.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await test.step(
        'Deselect status and check if the table has filtered rows',
        async () => {
          await filterStatus(page, ['Draft'], ['Approved']);
        }
      );

      await test.step(
        'Re-select the status and check if it appears again',
        async () => {
          await filterStatus(page, ['Draft'], ['Draft', 'Approved']);
        }
      );
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossaryTerm2.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Column dropdown drag-and-drop functionality for Glossary Terms table', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];
    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await openColumnDropdown(page);
      const dragColumn = 'Status';
      const dropColumn = 'Owners';
      await dragAndDropColumn(page, dragColumn, dropColumn);
      await page.waitForSelector('thead th', { state: 'visible' });
      const columnHeaders = page.locator('thead th');
      const columnText = await columnHeaders.allTextContents();

      expect(columnText).toEqual(
        columnText.includes('Actions')
          ? ['Terms', 'Description', 'Owners', 'Status', 'Actions']
          : ['Terms', 'Description', 'Owners', 'Status']
      );
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Glossary Term Update in Glossary Page should persist tree', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    await glossary1.create(apiContext);
    await glossaryTerm1.create(apiContext);
    const glossaryTerm2 = new GlossaryTerm(
      glossary1,
      glossaryTerm1.responseData.fullyQualifiedName
    );
    await glossaryTerm2.create(apiContext);
    const glossaryTerm3 = new GlossaryTerm(
      glossary1,
      glossaryTerm2.responseData.fullyQualifiedName
    );
    await glossaryTerm3.create(apiContext);

    try {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await performExpandAll(page);

      await expect(
        page.getByRole('cell', { name: glossaryTerm1.data.displayName })
      ).toBeVisible();

      await expect(
        page.getByRole('cell', { name: glossaryTerm2.data.displayName })
      ).toBeVisible();

      await expect(
        page.getByRole('cell', { name: glossaryTerm3.data.displayName })
      ).toBeVisible();

      await updateGlossaryTermDataFromTree(
        page,
        glossaryTerm2.responseData.fullyQualifiedName
      );
    } finally {
      await glossaryTerm3.delete(apiContext);
      await glossaryTerm2.delete(apiContext);
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Add Glossary Term inside another Term', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    const glossary2 = new Glossary();
    glossary2.data.terms = [new GlossaryTerm(glossary2)];

    try {
      await glossary1.create(apiContext);
      await glossaryTerm1.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);
      await page.getByTestId('terms').click();

      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await createGlossaryTerm(
        page,
        glossary2.data.terms[0].data,
        'Approved',
        false,
        true
      );
    } finally {
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Check for duplicate Glossary Term', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary('PW_TEST_GLOSSARY');
    const glossaryTerm1 = new GlossaryTerm(
      glossary1,
      undefined,
      'PW_TEST_TERM'
    );
    const glossaryTerm2 = new GlossaryTerm(
      glossary1,
      undefined,
      'Pw_test_term'
    );
    await glossary1.create(apiContext);

    try {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      await test.step('Create Glossary Term One', async () => {
        await fillGlossaryTermDetails(page, glossaryTerm1.data, false, false);

        const glossaryTermResponse = page.waitForResponse(
          '/api/v1/glossaryTerms'
        );
        await page.click('[data-testid="save-glossary-term"]');
        await glossaryTermResponse;
      });

      await test.step('Create Glossary Term Two', async () => {
        await fillGlossaryTermDetails(page, glossaryTerm2.data, false, false);

        const glossaryTermResponse = page.waitForResponse(
          '/api/v1/glossaryTerms'
        );
        await page.click('[data-testid="save-glossary-term"]');
        await glossaryTermResponse;

        await expect(page.locator('#name_help')).toHaveText(
          `A term with the name '${glossaryTerm2.data.name}' already exists in '${glossary1.data.name}' glossary.`
        );
      });
    } finally {
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test('Check for duplicate Glossary Term with Glossary having dot in name', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(
      glossary1,
      undefined,
      'PW_TEST_TERM'
    );
    const glossaryTerm2 = new GlossaryTerm(
      glossary1,
      undefined,
      'Pw_test_term'
    );
    await glossary1.create(apiContext);

    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary1.data.displayName);

    await test.step('Create Glossary Term One', async () => {
      await fillGlossaryTermDetails(page, glossaryTerm1.data, false, false);

      const glossaryTermResponse = page.waitForResponse(
        '/api/v1/glossaryTerms'
      );
      await page.click('[data-testid="save-glossary-term"]');
      await glossaryTermResponse;
    });

    await test.step('Create Glossary Term Two', async () => {
      await fillGlossaryTermDetails(page, glossaryTerm2.data, false, false);

      const glossaryTermResponse = page.waitForResponse(
        '/api/v1/glossaryTerms'
      );
      await page.click('[data-testid="save-glossary-term"]');
      await glossaryTermResponse;

      await expect(page.locator('#name_help')).toHaveText(
        `A term with the name '${glossaryTerm2.data.name}' already exists in '${glossary1.responseData.fullyQualifiedName}' glossary.`
      );
    });
  });

  test('Verify Glossary Deny Permission', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    const { dataConsumerUser, glossary1, cleanup } =
      await setupGlossaryDenyPermissionTest(apiContext, true);

    const { page: dataConsumerPage, afterAction: consumerAfterAction } =
      await performUserLogin(browser, dataConsumerUser);

    await redirectToHomePage(dataConsumerPage);
    await sidebarClick(dataConsumerPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(
      dataConsumerPage,
      glossary1.data.displayName,
      false
    );

    await expect(
      dataConsumerPage.getByTestId('permission-error-placeholder')
    ).toBeVisible();

    await expect(
      dataConsumerPage.getByTestId('permission-error-placeholder')
    ).toHaveText(
      "You don't have necessary permissions. Please check with the admin to get the View Glossary permission."
    );

    await consumerAfterAction();
    await cleanup(apiContext);
    await afterAction();
  });

  test('Verify Glossary Term Deny Permission', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    const { dataConsumerUser, glossary1, glossaryTerm1, cleanup } =
      await setupGlossaryDenyPermissionTest(apiContext, false);
    glossary1.data.terms = [glossaryTerm1];

    const { page: dataConsumerPage, afterAction: consumerAfterAction } =
      await performUserLogin(browser, dataConsumerUser);

    await redirectToHomePage(dataConsumerPage);
    await sidebarClick(dataConsumerPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(dataConsumerPage, glossary1.data.displayName);
    await dataConsumerPage.getByTestId(glossaryTerm1.data.displayName).click();

    await expect(
      dataConsumerPage.getByTestId('permission-error-placeholder')
    ).toBeVisible();

    await expect(
      dataConsumerPage.getByTestId('permission-error-placeholder')
    ).toHaveText(
      "You don't have necessary permissions. Please check with the admin to get the  permission."
    );

    await consumerAfterAction();
    await cleanup(apiContext);
    await afterAction();
  });

  // Need to fix the workflow from BE end, as it constantly failing in the AUT's
  test.skip('Term should stay approved when changes made by reviewer', async ({
    browser,
  }) => {
    test.slow(true);

    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: reviewerPage, afterAction: reviewerAfterAction } =
      await performUserLogin(browser, user4);

    try {
      await glossary.create(apiContext);
      await glossary.patch(apiContext, [
        {
          op: 'add',
          path: '/reviewers/0',
          value: {
            id: user4.responseData.id,
            type: 'user',
            displayName: user4.responseData.displayName,
            fullyQualifiedName: user4.responseData.fullyQualifiedName,
            name: user4.responseData.name,
          },
        },
      ]);

      await glossaryTerm.create(apiContext);

      await test.step(
        'Navigate to glossary and verify workflow widget',
        async () => {
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(page, glossary.data.displayName);

          await verifyWorkflowInstanceExists(
            page,
            glossaryTerm.responseData.fullyQualifiedName
          );

          // Test workflow widget on hover
          const escapedFqn = glossaryTerm.data.fullyQualifiedName.replace(
            /"/g,
            '\\"'
          );
          const statusSelector = `[data-testid="${escapedFqn}-status"]`;
          await page.hover(statusSelector);

          await expect(
            page.locator('[data-testid="workflow-history-widget"]')
          ).toBeVisible();

          await clickOutside(page);

          // Test workflow widget on term details page
          await selectActiveGlossaryTerm(page, glossaryTerm.data.displayName);

          await expect(
            page.locator('[data-testid="workflow-history-widget"]')
          ).toBeVisible();
        }
      );

      await test.step('Perform Changes by reviewer', async () => {
        await redirectToHomePage(reviewerPage);
        await sidebarClick(reviewerPage, SidebarItem.GLOSSARY);
        await selectActiveGlossary(reviewerPage, glossary.data.displayName);
        await selectActiveGlossaryTerm(
          reviewerPage,
          glossaryTerm.data.displayName
        );

        await updateDescription(
          reviewerPage,
          'Demo description to be updated',
          true
        );

        await verifyGlossaryWorkflowReviewerCase(
          reviewerPage,
          glossaryTerm.responseData.fullyQualifiedName
        );

        const waitForInstanceRes = reviewerPage.waitForResponse(
          '/api/v1/governance/workflowInstanceStates/GlossaryTermApprovalWorkflow/*'
        );
        await reviewerPage.reload();
        await waitForInstanceRes;
        await reviewerPage.getByTestId('workflow-history-widget').click();

        await expect(
          reviewerPage
            .getByTestId('workflow-history-widget')
            .getByText('Auto-Approved by Reviewer')
        ).toBeVisible();
      });
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
      await reviewerAfterAction();
    }
  });

  test('Glossary creation with domain selection', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, adminUser);
    const domain = new Domain();
    const glossary = new Glossary();

    try {
      await test.step('Create domain', async () => {
        await domain.create(apiContext);
      });

      await test.step('Navigate to Glossary page', async () => {
        await redirectToHomePage(page1);
        await sidebarClick(page1, SidebarItem.GLOSSARY);

        await page1.getByTestId('domain-dropdown').click();

        const searchDomain = page1.waitForResponse(
          `/api/v1/search/query?q=*${encodeURIComponent(domain.data.name)}*`
        );
        await page1
          .getByTestId('domain-selectable-tree')
          .getByTestId('searchbar')
          .fill(domain.data.name);
        await searchDomain;

        await page1.getByTestId(`tag-"${domain.data.name}"`).click();

        await page1.waitForLoadState('networkidle');
        await page1.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
      });

      await test.step('Open Add Glossary form', async () => {
        await page1.click('[data-testid="add-glossary"]');
        await page1.waitForSelector('[data-testid="form-heading"]');

        await expect(page1.locator('[data-testid="form-heading"]')).toHaveText(
          'Add Glossary'
        );

        await page1.fill('[data-testid="name"]', glossary.data.name);
        await page1.locator(descriptionBox).fill(glossary.data.description);
      });

      await test.step(
        'Save glossary and verify creation with domain',
        async () => {
          const glossaryResponse = page1.waitForResponse('/api/v1/glossaries');
          await page1.click('[data-testid="save-glossary"]');
          await glossaryResponse;

          await expect(page1).toHaveURL(/\/glossary\//);

          await expect(
            page1.locator('[data-testid="entity-header-name"]')
          ).toContainText(glossary.data.name);

          await expect(
            page1.locator('[data-testid="domain-link"]')
          ).toContainText(domain.data.displayName);
        }
      );
    } finally {
      await afterAction();
      await afterActionUser1();
    }
  });

  test('Create glossary, change language to Dutch, and delete glossary', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();

    try {
      await test.step('Create Glossary via API', async () => {
        await glossary.create(apiContext);
      });

      await test.step('Navigate to Glossary page', async () => {
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');
        await selectActiveGlossary(page, glossary.data.displayName);
        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');

        await expect(page.getByTestId('entity-header-display-name')).toHaveText(
          glossary.data.displayName
        );
      });

      await test.step('Change application language to German', async () => {
        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');
        const languageDropdown = page
          .locator('.nav-bar-side-items button.ant-dropdown-trigger')
          .filter({ hasText: 'EN' })
          .first();
        await languageDropdown.click();

        const germanOption = page.getByRole('menuitem', {
          name: 'Deutsch - DE',
        });
        await germanOption.click();

        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');
      });

      await test.step(
        'Open delete modal and verify delete confirmation',
        async () => {
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await waitForAllLoadersToDisappear(page);
          await page.waitForLoadState('networkidle');
          await selectActiveGlossary(page, glossary.data.displayName);
          await waitForAllLoadersToDisappear(page);
          await page.waitForLoadState('networkidle');

          await page.getByTestId('manage-button').click();
          await page.getByTestId('delete-button').click();

          await expect(page.locator('[role="dialog"]')).toBeVisible();
          await expect(page.getByTestId('modal-header')).toContainText(
            glossary.data.name
          );

          await expect(page.getByTestId('body-text')).toContainText('DELETE');

          const confirmationInput = page.getByTestId('confirmation-text-input');

          await expect(confirmationInput).toBeVisible();

          await confirmationInput.fill('DELETE');

          await page.getByTestId('confirm-button').click();

          await toastNotification(
            page,
            new RegExp(`.*${glossary.data.name}.*`)
          );
        }
      );

      await test.step('Change language back to English', async () => {
        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');
        const languageDropdown = page
          .locator('.nav-bar-side-items button.ant-dropdown-trigger')
          .filter({ hasText: 'DE' })
          .first();
        await languageDropdown.click();

        const englishOption = page.getByRole('menuitem', {
          name: 'English - EN',
        });
        await englishOption.click();
      });
    } finally {
      await afterAction();
    }
  });

  /**
   * Tests that verify UI handles entities with deleted descriptions gracefully.
   * The issue occurs when:
   * 1. An entity is created with a description
   * 2. The description is later deleted/cleared via API patch
   * 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL))
   * 4. UI should handle this gracefully instead of crashing
   */
  test('should handle glossary after description is deleted', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      // Delete the description via API PATCH
      await apiContext.patch(`/api/v1/glossaries/${glossary.responseData.id}`, {
        data: [
          {
            op: 'remove',
            path: '/description',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      // Navigate to the glossary page using displayName
      await visitGlossaryPage(page, glossary.responseData.displayName);

      // Verify the glossary page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should handle glossary term after description is deleted', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      // Delete the description via API PATCH to simulate the scenario
      await apiContext.patch(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
        {
          data: [
            {
              op: 'remove',
              path: '/description',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Navigate to the glossary page using displayName
      await visitGlossaryPage(page, glossary.responseData.displayName);

      // Wait for the table to load
      await page.waitForSelector('[data-testid="glossary-terms-table"]');

      // Verify the table renders without crashing
      const table = page.getByTestId('glossary-terms-table');

      await expect(table).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();

      // Click on the term to view details
      await page.getByTestId(glossaryTerm.responseData.displayName).click();

      // Verify the term details page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error on details page
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('Create glossary with all optional fields (tags, owners, reviewers, domain)', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const domain = new Domain();
    const glossary = new Glossary();
    const tagFqn = 'PersonalData.Personal';

    glossary.data.tags = [tagFqn];
    glossary.data.owners = [{ name: user1.getUserDisplayName(), type: 'user' }];
    glossary.data.reviewers = [
      { name: user3.getUserDisplayName(), type: 'user' },
    ];

    try {
      await domain.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.waitForSelector('[data-testid="form-heading"]');

      await page.fill('[data-testid="name"]', glossary.data.name);
      await page.locator(descriptionBox).fill(glossary.data.description);

      await page.click('[data-testid="tag-selector"]');
      await page.fill(
        '[data-testid="tag-selector"] input[type="search"]',
        tagFqn
      );

      await expect(page.getByTestId(`tag-${tagFqn}`)).toBeVisible();

      await page.getByTestId(`tag-${tagFqn}`).click();
      await page.click('[data-testid="right-panel"]');

      await addMultiOwnerInDialog({
        page,
        ownerNames: [user1.getUserDisplayName()],
        activatorBtnLocator: '[data-testid="add-owner"]',
        resultTestId: 'owner-container',
        endpoint: EntityTypeEndpoint.Glossary,
        isSelectableInsideForm: true,
        type: 'Users',
      });
      await clickOutside(page);

      await expect(
        page.locator('[data-testid="select-owner-tabs"]')
      ).toHaveCount(0);

      await addMultiOwnerInDialog({
        page,
        ownerNames: [user3.getUserDisplayName()],
        activatorBtnLocator: '[data-testid="add-reviewers"]',
        resultTestId: 'reviewers-container',
        endpoint: EntityTypeEndpoint.Glossary,
        isSelectableInsideForm: true,
        type: 'Users',
      });

      await page.getByTestId('add-domain').click();
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain.data.name);

      await expect(page.getByTestId(`tag-"${domain.data.name}"`)).toBeVisible();

      await page.getByTestId(`tag-"${domain.data.name}"`).click();

      const glossaryResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaries') &&
          response.request().method() === 'POST'
      );
      await page.click('[data-testid="save-glossary"]');
      await glossaryResponse;

      await expect(page.locator('[data-testid="domain-link"]')).toContainText(
        domain.data.displayName
      );
      await expect(
        page
          .getByTestId('glossary-right-panel-owner-link')
          .getByTestId(user1.getUserDisplayName())
      ).toBeVisible();
      await expect(
        page.getByTestId('glossary-reviewer').getByTestId('owner-link')
      ).toContainText(user3.getUserDisplayName());
      await expect(page.getByTestId(`tag-${tagFqn}`)).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Create glossary term via row action (+) button', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();
    const parentTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await parentTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await performExpandAll(page);

      const escapedParentFqn = parentTerm.responseData.fullyQualifiedName
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const parentRow = page.locator(`[data-row-key="${escapedParentFqn}"]`);
      await parentRow.getByTestId('add-classification').click();

      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      const childTermName = `ChildTerm_${uuid()}`;
      await page.getByTestId('name').fill(childTermName);
      await page
        .locator(descriptionBox)
        .fill('Child term created via row action');

      const createRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      await createRes;

      await expect(
        page.locator('[role="dialog"].edit-glossary-modal')
      ).not.toBeVisible();

      await performExpandAll(page);

      await expect(page.getByTestId(childTermName)).toBeVisible();
    } finally {
      await parentTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('Create term with synonyms during creation', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();

    let createdTermFqn: string | undefined;

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossary.responseData.fullyQualifiedName
        )}`
      );
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.click('[data-testid="add-new-tag-button-header"]');
      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      const termName = `P1TermSyn_${uuid()}`;
      const synonyms = [`Syn_${uuid()}`, `Syn_${uuid()}`];

      const termModal = page.locator('.edit-glossary-modal');
      await termModal.getByTestId('name').fill(termName);
      await termModal
        .locator(descriptionBox)
        .fill('Term created with synonyms');

      const synonymsSelect = termModal.getByTestId('synonyms');
      await synonymsSelect.click();

      const synonymsInput = synonymsSelect.locator('input').first();
      for (const synonym of synonyms) {
        await synonymsInput.fill(synonym);
        await synonymsInput.press('Enter');
      }

      const createRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      const createdResponse = await createRes;
      const createdTerm = await createdResponse.json();
      createdTermFqn = createdTerm.fullyQualifiedName;

      const createdSynonyms = (createdTerm.synonyms ?? []).map(
        (s: string | { name?: string; value?: string }) =>
          typeof s === 'string' ? s : s?.name ?? s?.value ?? String(s)
      );

      expect(createdSynonyms).toEqual(expect.arrayContaining(synonyms));
    } finally {
      if (createdTermFqn) {
        await apiContext.delete(
          `/api/v1/glossaryTerms/name/${encodeURIComponent(
            createdTermFqn
          )}?recursive=true&hardDelete=true`
        );
      }
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('Create term with references during creation', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();

    let createdTermFqn: string | undefined;

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossary.responseData.fullyQualifiedName
        )}`
      );
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.click('[data-testid="add-new-tag-button-header"]');
      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      const termName = `P1TermRef_${uuid()}`;
      const references = [
        { name: `Ref_${uuid()}`, endpoint: 'https://example.com/ref-1' },
        { name: `Ref_${uuid()}`, endpoint: 'https://example.com/ref-2' },
      ];

      const termModal = page.locator('.edit-glossary-modal');
      await termModal.getByTestId('name').fill(termName);
      await termModal
        .locator(descriptionBox)
        .fill('Term created with references');

      await termModal.getByTestId('add-reference').click();
      await termModal.locator('#name-0').fill(references[0].name);
      await termModal.locator('#url-0').fill(references[0].endpoint);

      await termModal.getByTestId('add-reference').click();
      await termModal.locator('#name-1').fill(references[1].name);
      await termModal.locator('#url-1').fill(references[1].endpoint);

      const createRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      const createdResponse = await createRes;
      const createdTerm = await createdResponse.json();
      createdTermFqn = createdTerm.fullyQualifiedName;

      const verifyRes = await apiContext.get(
        `/api/v1/glossaryTerms/${createdTerm.id}`
      );
      const updatedTerm = await verifyRes.json();

      for (const reference of references) {
        expect(updatedTerm.references ?? []).toEqual(
          expect.arrayContaining([expect.objectContaining(reference)])
        );
      }
    } finally {
      if (createdTermFqn) {
        await apiContext.delete(
          `/api/v1/glossaryTerms/name/${encodeURIComponent(
            createdTermFqn
          )}?recursive=true&hardDelete=true`
        );
      }
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('Create term with related terms, tags and owners during creation', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();
    const glossaryId = uuid();
    glossary.data.name = `PW_GLOSSARY_P1_${glossaryId}`;
    glossary.data.displayName = glossary.data.name;

    const relatedTerm = EntityDataClass.glossaryTerm1;
    const ownerDisplayName = user1.getUserDisplayName();
    const tagFqn = 'PersonalData.Personal';

    let createdTermFqn: string | undefined;

    try {
      const glossaryCreateRes = await apiContext.post('/api/v1/glossaries', {
        data: {
          name: glossary.data.name,
          displayName: glossary.data.displayName,
          description: glossary.data.description,
          reviewers: [{ id: user3.responseData.id, type: 'user' }],
        },
      });
      glossary.responseData = await glossaryCreateRes.json();

      await redirectToHomePage(page);
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossary.responseData.fullyQualifiedName
        )}`
      );
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.click('[data-testid="add-new-tag-button-header"]');
      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      const termName = `P1Term_${uuid()}`;
      await page.getByTestId('name').fill(termName);
      await page
        .locator(descriptionBox)
        .fill('Term created with multiple optional fields');

      const termModal = page.locator('.edit-glossary-modal');
      const tagsSelect = termModal.locator('[data-testid="tag-selector"]');
      await tagsSelect.first().click();
      await tagsSelect.first().locator('input[type="search"]').fill(tagFqn);

      await expect(page.getByTestId(`tag-${tagFqn}`)).toBeVisible();

      await page.getByTestId(`tag-${tagFqn}`).click();
      await clickOutside(page);

      const relatedTermsSelect = termModal.getByTestId('related-terms');
      await relatedTermsSelect.click();
      await relatedTermsSelect
        .locator('input[type="search"]')
        .fill(relatedTerm.responseData.name);

      const relatedTermsDropdown = page.locator(
        '.async-tree-select-list-dropdown'
      );

      await expect(relatedTermsDropdown).toBeVisible();

      const relatedOption = relatedTermsDropdown.getByTestId(
        `tag-${relatedTerm.responseData.fullyQualifiedName}`
      );

      await expect(relatedOption).toBeVisible();

      await relatedOption.click();
      await clickOutside(page);

      await addMultiOwnerInDialog({
        page,
        ownerNames: [ownerDisplayName],
        activatorBtnLocator: '.edit-glossary-modal [data-testid="add-owner"]',
        resultTestId: 'owner-container',
        endpoint: EntityTypeEndpoint.GlossaryTerm,
        isSelectableInsideForm: true,
        type: 'Users',
      });
      await clickOutside(page);

      const createRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      const createdResponse = await createRes;
      const createdTerm = await createdResponse.json();
      createdTermFqn = createdTerm.fullyQualifiedName;

      expect(
        (createdTerm.tags ?? []).map((t: { tagFQN: string }) => t.tagFQN)
      ).toContain(tagFqn);
      expect(
        (createdTerm.relatedTerms ?? []).map(
          (t: { fullyQualifiedName: string }) => t.fullyQualifiedName
        )
      ).toContain(relatedTerm.responseData.fullyQualifiedName);
      expect(
        (createdTerm.owners ?? []).some(
          (o: { displayName?: string; name?: string }) =>
            o.displayName === ownerDisplayName || o.name === ownerDisplayName
        )
      ).toBe(true);

      expect(
        (createdTerm.reviewers ?? []).some(
          (r: { id?: string; displayName?: string; name?: string }) =>
            r.id === user3.responseData.id ||
            r.displayName === user3.getUserDisplayName() ||
            r.name === user3.getUserName()
        )
      ).toBe(true);
    } finally {
      if (createdTermFqn) {
        await apiContext.delete(
          `/api/v1/glossaryTerms/name/${encodeURIComponent(
            createdTermFqn
          )}?recursive=true&hardDelete=true`
        );
      }
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('Update glossary term display name via edit modal', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await performExpandAll(page);

      const escapedFqn = glossaryTerm.responseData.fullyQualifiedName
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
      const glossaryTermRes = page.waitForResponse(
        '/api/v1/glossaryTerms/name/*'
      );
      await termRow.getByTestId('edit-button').click();
      await glossaryTermRes;
      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      const updatedDisplayName = `${glossaryTerm.data.displayName}-updated`;
      await page.getByTestId('display-name').fill(updatedDisplayName);

      const patchRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save-glossary-term').click();
      await patchRes;

      const verifyRes = await apiContext.get(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`
      );
      const updatedTerm = await verifyRes.json();

      expect(updatedTerm.displayName).toBe(updatedDisplayName);
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // G-U02: Update glossary display name via rename modal
  test('Update glossary display name via rename modal', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Click manage button and rename
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="rename-button"]');

      await expect(page.locator('#name')).toBeVisible();

      const newName = `${glossary.data.name}-renamed`;
      await page.fill('#name', newName);

      const updateNameResponse = page.waitForResponse('/api/v1/glossaries/*');
      await page.click('[data-testid="save-button"]');
      await updateNameResponse;

      // Since rename updates left sidebar as well makes multiple requests, wait for network idle
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the name was updated in the header
      await expect(
        page.locator('[data-testid="entity-header-name"]')
      ).toHaveText(newName);

      // Update glossary object for cleanup
      glossary.responseData.name = newName;
      glossary.responseData.fullyQualifiedName = newName;
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // G-D04: Cancel glossary delete operation
  test('Cancel glossary delete operation', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await page.waitForLoadState('networkidle');

      // Open delete modal
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="delete-button"]');

      // Verify delete modal is visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="modal-header"]')).toContainText(
        glossary.data.name
      );

      // Click cancel/discard button
      await page.click('[data-testid="discard-button"]');

      // Verify modal is closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();

      // Verify glossary still exists
      await expect(
        page.locator('[data-testid="entity-header-name"]')
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-D04: Cancel term delete operation
  test('Cancel glossary term delete operation', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm.data.displayName);
      await page.waitForLoadState('networkidle');

      // Open delete modal
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="delete-button"]');

      // Verify delete modal is visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="modal-header"]')).toContainText(
        glossaryTerm.data.name
      );

      // Click cancel/discard button
      await page.click('[data-testid="discard-button"]');

      // Verify modal is closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();

      // Verify term still exists by checking header
      await expect(
        page.locator('[data-testid="entity-header-name"]')
      ).toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await user3.create(apiContext);
    await team.delete(apiContext);
    await user4.delete(apiContext);
    await afterAction();
  });
});
