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
import {
  BULK_IMPORT_EXPORT_SQL_QUERY,
  RDG_ACTIVE_CELL_SELECTOR,
} from '../constant/bulkImportExport';
import { CUSTOM_PROPERTIES_ENTITIES } from '../constant/customProperty';
import {
  CUSTOM_PROPERTIES_TYPES,
  FIELD_VALUES_CUSTOM_PROPERTIES,
} from '../constant/glossaryImportExport';
import { GlobalSettingOptions } from '../constant/settings';
import {
  clickOutside,
  descriptionBox,
  descriptionBoxReadOnly,
  uuid,
} from './common';
import {
  addCustomPropertiesForEntity,
  fillTableColumnInputDetails,
} from './customProperty';
import { settingClick, SettingOptionsType } from './sidebar';

export const createGlossaryTermRowDetails = () => {
  return {
    name: `playwright,glossaryTerm ${uuid()}`,
    displayName: 'Playwright,Glossary Term',
    description: `Playwright GlossaryTerm description.
      Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
      There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    tag: 'PII.Sensitive',
    synonyms: 'playwright,glossaryTerm,testing',
    references: 'data;http:sandbox.com',
  };
};

export const fillTextInputDetails = async (page: Page, text: string) => {
  await page.keyboard.press('Enter', { delay: 100 });

  const isVisible = await page
    .locator('.ant-layout-content')
    .getByRole('textbox')
    .isVisible();

  if (!isVisible) {
    await page.keyboard.press('Enter', { delay: 100 });
  }

  const textboxLocator = page
    .locator('.ant-layout-content')
    .getByRole('textbox');

  await textboxLocator.fill(text);
  await textboxLocator.press('Enter', { delay: 100 });
};

export const fillDescriptionDetails = async (
  page: Page,
  description: string
) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter');
  await page.click(descriptionBox);

  await page.fill(descriptionBox, description);

  await page.click('[data-testid="save"]');

  await expect(page.locator(RDG_ACTIVE_CELL_SELECTOR)).not.toContainText('<p>');
};

export const fillOwnerDetails = async (page: Page, owners: string[]) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  await expect(page.getByTestId('select-owner-tabs')).toBeVisible();

  await page.waitForLoadState('networkidle');

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const userListResponse = page.waitForResponse(
    '/api/v1/search/query?q=*isBot:false*index=user_search_index*'
  );
  await page.getByRole('tab', { name: 'Users' }).click();
  await userListResponse;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page.waitForSelector('[data-testid="owner-select-users-search-bar"]', {
    state: 'visible',
  });

  await page.click('[data-testid="owner-select-users-search-bar"]');

  for (const owner of owners) {
    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.locator('[data-testid="owner-select-users-search-bar"]').clear();
    await page.fill('[data-testid="owner-select-users-search-bar"]', owner);
    await searchOwner;
    await page.waitForSelector(
      '[data-testid="select-owner-tabs"] [data-testid="loader"]',
      { state: 'detached' }
    );

    await page.getByRole('listitem', { name: owner }).click();
  }

  await page.getByTestId('selectable-list-update-btn').click();

  await page.click(RDG_ACTIVE_CELL_SELECTOR);
};

export const fillEntityTypeDetails = async (page: Page, entityType: string) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  await page.getByTestId('entity-type-select').click();
  await page.getByTitle(entityType, { exact: true }).nth(0).click();
  await page.getByTestId('inline-save-btn').click();
  await page.click(RDG_ACTIVE_CELL_SELECTOR);
};

export const fillTagDetails = async (page: Page, tag: string) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  await page.click('[data-testid="tag-selector"]');
  const waitForQueryResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );
  await page.locator('[data-testid="tag-selector"] input').fill(tag);
  await waitForQueryResponse;
  await page.click(`[data-testid="tag-${tag}"]`);
  await page.click('[data-testid="inline-save-btn"]');
  await page.click(RDG_ACTIVE_CELL_SELECTOR);
};

export const fillGlossaryTermDetails = async (
  page: Page,
  glossary: { parent: string; name: string }
) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page.click('[data-testid="tag-selector"]');
  const searchResponse = page.waitForResponse(
    `/api/v1/search/query?q=**&index=glossary_term_search_index&**`
  );
  await page.locator('[data-testid="tag-selector"] input').fill(glossary.name);
  await searchResponse;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await page.getByTestId(`tag-"${glossary.parent}"."${glossary.name}"`).click();
  await page.click('[data-testid="saveAssociatedTag"]');
  await page.click(RDG_ACTIVE_CELL_SELECTOR);
};

export const fillDomainDetails = async (
  page: Page,
  domains: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter');

  await page.click(
    '[data-testid="domain-selectable-tree"] [data-testid="searchbar"]'
  );

  const searchDomain = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domains.name)}*`
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domains.name);

  await searchDomain;

  await page.getByTestId(`tag-${domains.fullyQualifiedName}`).click();
  await page.waitForTimeout(100);
};

