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
import { SidebarItem } from '../../constant/sidebar';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getRandomLastName,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  addAssetToGlossaryTerm,
  approveGlossaryTermTask,
  createGlossary,
  createGlossaryTerms,
  goToAssetsTab,
  renameGlossaryTerm,
  selectActiveGlossary,
  validateGlossaryTerm,
  verifyGlossaryDetails,
  verifyGlossaryTermAssets,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';
import { performUserLogin } from '../../utils/user';

const user1 = new UserClass();
const user2 = new UserClass();
const team = new TeamClass();

test.describe('Glossary tests', () => {
  test.beforeAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await user2.create(apiContext);
    await user1.create(apiContext);
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
      await performUserLogin(browser, user1);
    const glossary1 = new Glossary();
    glossary1.data.owners = [{ name: 'admin', type: 'user' }];
    glossary1.data.mutuallyExclusive = true;
    glossary1.data.reviewers = [{ name: user1.getUserName(), type: 'user' }];
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

    await test.step('Approve Glossary Term from Glossary Listing', async () => {
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary1.data.name);

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
    });

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

    await test.step('Approve Glossary Term from Glossary Listing', async () => {
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary2.data.name);
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
    });

    await glossary2.delete(apiContext);
    await afterAction();
  });

  test('Add and Remove Assets', async ({ browser }) => {
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
          'text=Adding a new Asset is easy, just give it a spin!'
        );

        await dashboardEntity.visitEntityPage(page);

        // Dashboard Entity Right Panel
        await page.click(
          '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="add-tag"]'
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
          '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="add-tag"]'
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
        const glossaryContainer = await page.locator(
          '[data-testid="entity-right-panel"] [data-testid="glossary-container"]'
        );
        const glossaryContainerText = await glossaryContainer.innerText();

        expect(glossaryContainerText).toContain(glossaryTerm3.data.displayName);
        expect(glossaryContainerText).toContain(glossaryTerm4.data.displayName);

        // Check if the icons are present

        const icons = await page.locator(
          '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="glossary-icon"]'
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
        const icon = await page.locator(
          '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] [data-testid="glossary-icon"]'
        );

        expect(await icon.isVisible()).toBe(true);

        await sidebarClick(page, SidebarItem.GLOSSARY);

        await selectActiveGlossary(page, glossary2.data.displayName);
        await goToAssetsTab(page, glossaryTerm3.data.displayName, 2);

        // Check if the selected asset are present
        const assetContainer = await page.locator(
          '[data-testid="table-container"] .assets-data-container'
        );

        const assetContainerText = await assetContainer.innerText();

        expect(assetContainerText).toContain(dashboardEntity.entity.name);
        expect(assetContainerText).toContain(dashboardEntity.charts.name);
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
    const topic = new TopicClass();
    const dashboard = new DashboardClass();

    await table.create(apiContext);
    await topic.create(apiContext);
    await dashboard.create(apiContext);

    const glossary1 = new Glossary();
    const glossaryTerm1 = new GlossaryTerm(glossary1);
    glossary1.data.terms = [glossaryTerm1];
    await glossary1.create(apiContext);
    await glossaryTerm1.create(apiContext);

    const assets = [table, topic, dashboard];

    try {
      await test.step('Rename Glossary Term', async () => {
        const newName = `PW.${uuid()}%${getRandomLastName()}`;
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);
        await goToAssetsTab(page, glossaryTerm1.data.displayName);
        await addAssetToGlossaryTerm(page, assets);
        await renameGlossaryTerm(page, glossaryTerm1, newName);
        await verifyGlossaryTermAssets(
          page,
          glossary1.data,
          glossaryTerm1.data,
          assets.length
        );
      });

      await test.step('Rename the same entity again', async () => {
        const newName = `PW Space.${uuid()}%${getRandomLastName()}`;
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);
        await goToAssetsTab(
          page,
          glossaryTerm1.data.displayName,
          assets.length
        );
        await renameGlossaryTerm(page, glossaryTerm1, newName);
        await verifyGlossaryTermAssets(
          page,
          glossary1.data,
          glossaryTerm1.data,
          assets.length
        );
      });
    } finally {
      await table.delete(apiContext);
      await topic.delete(apiContext);
      await dashboard.delete(apiContext);
      await glossaryTerm1.delete(apiContext);
      await glossary1.delete(apiContext);
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await team.delete(apiContext);
    await afterAction();
  });
});
