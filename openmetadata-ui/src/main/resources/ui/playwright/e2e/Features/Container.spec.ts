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
import { expect, type Page } from '@playwright/test';
import { DataType } from '../../../src/generated/entity/data/table';
import { CONTAINER_CHILDREN } from '../../constant/contianer';
import { ContainerClass } from '../../support/entity/ContainerClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  assignTagToChildren,
  copyAndGetClipboardText,
  removeTagsFromChildren,
  testCopyLinkButton,
  validateCopiedLinkFormat,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { test } from '../fixtures/pages';
// Grant clipboard permissions for copy link tests
test.use({
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const container = new ContainerClass();

const S3_SERVICE_CONFIG = {
  serviceType: 'S3',
  connection: {
    config: {
      type: 'S3',
      awsConfig: {
        awsAccessKeyId: 'admin',
        awsSecretAccessKey: 'key',
        awsRegion: 'us-east-2',
        assumeRoleSessionName: 'OpenMetadataSession',
      },
      supportsMetadataExtraction: true,
    },
  },
};

test.slow(true);

// The DataAssetsHeader breadcrumb auto-collapses: when the trail is too wide for
// its row, the middle crumbs move into a `…` overflow menu (first + current crumbs
// always stay inline). These helpers read/navigate ancestors whether a crumb is
// rendered inline or hidden behind that menu, so the assertions stay valid at any
// viewport width.
const openBreadcrumbOverflowMenu = async (page: Page) => {
  await page
    .getByTestId('breadcrumb')
    .getByRole('button', { name: 'Show hidden breadcrumbs' })
    .click();

  return page.getByRole('menu', { name: 'Hidden breadcrumbs' });
};

const expectBreadcrumbToContainAncestor = async (page: Page, name: string) => {
  const breadcrumb = page.getByTestId('breadcrumb');
  await expect(breadcrumb).toBeVisible();

  const inlineCrumb = breadcrumb.getByText(name);

  if ((await inlineCrumb.count()) > 0) {
    await expect(inlineCrumb.first()).toBeVisible();
  } else {
    const menu = await openBreadcrumbOverflowMenu(page);
    await expect(menu).toContainText(name);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
};

const clickBreadcrumbAncestor = async (page: Page, name: string) => {
  const breadcrumb = page.getByTestId('breadcrumb');
  await expect(breadcrumb).toBeVisible();

  const inlineLink = breadcrumb.getByRole('link', { name });

  if ((await inlineLink.count()) > 0) {
    await inlineLink.click();
  } else {
    await openBreadcrumbOverflowMenu(page);
    await page.getByRole('menuitem', { name }).click();
  }
};

test.describe('Container entity specific tests ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );
    await container.create(apiContext, CONTAINER_CHILDREN);

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );

    await container.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ dataConsumerPage: page }) => {
    await redirectToHomePage(page);
  });

  test('Container page should show Schema and Children count', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);

    await expect(page.getByTestId('schema').getByTestId('count')).toBeVisible();
    await expect(
      page.getByTestId('children').getByTestId('count')
    ).toBeVisible();
  });

  test('Container page children pagination', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);

    // Tab is identified by EntityTabs.CHILDREN ('children'); the displayed text
    // is now 'Containers' (label.container-plural) so target the testid, not text.
    await page.getByTestId('children').click();

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2 '
    );

    // Check the second page pagination
    const childrenResponse = page.waitForResponse(
      (req) =>
        req.url().includes('/api/v1/containers/name') &&
        req.url().includes('children?limit=15&offset=15')
    );
    await page.getByTestId('next').click();
    await childrenResponse;

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 2 of 2 '
    );

    // Check around the page sizing change
    const childrenResponseSizeChange = page.waitForResponse(
      (req) =>
        req.url().includes('/api/v1/containers/name') &&
        req.url().includes('children?limit=25&offset=0')
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('25 / Page').click();
    await childrenResponseSizeChange;

    await page.locator('.ant-spin').waitFor({
      state: 'detached',
    });

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 1'
    );

    // Back to the original page size
    const childrenResponseSizeChange2 = page.waitForResponse(
      (req) =>
        req.url().includes('/api/v1/containers/name') &&
        req.url().includes('children?limit=15&offset=0')
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('15 / Page').click();
    await childrenResponseSizeChange2;

    await page.locator('.ant-spin').waitFor({
      state: 'detached',
    });

    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2'
    );
  });

  test('expand / collapse should not appear after updating nested fields for container', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction: afterSetup } =
      await getDefaultAdminAPIContext(browser);
    const nestedContainer = new ContainerClass();
    const structColName = `struct_col_${uuid()}`;
    const nestedFieldName = `nested_field_${uuid()}`;

    nestedContainer.entity.dataModel.columns = [
      {
        name: structColName,
        dataType: DataType.Struct,
        dataTypeDisplay: 'struct',
        description: 'A struct column with nested fields.',
        tags: [],
        ordinalPosition: 1,
        children: [
          {
            name: nestedFieldName,
            dataType: DataType.Varchar,
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'A nested field inside the struct.',
            tags: [],
            ordinalPosition: 1,
          },
        ],
      },
    ];

    await nestedContainer.create(apiContext);
    await afterSetup();

    await redirectToHomePage(page);
    await nestedContainer.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const structRowId =
      nestedContainer.entityResponseData.dataModel?.columns?.[0]
        .fullyQualifiedName ?? '';
    const nestedRowId =
      nestedContainer.entityResponseData.dataModel?.columns?.[0]?.children?.[0]
        .fullyQualifiedName ?? '';

    // Expand the struct column to reveal the child row
    await page
      .locator(`[data-row-key="${structRowId}"]`)
      .getByTestId('expand-icon')
      .click();
    await expect(page.locator(`[data-row-key="${nestedRowId}"]`)).toBeVisible();

    await assignTagToChildren({
      page,
      tag: 'PersonalData.Personal',
      rowId: nestedRowId,
      entityEndpoint: 'containers',
    });

    await expect(
      page.locator(`[data-row-key="${nestedRowId}"]`).getByTestId('expand-icon')
    ).not.toBeVisible();

    await removeTagsFromChildren({
      page,
      tags: ['PersonalData.Personal'],
      rowId: nestedRowId,
      entityEndpoint: 'containers',
    });
  });

  test('Copy column link button should copy the column URL to clipboard', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);

    await waitForAllLoadersToDisappear(page);

    await testCopyLinkButton({
      page,
      buttonTestId: 'copy-column-link-button',
      containerTestId: 'container-data-model-table',
      expectedUrlPath: '/container/',
      entityFqn: container.entityResponseData?.['fullyQualifiedName'] ?? '',
    });
  });

  test('Copy column link should have valid URL format', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('container-data-model-table')).toBeVisible();

    const copyButton = page.getByTestId('copy-column-link-button').first();
    await expect(copyButton).toBeVisible();

    const clipboardText = await copyAndGetClipboardText(page, copyButton);

    const validationResult = validateCopiedLinkFormat({
      clipboardText,
      expectedEntityType: 'container',
      entityFqn: container.entityResponseData?.['fullyQualifiedName'] ?? '',
    });

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.protocol).toMatch(/^https?:$/);
    expect(validationResult.pathname).toContain('container');

    // Visit the copied link to verify it opens the side panel
    await page.goto(clipboardText);

    // Verify side panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Verify the correct column is showing in the panel
    const columnName =
      container.entityResponseData?.dataModel?.columns?.[0]?.name;
    if (columnName) {
      await expect(sidePanel).toContainText(columnName);
    }

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(
      new RegExp(
        `/container/${container.entityResponseData?.['fullyQualifiedName']}$`
      )
    );
  });
});
test.describe('Deeply nested container navigation', () => {
  const serviceName = `pw-storage-service-deep-${uuid()}`;
  const deepContainer1Name = `pw-container-l1-${uuid()}`;
  const deepContainer2Name = `pw-container-l2-${uuid()}`;
  const deepContainer3Name = `pw-container-l3-${uuid()}`;
  const deepContainer4Name = `pw-container-l4-${uuid()}`;

  let deepContainer1Id = '';
  let deepContainer2Id = '';
  let deepContainer3Id = '';
  let deepContainer2Fqn = '';
  let deepContainer3Fqn = '';
  let deepContainer4Fqn = '';

  test.beforeAll('Setup deeply nested containers', async ({ browser }) => {
    test.slow(true);
    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );

    const serviceRes = await apiContext.post(
      '/api/v1/services/storageServices',
      {
        data: {
          name: serviceName,
          ...S3_SERVICE_CONFIG,
        },
      }
    );
    await serviceRes.json();

    const container1Res = await apiContext.post('/api/v1/containers', {
      data: { name: deepContainer1Name, service: serviceName },
    });
    const containerLevel1 = await container1Res.json();
    deepContainer1Id = containerLevel1.id;

    const container2Res = await apiContext.post('/api/v1/containers', {
      data: {
        name: deepContainer2Name,
        service: serviceName,
        parent: { id: deepContainer1Id, type: 'container' },
      },
    });
    const containerLevel2 = await container2Res.json();
    deepContainer2Id = containerLevel2.id;
    deepContainer2Fqn = containerLevel2.fullyQualifiedName;

    const container3Res = await apiContext.post('/api/v1/containers', {
      data: {
        name: deepContainer3Name,
        service: serviceName,
        parent: { id: deepContainer2Id, type: 'container' },
      },
    });
    const containerLevel3 = await container3Res.json();
    deepContainer3Id = containerLevel3.id;
    deepContainer3Fqn = containerLevel3.fullyQualifiedName;

    const container4Res = await apiContext.post('/api/v1/containers', {
      data: {
        name: deepContainer4Name,
        service: serviceName,
        parent: { id: deepContainer3Id, type: 'container' },
      },
    });
    const containerLevel4 = await container4Res.json();
    deepContainer4Fqn = containerLevel4.fullyQualifiedName;

    await afterAction();
  });

  test.afterAll('Clean up deeply nested containers', async ({ browser }) => {
    test.slow(true);
    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );

    await apiContext.delete(
      `/api/v1/services/storageServices/name/${encodeURIComponent(
        serviceName
      )}?recursive=true&hardDelete=true`
    );

    await afterAction();
  });

  test('should correctly load, display breadcrumbs, and navigate deeply nested containers', async ({
    page,
  }) => {
    const initialContainerResponse = page.waitForResponse(
      '/api/v1/containers/name/*'
    );
    await page.goto(`/container/${deepContainer4Fqn}`);
    await initialContainerResponse;
    await waitForAllLoadersToDisappear(page);

    await test.step('correct container loads for 5-part FQN (4 nesting levels)', async () => {
      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer4Name
      );
    });

    await test.step('breadcrumb shows all 4 ancestor levels at L4', async () => {
      const breadcrumb = page.getByTestId('breadcrumb');

      // service is the first crumb — always kept inline even when the middle
      // ancestors auto-collapse into the `…` overflow menu.
      await expect(breadcrumb).toContainText(serviceName);
      await expectBreadcrumbToContainAncestor(page, deepContainer1Name);
      await expectBreadcrumbToContainAncestor(page, deepContainer2Name);
      await expectBreadcrumbToContainAncestor(page, deepContainer3Name);
    });

    await test.step('clicking L3 breadcrumb link navigates to L3 and updates page', async () => {
      const containerResponse = page.waitForResponse(
        '/api/v1/containers/name/*'
      );
      await clickBreadcrumbAncestor(page, deepContainer3Name);
      await containerResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        new RegExp(`/container/${deepContainer3Fqn}$`)
      );
      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer3Name
      );

      const breadcrumb = page.getByTestId('breadcrumb');
      await expect(breadcrumb).toContainText(serviceName);
      await expectBreadcrumbToContainAncestor(page, deepContainer1Name);
      await expectBreadcrumbToContainAncestor(page, deepContainer2Name);
      await expect(breadcrumb).not.toContainText(deepContainer4Name);
    });

    await test.step('clicking L2 breadcrumb link navigates to L2 and updates page', async () => {
      const containerResponse = page.waitForResponse(
        '/api/v1/containers/name/*'
      );
      await clickBreadcrumbAncestor(page, deepContainer2Name);
      await containerResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        new RegExp(`/container/${deepContainer2Fqn}$`)
      );
      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer2Name
      );

      const breadcrumb = page.getByTestId('breadcrumb');
      await expect(breadcrumb).toContainText(serviceName);
      await expectBreadcrumbToContainAncestor(page, deepContainer1Name);
      await expect(breadcrumb).not.toContainText(deepContainer3Name);
      await expect(breadcrumb).not.toContainText(deepContainer4Name);
    });
  });

  test('auto-collapses the breadcrumb into an overflow menu on a narrow viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 900 });

    const initialContainerResponse = page.waitForResponse(
      '/api/v1/containers/name/*'
    );
    await page.goto(`/container/${deepContainer4Fqn}`);
    await initialContainerResponse;
    await waitForAllLoadersToDisappear(page);

    const breadcrumb = page.getByTestId('breadcrumb');

    await test.step('first and current crumbs stay inline, middle ones collapse', async () => {
      await expect(breadcrumb).toContainText(serviceName);
      await expect(breadcrumb).toContainText(deepContainer4Name);
      await expect(breadcrumb).not.toContainText(deepContainer1Name);
    });

    await test.step('overflow menu reveals the hidden ancestors', async () => {
      const menu = await openBreadcrumbOverflowMenu(page);

      await expect(menu).toContainText(deepContainer1Name);
      await expect(menu).toContainText(deepContainer2Name);

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    });

    await test.step('navigating from the overflow menu updates the page', async () => {
      const containerResponse = page.waitForResponse(
        '/api/v1/containers/name/*'
      );
      await clickBreadcrumbAncestor(page, deepContainer1Name);
      await containerResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer1Name
      );
    });
  });
});