export const fillStoredProcedureCode = async (page: Page) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  // Wait for the loader to disappear
  await page.waitForSelector('.ant-skeleton-content', { state: 'hidden' });

  await page
    .getByTestId('code-mirror-container')
    .getByRole('textbox')
    .fill(BULK_IMPORT_EXPORT_SQL_QUERY);

  await page.getByTestId('save').click();
};

const editGlossaryCustomProperty = async (
  page: Page,
  propertyName: string,
  type: string
) => {
  await page
    .locator(
      `[data-testid=${propertyName}] [data-testid='edit-icon-right-panel']`
    )
    .click();

  if (type === CUSTOM_PROPERTIES_TYPES.STRING) {
    await page
      .getByTestId('value-input')
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.STRING);
    await page.getByTestId('inline-save-btn').click();

    await expect(
      page.getByTestId(propertyName).getByTestId('value')
    ).toHaveText(FIELD_VALUES_CUSTOM_PROPERTIES.STRING);
  }

  if (type === CUSTOM_PROPERTIES_TYPES.MARKDOWN) {
    await page.waitForSelector(descriptionBox, { state: 'visible' });

    await page
      .locator(descriptionBox)
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.MARKDOWN);

    await clickOutside(page);

    await page.getByTestId('markdown-editor').getByTestId('save').click();

    await page.waitForSelector(descriptionBox, {
      state: 'detached',
    });

    await expect(
      page.getByTestId(propertyName).locator(descriptionBoxReadOnly)
    ).toContainText('### Overview');
  }

  if (type === CUSTOM_PROPERTIES_TYPES.SQL_QUERY) {
    await page
      .getByTestId('code-mirror-container')
      .getByRole('textbox')
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.SQL_QUERY);

    await page.getByTestId('inline-save-btn').click();

    await expect(
      page.getByTestId(propertyName).locator('.CodeMirror-lines')
    ).toContainText(FIELD_VALUES_CUSTOM_PROPERTIES.SQL_QUERY);
  }

  if (type === CUSTOM_PROPERTIES_TYPES.TABLE) {
    const columns = FIELD_VALUES_CUSTOM_PROPERTIES.TABLE.columns;
    const values = FIELD_VALUES_CUSTOM_PROPERTIES.TABLE.rows.split(',');

    await page.locator('[data-testid="add-new-row"]').click();

    await fillTableColumnInputDetails(page, values[0], columns[0]);

    await fillTableColumnInputDetails(page, values[1], columns[1]);

    await page.locator('[data-testid="update-table-type-property"]').click();

    await expect(
      page.getByTestId(propertyName).getByRole('cell', { name: columns[0] })
    ).toBeVisible();

    await expect(
      page.getByTestId(propertyName).getByRole('cell', { name: values[0] })
    ).toBeVisible();
  }
};

export const fillCustomPropertyDetails = async (
  page: Page,
  propertyListName: Record<string, string>
) => {
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  // Wait for the loader to disappear
  await page.waitForSelector('.ant-skeleton-content', { state: 'hidden' });

  for (const propertyName of Object.values(CUSTOM_PROPERTIES_TYPES)) {
    await editGlossaryCustomProperty(
      page,
      propertyListName[propertyName],
      propertyName
    );
  }

  await page.getByTestId('save').click();

  await expect(page.locator('.ant-modal-wrap')).not.toBeVisible();

  await page.click(RDG_ACTIVE_CELL_SELECTOR);
};

