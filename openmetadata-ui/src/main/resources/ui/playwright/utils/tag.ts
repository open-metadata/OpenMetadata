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
import { expect, Page } from '@playwright/test';
import { get, isUndefined } from 'lodash';
import { SidebarItem } from '../constant/sidebar';
import { PolicyRulesType } from '../support/access-control/PoliciesClass';
import { Domain } from '../support/domain/Domain';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityClass } from '../support/entity/EntityClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { TagClass } from '../support/tag/TagClass';
import {
  descriptionBox,
  descriptionBoxReadOnly,
  getApiContext,
  NAME_MIN_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  redirectToHomePage,
  uuid,
} from './common';
import { sidebarClick } from './sidebar';

export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const NEW_TAG = {
  name: `PlaywrightTag-${uuid()}`,
  displayName: `PlaywrightTag-${uuid()}`,
  renamedName: `PlaywrightTag-${uuid()}`,
  description: 'This is the PlaywrightTag',
  color: '#FF5733',
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAACFCAMAAAAKN9SOAAAAA1BMVEXmGSCqexgYAAAAI0lEQVRoge3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAHgaMeAAAUWJHZ4AAAAASUVORK5CYII=',
};

export const visitClassificationPage = async (
  page: Page,
  classificationName: string,
  classificationDisplayName: string
) => {
  await redirectToHomePage(page);
  const classificationResponse = page.waitForResponse(
    '/api/v1/classifications?**'
  );
  const fetchTags = page.waitForResponse(
    `/api/v1/tags?*parent=${classificationName}**`
  );
  await sidebarClick(page, SidebarItem.TAGS);
  await classificationResponse;

  await page.waitForLoadState('networkidle');

  await page.waitForSelector(
    '[data-testid="tags-container"] .table-container [data-testid="loader"]',
    { state: 'detached' }
  );

  await page
    .getByTestId('data-summary-container')
    .getByText(classificationDisplayName)
    .click();

  await expect(page.locator('.activeCategory')).toContainText(
    classificationDisplayName
  );

  await fetchTags;
  await page.waitForLoadState('networkidle');
  await page.waitForSelector(
    '[data-testid="tags-container"] .table-container [data-testid="loader"]',
    { state: 'detached' }
  );
};