// Children tab search + Deleted toggle.
//
// The /children listing on the Container detail page (renamed from "Children"
// to "Containers" — same EntityTabs.CHILDREN tab key) now supports:
//   - case-insensitive substring search via ?q=...
//   - the same Deleted / non-deleted Switch the service-level Containers tab
//     already had.
//
// These tests pin three behaviours that are easy to regress at the wiring
// layer (the SQL is covered by ContainerResourceIT):
//   1. Search filters the parent's direct children only — siblings of the
//      parent and their descendants must never leak into the result. This is
//      the per-parent dual of the FQN-depth predicate already enforced by
//      listDirectChildSummariesByParentHash; if a future change forwards the
//      query to a service-wide search index instead of the FQN-scoped DAO
//      method, that scoping would silently break.
//   2. The Deleted Switch flips include between non-deleted (default) and
//      deleted, hiding/showing soft-deleted children.
//   3. Search and the Deleted Switch compose — a deleted child is reachable
//      via search only when the toggle is on.
test.describe('Children tab search + Deleted toggle', () => {
  test.slow(true);

  const serviceName = `pw-storage-service-search-${uuid()}`;
  const parentName = `pw-search-parent-${uuid()}`;
  const siblingParentName = `pw-search-other-parent-${uuid()}`;

  // Suffixes are stable so search assertions don't have to thread uuids; full
  // names get a uuid baked in so the entities don't collide with prior runs.
  const aliceChildName = `pw-search-alice-${uuid()}`;
  const aliceClonedSiblingName = `pw-search-alice-clone-${uuid()}`;
  const bobChildName = `pw-search-bob-${uuid()}`;
  const carolChildName = `pw-search-carol-${uuid()}`;
  const deletedChildName = `pw-search-deleted-${uuid()}`;
  const SEARCH_TERM_ALICE = 'alice';
  const SEARCH_TERM_DELETED = 'deleted';
  const SEARCH_TERM_NO_MATCH = 'zzzdoesnotmatch';

  let parentFqn = '';

  test.beforeAll('Setup search/deleted fixtures', async ({ browser }) => {
    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );

    await apiContext.post('/api/v1/services/storageServices', {
      data: {
        name: serviceName,
        ...S3_SERVICE_CONFIG,
      },
    });

    // Two parents under the same service so we can verify search results
    // don't leak across parents. The "alice clone" sibling forces this:
    // it shares the SEARCH_TERM_ALICE substring but lives under a different
    // parent; it must NOT appear when searching from the search-parent's
    // children tab.
    const parentRes = await apiContext.post('/api/v1/containers', {
      data: { name: parentName, service: serviceName },
    });
    const parent = await parentRes.json();
    parentFqn = parent.fullyQualifiedName;

    const siblingParentRes = await apiContext.post('/api/v1/containers', {
      data: { name: siblingParentName, service: serviceName },
    });
    const siblingParent = await siblingParentRes.json();

    for (const childName of [
      aliceChildName,
      bobChildName,
      carolChildName,
      deletedChildName,
    ]) {
      await apiContext.post('/api/v1/containers', {
        data: {
          name: childName,
          service: serviceName,
          parent: { id: parent.id, type: 'container' },
        },
      });
    }

    await apiContext.post('/api/v1/containers', {
      data: {
        name: aliceClonedSiblingName,
        service: serviceName,
        parent: { id: siblingParent.id, type: 'container' },
      },
    });

    // Soft-delete one of the parent's children so the Deleted toggle has
    // something to reveal. Direct API soft-delete is faster + more reliable
    // than driving the manage-button flow for each setup run.
    const deletedChildRes = await apiContext.get(
      `/api/v1/containers/name/${encodeURIComponent(
        `${serviceName}.${parentName}.${deletedChildName}`
      )}`
    );
    const deletedChild = await deletedChildRes.json();
    await apiContext.delete(
      `/api/v1/containers/${deletedChild.id}?hardDelete=false&recursive=true`
    );

    await afterAction();
  });

  test.afterAll('Tear down search/deleted fixtures', async ({ browser }) => {
    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );

    await apiContext.delete(
      `/api/v1/services/storageServices/name/${encodeURIComponent(
        serviceName
      )}?recursive=true&hardDelete=true`
    );

    await afterAction();
  });

  test.beforeEach('Visit parent container Containers tab', async ({ page }) => {
    // Match the proven nav pattern used by the existing "Deeply nested
    // container navigation" describe in this file: register the response
    // listener BEFORE goto, then await it. The container's only tab when
    // dataModel is empty (our fixture parents) is CHILDREN, so the page
    // fires /children automatically on mount — no separate tab click needed.
    const initialChildrenResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/containers/name/`) &&
        res.url().includes('/children?') &&
        res.status() === 200
    );
    await page.goto(`/container/${parentFqn}`);
    await initialChildrenResponse;
    await waitForAllLoadersToDisappear(page);
  });

  test('search filters direct children only — sibling subtree never leaks', async ({
    page,
  }) => {
    // Baseline — all four live children of the parent are visible, the
    // soft-deleted one is hidden by default, and the alice-clone under the
    // sibling parent does not appear (it lives under a different FQN prefix).
    const childTable = page.getByTestId('container-list-table');
    await expect(childTable.getByText(aliceChildName)).toBeVisible();
    await expect(childTable.getByText(bobChildName)).toBeVisible();
    await expect(childTable.getByText(carolChildName)).toBeVisible();
    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);
    await expect(childTable.getByText(aliceClonedSiblingName)).toHaveCount(0);

    // The search request must include the parent's FQN AND the q= bind. If
    // someone wires this through the global search index, the URL would no
    // longer match this matcher and the test fails fast — exactly the scoping
    // regression we want to catch.
    const searchResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/containers/name/`) &&
        res.url().includes(encodeURIComponent(parentFqn)) &&
        res.url().includes('/children?') &&
        res.url().includes(`q=${SEARCH_TERM_ALICE}`) &&
        res.status() === 200
    );
    await page.getByTestId('searchbar').fill(SEARCH_TERM_ALICE);
    await searchResponse;
    await waitForAllLoadersToDisappear(page);

    // Filtered view: only the alice child of the search-parent. The sibling
    // parent's alice-clone shares the substring but must not appear because
    // the q= filter is applied AFTER the FQN-depth gate, not in place of it.
    await expect(childTable.getByText(aliceChildName)).toBeVisible();
    await expect(childTable.getByText(aliceClonedSiblingName)).toHaveCount(0);
    await expect(childTable.getByText(bobChildName)).toHaveCount(0);
    await expect(childTable.getByText(carolChildName)).toHaveCount(0);

    // Empty state — a substring no child contains returns zero rows. Empty
    // here means the API returned an empty page, not that the filter was
    // ignored and the previous full result is still on screen.
    const emptyResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/children?') &&
        res.url().includes(`q=${SEARCH_TERM_NO_MATCH}`) &&
        res.status() === 200
    );
    await page.getByTestId('searchbar').fill(SEARCH_TERM_NO_MATCH);
    await emptyResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(childTable.getByText(aliceChildName)).toHaveCount(0);
    await expect(childTable.getByText(bobChildName)).toHaveCount(0);
    await expect(childTable.getByText(carolChildName)).toHaveCount(0);

    // Clearing the search restores the unfiltered listing — same baseline
    // as the start of the test.
    const clearResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/children?') &&
        !res.url().includes('q=') &&
        res.status() === 200
    );
    await page.getByTestId('searchbar').fill('');
    await clearResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(childTable.getByText(aliceChildName)).toBeVisible();
    await expect(childTable.getByText(bobChildName)).toBeVisible();
    await expect(childTable.getByText(carolChildName)).toBeVisible();
  });

  test('Deleted toggle reveals and hides soft-deleted children', async ({
    page,
  }) => {
    const childTable = page.getByTestId('container-list-table');

    // Default state — non-deleted only. The soft-deleted child fixture is
    // hidden, the three live children are visible.
    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);
    await expect(childTable.getByText(aliceChildName)).toBeVisible();

    // Toggle on — include flips to 'deleted'. The deleted child appears,
    // the live children disappear (deleted-only mode, not "all").
    const deletedOnResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/children?') &&
        res.url().includes('include=deleted') &&
        res.status() === 200
    );
    await page.getByTestId('show-deleted').click();
    await deletedOnResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(childTable.getByText(deletedChildName)).toBeVisible();
    await expect(childTable.getByText(aliceChildName)).toHaveCount(0);
    await expect(childTable.getByText(bobChildName)).toHaveCount(0);

    // Toggle off — back to non-deleted. Re-fetches must hit the API and the
    // deleted child must drop out again. Pinning include=non-deleted in the
    // URL guards against the cache returning a stale page from the toggled
    // request (ChildrenPageCache key includes the include tag for this
    // reason).
    const deletedOffResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/children?') &&
        res.url().includes('include=non-deleted') &&
        res.status() === 200
    );
    await page.getByTestId('show-deleted').click();
    await deletedOffResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);
    await expect(childTable.getByText(aliceChildName)).toBeVisible();
  });

  test('search + Deleted toggle compose to find soft-deleted children by name', async ({
    page,
  }) => {
    const childTable = page.getByTestId('container-list-table');

    // Start in default mode and search for the deleted child's substring —
    // it must NOT appear because include defaults to non-deleted, regardless
    // of whether the substring matches.
    const initialSearchResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/children?') &&
        res.url().includes(`q=${SEARCH_TERM_DELETED}`) &&
        res.url().includes('include=non-deleted') &&
        res.status() === 200
    );
    await page.getByTestId('searchbar').fill(SEARCH_TERM_DELETED);
    await initialSearchResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);

    // Flip Deleted on while the search is active — the request must carry
    // BOTH q= and include=deleted, and the deleted child becomes visible.
    // Asserting on the URL params (not just the result) catches the case
    // where the toggle handler resets the search state — a likely bug if
    // the page-reset on toggle change ever drops the search value too.
    const combinedResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/children?') &&
        res.url().includes(`q=${SEARCH_TERM_DELETED}`) &&
        res.url().includes('include=deleted') &&
        res.status() === 200
    );
    await page.getByTestId('show-deleted').click();
    await combinedResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(childTable.getByText(deletedChildName)).toBeVisible();
    await expect(childTable.getByText(aliceChildName)).toHaveCount(0);
  });
});