export const fillGlossaryRowDetails = async (
  row: {
    name: string;
    displayName: string;
    description: string;
    synonyms: string;
    relatedTerm: {
      name: string;
      parent: string;
    };
    references: string;
    tag: string;
    reviewers: string[];
    owners: string[];
  },
  page: Page,
  propertyListName?: Record<string, string>
) => {
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.name);

  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('ArrowRight');

  await fillTextInputDetails(page, row.displayName);

  // Navigate to next cell and make cell editable
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillDescriptionDetails(page, row.description);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.synonyms);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillGlossaryTermDetails(page, row.relatedTerm);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.references);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTagDetails(page, row.tag);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillOwnerDetails(page, row.reviewers);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillOwnerDetails(page, row.owners);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  if (propertyListName) {
    await fillCustomPropertyDetails(page, propertyListName);
  }
};

export const validateImportStatus = async (
  page: Page,
  status: { passed: string; failed: string; processed: string }
) => {
  await page.waitForSelector('[data-testid="processed-row"]');
  const processedRow = await page.$eval(
    '[data-testid="processed-row"]',
    (el) => el.textContent
  );

  expect(processedRow).toBe(status.processed);

  const passedRow = await page.$eval(
    '[data-testid="passed-row"]',
    (el) => el.textContent
  );

  expect(passedRow).toBe(status.passed);

  const failedRow = await page.$eval(
    '[data-testid="failed-row"]',
    (el) => el.textContent
  );

  expect(failedRow).toBe(status.failed);

  await page.waitForSelector('.rdg-header-row', {
    state: 'visible',
  });
};

export const createDatabaseRowDetails = () => {
  return {
    name: `playwright,database,${uuid()}`,
    displayName: 'Playwright,Database',
    description: `Playwright Database description.
    Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
    There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    tag: 'PII.Sensitive',
    tier: 'Tier1',
    entityType: 'Database',
    retentionPeriod: '1 year',
    sourceUrl: 'www.xyz.com',
    certification: 'Certification.Gold',
  };
};

export const createDatabaseSchemaRowDetails = () => {
  return {
    name: `playwright,database,schema ${uuid()}`,
    displayName: 'Playwright,Database Schema',
    description: `Playwright Database Schema description.
    Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
    There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    tag: 'PII.Sensitive',
    tier: 'Tier1',
    retentionPeriod: '1 year',
    sourceUrl: 'www.xy,z.com',
    entityType: 'Database Schema',
    certification: 'Certification.Gold',
  };
};

export const createTableRowDetails = () => {
  return {
    name: `playwright,table ${uuid()}`,
    displayName: 'Playwright,Table',
    description: `Playwright Table description
    Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
    There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    tag: 'PII.Sensitive',
    tier: 'Tier1',
    retentionPeriod: '1 year',
    sourceUrl: 'www.xy,z.com',
    entityType: 'Table',
    certification: 'Certification.Gold',
  };
};

export const createColumnRowDetails = () => {
  return {
    name: `playwright,column ${uuid()}`,
    displayName: 'Playwright,Table column',
    description: `Playwright Table column description
    Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
    There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    dataTypeDisplay: 'struct<a:int,b:string,c:array<string>,d:struct<abc:int>>',
    dataType: 'STRUCT',
    tag: 'PII.Sensitive',
    arrayDataType: 'INT',
    dataLength: '10',
    entityType: 'Column',
  };
};