// Other asset type that should not get from the search in explore, they are not added to the tag
export const addAssetsToTag = async (
  page: Page,
  assets: EntityClass[],
  tag: TagClass,
  otherAsset?: EntityClass[]
) => {
  await tag.visitPage(page);

  await page.waitForSelector(
    '[data-testid="tags-container"] [data-testid="loader"]',
    { state: 'detached' }
  );

  await page.getByTestId('assets').click();
  const initialFetchResponse = page.waitForResponse(
    '/api/v1/search/query?q=&index=all&from=0&size=25&deleted=false**'
  );
  await page.getByTestId('data-classification-add-button').click();

  await initialFetchResponse;

  await expect(page.getByRole('dialog')).toBeVisible();

  if (!isUndefined(otherAsset)) {
    for (const asset of otherAsset) {
      const name = get(asset, 'entityResponseData.name');
      const entityDisplayName = get(asset, 'entityResponseData.displayName');
      const visibleName = entityDisplayName ?? name;
      const searchRes = page.waitForResponse(
        `/api/v1/search/query?q=${visibleName}&index=all&from=0&size=25&**`
      );
      await page
        .getByTestId('asset-selection-modal')
        .getByTestId('searchbar')
        .fill(visibleName);
      await searchRes;

      // this is failing
      await expect(page.getByText(visibleName)).not.toBeVisible();
    }
  }

  for (const asset of assets) {
    const name = get(asset, 'entityResponseData.name');
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
    const entityDisplayName = get(asset, 'entityResponseData.displayName');
    const visibleName = entityDisplayName ?? name;

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=${visibleName}&index=all&from=0&size=25&**`
    );
    await page
      .getByTestId('asset-selection-modal')
      .getByTestId('searchbar')
      .fill(visibleName);
    await searchRes;

    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();

    await expect(
      page.locator(
        `[data-testid="table-data-card_${fqn}"] [data-testid="entity-header-name"]`
      )
    ).toContainText(visibleName);
  }

  const assetsAddRes = page.waitForResponse(`/api/v1/tags/*/assets/add`);
  await page.getByTestId('save-btn').click();
  await assetsAddRes;
};

export const removeAssetsFromTag = async (
  page: Page,
  assets: EntityClass[],
  tag: TagClass
) => {
  const res = page.waitForResponse(`/api/v1/tags/name/*`);
  await tag.visitPage(page);
  await res;

  await page.waitForSelector(
    '[data-testid="tags-container"] [data-testid="loader"]',
    { state: 'detached' }
  );

  await page.getByTestId('assets').click();
  for (const asset of assets) {
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();
  }

  const assetsRemoveRes = page.waitForResponse(`/api/v1/tags/*/assets/remove`);

  await page.getByTestId('delete-all-button').click();
  await assetsRemoveRes;

  await page.waitForLoadState('networkidle');
  await page.reload();
  await page.waitForSelector(
    '[data-testid="tags-container"] [data-testid="loader"]',
    { state: 'detached' }
  );
  await checkAssetsCount(page, 0);
};

export const checkAssetsCount = async (page: Page, count: number) => {
  await expect(
    page.getByTestId('assets').getByTestId('filter-count')
  ).toContainText(count.toString());
};

export const setupAssetsForTag = async (page: Page) => {
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  const dashboard = new DashboardClass();
  const mlModel = new MlModelClass();
  const pipeline = new PipelineClass();
  await Promise.all([
    table.create(apiContext),
    topic.create(apiContext),
    dashboard.create(apiContext),
    mlModel.create(apiContext),
    pipeline.create(apiContext),
  ]);

  const assetCleanup = async () => {
    await Promise.all([
      table.delete(apiContext),
      topic.delete(apiContext),
      dashboard.delete(apiContext),
      mlModel.delete(apiContext),
      pipeline.delete(apiContext),
    ]);
    await afterAction();
  };

  return {
    assets: [table, topic, dashboard],
    otherAsset: [mlModel, pipeline],
    assetCleanup,
  };
};

export async function submitForm(page: Page) {
  await page.getByRole('button', { name: 'Save' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Save' }).click();
}

export async function validateForm(page: Page) {
  // submit form without any data to trigger validation
  await submitForm(page);

  // error messages
  await expect(page.locator('#tags_name_help')).toBeVisible();
  await expect(page.locator('#tags_name_help')).toContainText(
    'Name is required'
  );

  await expect(page.locator('#tags_description_help')).toBeVisible();
  await expect(page.locator('#tags_description_help')).toContainText(
    'Description is required'
  );

  // validation should work for invalid names

  // min length validation
  await page.locator('[data-testid="name"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="name"]').clear();
  await page.locator('[data-testid="name"]').fill(TAG_INVALID_NAMES.MIN_LENGTH);
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR)
  ).toBeVisible();

  // max length validation
  await page.locator('[data-testid="name"]').clear();
  await page.locator('[data-testid="name"]').fill(TAG_INVALID_NAMES.MAX_LENGTH);
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR)
  ).toBeVisible();

  // with special char validation
  await page.locator('[data-testid="name"]').clear();
  await page
    .locator('[data-testid="name"]')
    .fill(TAG_INVALID_NAMES.WITH_SPECIAL_CHARS);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText(NAME_VALIDATION_ERROR)).toBeVisible();
}

export const addTagToTableColumn = async (
  page: Page,
  {
    tagName,
    tagFqn,
    tagDisplayName,
    columnNumber,
    rowName,
  }: {
    tagName: string;
    tagFqn: string;
    tagDisplayName: string;
    columnNumber: number;
    rowName: string;
  }
) => {
  await page.click(
    `[data-testid="classification-tags-${columnNumber}"] [data-testid="entity-tags"] [data-testid="add-tag"]`
  );
  await page.fill('[data-testid="tag-selector"] input', tagName);
  await page.click(`[data-testid="tag-${tagFqn}"]`);

  await expect(
    page.locator('[data-testid="tag-selector"] > .ant-select-selector')
  ).toContainText(tagDisplayName);

  const saveAssociatedTag = page.waitForResponse(`/api/v1/columns/name/**`);
  await page.click('[data-testid="saveAssociatedTag"]');
  await saveAssociatedTag;

  await page.waitForSelector('.ant-select-dropdown', {
    state: 'detached',
  });

  await expect(
    page.getByRole('row', { name: rowName }).getByTestId('tags-container')
  ).toContainText(tagDisplayName);

  await expect(
    page.locator(
      `[data-testid="classification-tags-${columnNumber}"] [data-testid="tags-container"] [data-testid="tag-${tagFqn}"]`
    )
  ).toBeVisible();
};

export const verifyTagPageUI = async (
  page: Page,
  classificationName: string,
  tag: TagClass,
  limitedAccess = false
) => {
  await redirectToHomePage(page);
  await tag.visitPage(page);

  await page.waitForSelector(
    '[data-testid="tags-container"] [data-testid="loader"]',
    { state: 'detached' }
  );

  await expect(page.getByTestId('entity-header-name')).toContainText(
    tag.data.name
  );
  await expect(page.locator(descriptionBoxReadOnly)).toContainText(
    tag.data.description
  );

  await expect(
    page.getByTestId('data-classification-add-button')
  ).toBeVisible();

  if (limitedAccess) {
    await expect(page.getByTestId('manage-button')).not.toBeVisible();
    await expect(page.getByTestId('add-domain')).not.toBeVisible();
  }

  const classificationTable = page.waitForResponse(
    `/api/v1/classifications/name/*`
  );
  await page.getByRole('link', { name: classificationName }).click();
  await classificationTable;

  const res = page.waitForResponse(`/api/v1/tags/name/*`);
  await page.getByTestId(tag.data.name).click();
  await res;

  const classificationPage = page.waitForResponse(`/api/v1/classifications*`);
  await page.getByRole('link', { name: 'Classifications' }).click();
  await classificationPage;
};

export const editTagPageDescription = async (page: Page, tag: TagClass) => {
  await redirectToHomePage(page);
  const res = page.waitForResponse(`/api/v1/tags/name/*`);
  await tag.visitPage(page);
  await res;

  await page.waitForSelector(
    '[data-testid="tags-container"] [data-testid="loader"]',
    { state: 'detached' }
  );

  await page.getByTestId('edit-description').click();

  await expect(page.getByRole('dialog')).toBeVisible();

  await page.locator(descriptionBox).clear();
  await page
    .locator(descriptionBox)
    .fill(`This is updated test description for tag ${tag.data.name}.`);

  const editDescription = page.waitForResponse(`/api/v1/tags/*`);
  await page.getByTestId('save').click();
  await editDescription;

  await expect(page.getByTestId('viewer-container')).toContainText(
    `This is updated test description for tag ${tag.data.name}.`
  );
};

export const verifyCertificationTagPageUI = async (page: Page) => {
  await visitClassificationPage(page, 'Certification', 'Certification');
  const res = page.waitForResponse(`/api/v1/tags/name/*`);
  await page.getByTestId('Gold').click();
  await res;

  await page.getByTestId('assets').click();

  await expect(
    page.getByTestId('data-classification-add-button')
  ).not.toBeVisible();
};

export const LIMITED_USER_RULES: PolicyRulesType[] = [
  {
    name: 'limitedUserEditTagRole',
    resources: [
      'apiCollection',
      'apiEndpoint',
      'apiService',
      'app',
      'appMarketPlaceDefinition',
      'bot',
      'chart',
      'classification',
      'container',
      'dashboardDataModel',
      'dashboardService',
      'database',
      'databaseSchema',
      'databaseService',
      'dataInsightChart',
      'dataInsightCustomChart',
      'dataInsightDashboard',
      'dataProduct',
      'document',
      'domain',
      'entityReportData',
      'eventsubscription',
      'feed',
      'glossary',
      'glossaryTerm',
      'ingestionPipeline',
      'kpi',
      'messagingService',
      'metadataService',
      'metric',
      'mlmodel',
      'mlmodelService',
      'page',
      'persona',
      'pipeline',
      'pipelineService',
      'policy',
      'query',
      'report',
      'role',
      'searchIndex',
      'searchService',
      'storageService',
      'storedProcedure',
      'suggestion',
      'tag',
      'team',
      'testCase',
      'testCaseResolutionStatus',
      'testCaseResult',
      'testConnectionDefinition',
      'testDefinition',
      'testSuite',
      'type',
      'user',
      'webAnalyticEvent',
      'workflow',
      'workflowDefinition',
      'workflowInstance',
      'workflowInstanceState',
    ],
    operations: ['EditTags'],
    effect: 'deny',
  },
];

export const fillTagForm = async (adminPage: Page, domain: Domain) => {
  await adminPage.fill('[data-testid="name"]', NEW_TAG.name);
  await adminPage.fill('[data-testid="displayName"]', NEW_TAG.displayName);
  await adminPage.locator(descriptionBox).fill(NEW_TAG.description);
  await adminPage.fill('[data-testid="icon-url"]', NEW_TAG.icon);
  await adminPage.fill('[data-testid="tags_color-color-input"]', NEW_TAG.color);

  await adminPage.click(
    '[data-testid="modal-container"] [data-testid="add-domain"]'
  );

  const searchDomain = adminPage.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.responseData.name)}*`
  );

  await adminPage
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.responseData.name);

  await searchDomain;

  // Wait for the tag element to be visible and ensure page is still valid
  const tagSelector = adminPage.getByTestId(
    `tag-${domain.responseData.fullyQualifiedName}`
  );
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();
};