// Multi-level scoping for the Deleted toggle.
//
// At every level of a container hierarchy, ?include=deleted shows ONLY direct
// children of that level whose own deleted=true — never grandchildren or deeper
// descendants. This pins the FQN-depth predicate (fqnHash NOT LIKE :parentHashChild)
// at the UI layer; the API-side equivalent lives in
// ContainerResourceIT#test_listChildren_includeDeleted_scopedToDirectChildrenAtEachLevel.
//
// The screenshot scenario this guards against: user soft-deletes a grandchild,
// navigates back up to the grandparent, toggles "Deleted" ON, and is surprised
// the grandchild doesn't appear. The behavior is correct (the toggle is a literal
// per-level filter, not a recursive search), but it's the kind of cross-level
// expectation that's easy to break with one accidental change to the SQL — e.g.
// dropping the depth predicate while keeping the deleted filter would silently
// start surfacing deleted descendants from any depth.
test.describe('Children tab Deleted toggle is scoped per-level', () => {
  test.slow(true);

  const serviceName = `pw-storage-service-scope-${uuid()}`;
  const grandparentName = `pw-scope-grandparent-${uuid()}`;
  const parentName = `pw-scope-parent-${uuid()}`;
  const deletedChildName = `pw-scope-deleted-grandchild-${uuid()}`;

  let grandparentFqn = '';
  let parentFqn = '';

  test.beforeAll(
    'Setup three-level chain with deleted leaf',
    async ({ browser }) => {
      const { afterAction, apiContext } = await getDefaultAdminAPIContext(
        browser
      );

      await apiContext.post('/api/v1/services/storageServices', {
        data: {
          name: serviceName,
          ...S3_SERVICE_CONFIG,
        },
      });

      const grandparentRes = await apiContext.post('/api/v1/containers', {
        data: { name: grandparentName, service: serviceName },
      });
      const grandparent = await grandparentRes.json();
      grandparentFqn = grandparent.fullyQualifiedName;

      const parentRes = await apiContext.post('/api/v1/containers', {
        data: {
          name: parentName,
          service: serviceName,
          parent: { id: grandparent.id, type: 'container' },
        },
      });
      const parent = await parentRes.json();
      parentFqn = parent.fullyQualifiedName;

      const deletedChildRes = await apiContext.post('/api/v1/containers', {
        data: {
          name: deletedChildName,
          service: serviceName,
          parent: { id: parent.id, type: 'container' },
        },
      });
      const deletedChild = await deletedChildRes.json();

      // Soft-delete the leaf via API (faster + more reliable than the manage-button
      // flow). hardDelete=false keeps the row but flips deleted=true.
      await apiContext.delete(
        `/api/v1/containers/${deletedChild.id}?hardDelete=false&recursive=true`
      );

      await afterAction();
    }
  );

  test.afterAll('Tear down three-level chain', async ({ browser }) => {
    const { afterAction, apiContext } = await getDefaultAdminAPIContext(
      browser
    );

    await apiContext.delete(
      `/api/v1/services/storageServices/name/${encodeURIComponent(
        serviceName
      )}?recursive=true&hardDelete=true`
    );

    await afterAction();
  });

  test('grandparent Deleted toggle returns empty — deleted grandchild does not bubble up', async ({
    page,
  }) => {
    const initialChildrenResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/containers/name/') &&
        res.url().includes(encodeURIComponent(grandparentFqn)) &&
        res.url().includes('/children?') &&
        res.status() === 200
    );
    await page.goto(`/container/${grandparentFqn}`);
    await initialChildrenResponse;
    await waitForAllLoadersToDisappear(page);

    const childTable = page.getByTestId('container-list-table');

    // Default mode: the alive direct child (the parent in the chain) is visible.
    // The deleted leaf is NOT — it's a grandchild, not a direct child.
    await expect(childTable.getByText(parentName)).toBeVisible();
    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);

    // Toggle ON at the grandparent level. The request must carry include=deleted
    // and the URL must still target the grandparent FQN — pinning that the toggle
    // is applied locally and not somehow widened to a service-wide search.
    const deletedResponse = page.waitForResponse(
      (res) =>
        res.url().includes(encodeURIComponent(grandparentFqn)) &&
        res.url().includes('/children?') &&
        res.url().includes('include=deleted') &&
        res.status() === 200
    );
    await page.getByTestId('show-deleted').click();
    await deletedResponse;
    await waitForAllLoadersToDisappear(page);

    // Empty: the grandparent has zero deleted DIRECT children — the deleted leaf
    // is one level deeper. Both the alive parent and the deleted grandchild are
    // absent (parent because it's not deleted, grandchild because it's not direct).
    await expect(childTable.getByText(parentName)).toHaveCount(0);
    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);
  });

  test('parent Deleted toggle reveals the deleted grandchild — its actual direct parent', async ({
    page,
  }) => {
    const initialChildrenResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/containers/name/') &&
        res.url().includes(encodeURIComponent(parentFqn)) &&
        res.url().includes('/children?') &&
        res.status() === 200
    );
    await page.goto(`/container/${parentFqn}`);
    await initialChildrenResponse;
    await waitForAllLoadersToDisappear(page);

    const childTable = page.getByTestId('container-list-table');

    // Default mode at the direct parent of the deleted leaf — the deleted leaf
    // is hidden because include defaults to non-deleted.
    await expect(childTable.getByText(deletedChildName)).toHaveCount(0);

    const deletedResponse = page.waitForResponse(
      (res) =>
        res.url().includes(encodeURIComponent(parentFqn)) &&
        res.url().includes('/children?') &&
        res.url().includes('include=deleted') &&
        res.status() === 200
    );
    await page.getByTestId('show-deleted').click();
    await deletedResponse;
    await waitForAllLoadersToDisappear(page);

    // Toggle ON at the actual direct parent — the deleted leaf appears here and
    // only here. Asserting it appears at this level (and not at the grandparent
    // in the previous test) is the dual that pins the per-level scoping.
    await expect(childTable.getByText(deletedChildName)).toBeVisible();
  });
});