export const createStoredProcedureRowDetails = () => {
  return {
    name: `playwright,storedprocedure,${uuid()}`,
    displayName: 'Playwright,StoredProcedure',
    description: `Playwright StoredProcedure description.
      Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
      There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    tag: 'PII.Sensitive',
    tier: 'Tier1',
    entityType: 'Stored Procedure',
    retentionPeriod: '1 year',
    sourceUrl: 'www.xyz.com',
    certification: 'Certification.Gold',
  };
};

const editEntityCustomProperty = async (
  page: Page,
  propertyName: string,
  type: string
) => {
  await page
    .locator(
      `[data-testid=${propertyName}] [data-testid='edit-icon-right-panel']`
    )
    .click();

  if (type === CUSTOM_PROPERTIES_TYPES.STRING) {
    await page
      .getByTestId('value-input')
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.STRING);
    await page.getByTestId('inline-save-btn').click();
  }

  if (type === CUSTOM_PROPERTIES_TYPES.MARKDOWN) {
    await page.waitForSelector(descriptionBox, { state: 'visible' });

    await page
      .locator(descriptionBox)
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.MARKDOWN);

    await page.getByTestId('markdown-editor').getByTestId('save').click();

    await page.waitForSelector(descriptionBox, {
      state: 'detached',
    });
  }

  if (type === CUSTOM_PROPERTIES_TYPES.SQL_QUERY) {
    await page
      .getByTestId('code-mirror-container')
      .getByRole('textbox')
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.SQL_QUERY);

    await page.getByTestId('inline-save-btn').click();
  }

  if (type === CUSTOM_PROPERTIES_TYPES.TABLE) {
    const columns = FIELD_VALUES_CUSTOM_PROPERTIES.TABLE.columns;
    const values = FIELD_VALUES_CUSTOM_PROPERTIES.TABLE.rows.split(',');

    await page.locator('[data-testid="add-new-row"]').click();

    await fillTableColumnInputDetails(page, values[0], columns[0]);

    await fillTableColumnInputDetails(page, values[1], columns[1]);

    await page.locator('[data-testid="update-table-type-property"]').click();
  }
};

export const fillRowDetails = async (
  row: {
    name: string;
    displayName: string;
    description: string;
    owners: string[];
    tag: string;
    glossary: {
      name: string;
      parent: string;
    };
    tier: string;
    certification: string;
    retentionPeriod?: string;
    sourceUrl?: string;
    domains: {
      name: string;
      displayName: string;
      fullyQualifiedName?: string;
    };
  },
  page: Page,
  customPropertyRecord?: Record<string, string>
) => {
  await page.locator('.rdg-cell-name').last().click();

  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR);
  const isActive = await activeCell.isVisible();

  if (isActive) {
    await fillTextInputDetails(page, row.name);
  } else {
    // Click the name cell again
    await page.locator('.rdg-cell-name').last().click();
    await fillTextInputDetails(page, row.name);
  }

  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('ArrowRight');

  await fillTextInputDetails(page, row.displayName);

  // Navigate to next cell and make cell editable
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillDescriptionDetails(page, row.description);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillOwnerDetails(page, row.owners);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTagDetails(page, row.tag);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillGlossaryTermDetails(page, row.glossary);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  await page.click(`[data-testid="radio-btn-${row.tier}"]`);
  await page.click(`[data-testid="update-tier-card"]`);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('Enter', { delay: 100 });

  await page.click(`[data-testid="radio-btn-${row.certification}"]`);
  await page.getByTestId('update-certification').click();

  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('ArrowRight');

  if (row.retentionPeriod) {
    await fillTextInputDetails(page, row.retentionPeriod);

    await page
      .locator(RDG_ACTIVE_CELL_SELECTOR)
      .press('ArrowRight', { delay: 100 });
  }
  if (row.sourceUrl) {
    await fillTextInputDetails(page, row.sourceUrl);
    await page
      .locator(RDG_ACTIVE_CELL_SELECTOR)
      .press('ArrowRight', { delay: 100 });
  }

  await fillDomainDetails(page, row.domains);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  if (customPropertyRecord) {
    await fillCustomPropertyDetails(page, customPropertyRecord);
  }
};

export const fillColumnDetails = async (
  row: {
    name: string;
    displayName: string;
    description: string;
    dataTypeDisplay: string;
    dataType: string;
    arrayDataType: string;
    dataLength: string;
    tag: string;
    glossary: {
      name: string;
      parent: string;
    };
  },
  page: Page
) => {
  await fillTextInputDetails(page, row.name);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.displayName);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillDescriptionDetails(page, row.description);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.dataTypeDisplay);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.dataType);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.arrayDataType);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.dataLength);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTagDetails(page, row.tag);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });
  await fillGlossaryTermDetails(page, row.glossary);
};

export const pressKeyXTimes = async (
  page: Page,
  length: number,
  key: string
) => {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second delay between retries

  for (let i = 0; i < length; i++) {
    let retryCount = 0;
    let success = false;

    while (!success && retryCount < maxRetries) {
      try {
        // Wait for the active cell to be visible
        const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR);
        await activeCell.waitFor({ state: 'visible', timeout: 5000 });

        // Ensure the cell is focused
        if (!(await activeCell.isVisible())) {
          await activeCell.click({ timeout: 5000 });
        }

        // Perform the key press with a longer delay
        await activeCell.press(key, { delay: 200 });

        // Verify the key press was successful by checking if the cell is still active
        await page.waitForTimeout(100); // Small delay to allow for state updates
        const isStillActive = await activeCell.isVisible();

        if (isStillActive) {
          success = true;
        } else {
          // If cell lost focus, try to regain it
          await activeCell.click({ timeout: 5000 });
          retryCount++;
          await page.waitForTimeout(retryDelay);
        }
      } catch {
        retryCount++;
        await page.waitForTimeout(retryDelay);
      }
    }
  }
};

export const createCustomPropertiesForEntity = async (
  page: Page,
  type: GlobalSettingOptions
) => {
  let entity;
  const propertyListName: Record<string, string> = {};

  switch (type) {
    case GlobalSettingOptions.DATABASES:
      entity = CUSTOM_PROPERTIES_ENTITIES.entity_database;

      break;
    case GlobalSettingOptions.DATABASE_SCHEMA:
      entity = CUSTOM_PROPERTIES_ENTITIES.entity_databaseSchema;

      break;
    case GlobalSettingOptions.TABLES:
      entity = CUSTOM_PROPERTIES_ENTITIES.entity_table;

      break;
    default:
      break;
  }

  if (!entity) {
    return propertyListName;
  }

  const propertiesList = Object.values(CUSTOM_PROPERTIES_TYPES);

  for await (const property of propertiesList) {
    const propertyName = `pwcustomproperty${entity.name}test${uuid()}`;
    propertyListName[property] = propertyName;

    await settingClick(page, type as SettingOptionsType, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: entity,
      customType: property,
      tableConfig: {
        columns: FIELD_VALUES_CUSTOM_PROPERTIES.TABLE.columns,
      },
    });
  }

  return propertyListName;
};

export const fillRecursiveEntityTypeFQNDetails = async (
  fullyQualifiedName: string,
  entityType: string,
  page: Page
) => {
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillEntityTypeDetails(page, entityType);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, fullyQualifiedName);
};

export const fillRecursiveColumnDetails = async (
  row: {
    name: string;
    displayName: string;
    description: string;
    tag: string;
    glossary: {
      name: string;
      parent: string;
    };
    fullyQualifiedName: string;
    entityType: string;
    dataTypeDisplay: string;
    dataType: string;
    arrayDataType: string;
    dataLength: string;
  },
  page: Page
) => {
  await page.locator('.rdg-cell-name').last().click();

  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR);
  const isActive = await activeCell.isVisible();

  if (isActive) {
    await fillTextInputDetails(page, row.name);
  } else {
    // Click the name cell again
    await page.locator('.rdg-cell-name').last().click();
    await fillTextInputDetails(page, row.name);
  }

  await page.locator(RDG_ACTIVE_CELL_SELECTOR).press('ArrowRight');

  await fillTextInputDetails(page, row.displayName);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillDescriptionDetails(page, row.description);

  await pressKeyXTimes(page, 2, 'ArrowRight');

  await fillTagDetails(page, row.tag);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });
  await fillGlossaryTermDetails(page, row.glossary);

  await pressKeyXTimes(page, 7, 'ArrowRight');

  await fillEntityTypeDetails(page, row.entityType);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.fullyQualifiedName);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.dataTypeDisplay);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.dataType);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.arrayDataType);

  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.dataLength);
};

export const firstTimeGridAddRowAction = async (page: Page) => {
  const firstRow = page.locator('.rdg-row').first();
  if ((await firstRow.count()) > 0) {
    const firstCell = page
      .locator('.rdg-row')
      .first()
      .locator('.rdg-cell')
      .first();

    await expect(firstCell).toBeFocused();

    await page.click('[data-testid="add-row-btn"]');

    await expect(firstCell).not.toBeFocused(); // focus should get removed from first cell
  } else {
    await page.click('[data-testid="add-row-btn"]');
  }

  const lastRowFirstCell = page
    .locator('.rdg-row')
    .last()
    .locator('.rdg-cell')
    .first();

  await expect(lastRowFirstCell).toBeFocused();
};
