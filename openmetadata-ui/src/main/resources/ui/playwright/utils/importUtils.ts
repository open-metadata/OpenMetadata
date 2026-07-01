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
import { expect, Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BULK_IMPORT_EXPORT_SQL_QUERY,
  MAX_COLUMN_NAVIGATION_RETRIES,
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
import { waitForAllLoadersToDisappear } from './entity';
import { settingClick, SettingOptionsType } from './sidebar';

const IMPORT_GRID_LOAD_MASK_SELECTOR =
  '.om-rdg .inovua-react-toolkit-load-mask__background-layer';
const EDITOR_OPEN_TIMEOUT = 1500;
const TEXT_EDITOR_FILL_TIMEOUT = 2000;
const IMPORT_STATUS_TIMEOUT = 90000;

const waitForVisibleLocator = async (locator: Locator, timeout = 1500) => {
  try {
    await locator.waitFor({ state: 'visible', timeout });

    return true;
  } catch {
    return false;
  }
};

// The background CSV jobs launcher is a fixed bottom-right overlay that can
// pop in mid-test (e.g. an earlier export job completing) and intercept
// clicks landing in that corner. Centering the target in the viewport first
// keeps clicks away from that fixed region without touching the tray itself.
const scrollIntoViewCenter = async (locator: Locator) => {
  await locator
    .evaluate((element) =>
      element.scrollIntoView({ block: 'center', inline: 'center' })
    )
    .catch(() => undefined);
};

const getTextEditorCandidates = (page: Page) => {
  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR).first();

  return [
    activeCell.getByTestId('bulk-edit-text-cell-editor').first(),
    activeCell.locator('input, textarea').first(),
    page.getByTestId('bulk-edit-text-cell-editor').first(),
    page.locator('.bulk-edit-text-cell-editor, .rdg-text-editor').first(),
    page.locator('.ant-layout-content').getByRole('textbox').first(),
  ];
};

const fillVisibleTextEditor = async (page: Page, text: string) => {
  for (const editor of getTextEditorCandidates(page)) {
    if (!(await waitForVisibleLocator(editor, EDITOR_OPEN_TIMEOUT))) {
      continue;
    }

    try {
      await editor.evaluate((element) =>
        element.scrollIntoView({ block: 'center', inline: 'nearest' })
      );
      await editor.fill(text, { timeout: TEXT_EDITOR_FILL_TIMEOUT });
      await editor.press('Enter', { delay: 100 });

      return true;
    } catch {
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }

  return false;
};

const clickActiveGridCell = async (page: Page) => {
  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR).first();
  await scrollIntoViewCenter(activeCell);
  // eslint-disable-next-line playwright/no-force-option -- RDG can leave an overlay above the active cell editor trigger.
  await activeCell.click({ force: true });
};

const doubleClickActiveGridCell = async (page: Page) => {
  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR).first();
  await scrollIntoViewCenter(activeCell);
  // eslint-disable-next-line playwright/no-force-option -- RDG can leave an overlay above the active cell editor trigger.
  await activeCell.dblclick({ force: true });
};

const getGridColumnClass = (columnKey: string) =>
  `rdg-cell-${columnKey.replaceAll(/[^a-zA-Z0-9-_]/g, '')}`;

const scrollGridHorizontally = async (page: Page, scrollLeft: number) => {
  const grid = page.locator('.om-rdg .rdg').first();

  if (!(await waitForVisibleLocator(grid, EDITOR_OPEN_TIMEOUT))) {
    return false;
  }

  await grid.evaluate((element, left) => {
    element.scrollLeft = left;
  }, scrollLeft);

  await waitForAllLoadersToDisappear(page);

  return true;
};

const getGridHorizontalScrollPositions = async (page: Page) => {
  const grid = page.locator('.om-rdg .rdg').first();

  if (!(await waitForVisibleLocator(grid, EDITOR_OPEN_TIMEOUT))) {
    return [];
  }

  const { clientWidth, scrollLeft, scrollWidth } = await grid.evaluate(
    (element) => ({
      clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    })
  );
  const maxScrollLeft = Math.max(scrollWidth - clientWidth, 0);
  const step = Math.max(Math.floor(clientWidth / 2), 240);
  const positions = new Set([scrollLeft, 0, maxScrollLeft]);

  for (let left = step; left < maxScrollLeft; left += step) {
    positions.add(left);
  }

  return [...positions];
};

const getActiveGridRow = async (page: Page) => {
  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR).first();

  if (await waitForVisibleLocator(activeCell, EDITOR_OPEN_TIMEOUT)) {
    const row = activeCell
      .locator(
        'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " rdg-row ")]'
      )
      .first();

    if ((await row.count()) > 0) {
      return row;
    }
  }

  return page.locator('.rdg-row').last();
};

const trySelectRenderedActiveRowCellByColumn = async (
  page: Page,
  columnClass: string,
  timeout = EDITOR_OPEN_TIMEOUT
) => {
  const row = await getActiveGridRow(page);
  const cellByClass = row.locator(`.${columnClass}`).first();

  if (await waitForVisibleLocator(cellByClass, timeout)) {
    await scrollIntoViewCenter(cellByClass);
    // eslint-disable-next-line playwright/no-force-option -- fixed grid columns and overlays can intercept active-cell clicks.
    await cellByClass.click({ force: true });

    return true;
  }

  const headerCell = page.locator(`.rdg-header-row .${columnClass}`).first();
  const columnIndex = (await waitForVisibleLocator(headerCell, timeout))
    ? await headerCell.getAttribute('aria-colindex')
    : undefined;

  if (columnIndex) {
    const cellByIndex = row
      .locator(`.rdg-cell[aria-colindex="${columnIndex}"]`)
      .first();

    if (await waitForVisibleLocator(cellByIndex, timeout)) {
      await scrollIntoViewCenter(cellByIndex);
      // eslint-disable-next-line playwright/no-force-option -- fixed grid columns and overlays can intercept active-cell clicks.
      await cellByIndex.click({ force: true });

      return true;
    }
  }

  return false;
};

const selectActiveRowCellByColumn = async (page: Page, columnKey: string) => {
  const columnClass = getGridColumnClass(columnKey);

  if (await trySelectRenderedActiveRowCellByColumn(page, columnClass)) {
    return;
  }

  for (const scrollLeft of await getGridHorizontalScrollPositions(page)) {
    if (!(await scrollGridHorizontally(page, scrollLeft))) {
      break;
    }

    if (await trySelectRenderedActiveRowCellByColumn(page, columnClass, 300)) {
      return;
    }
  }

  throw new Error(`Unable to select grid column "${columnKey}"`);
};

const getTextEditorOpenActions = (page: Page) => {
  return [
    async () => undefined,
    async () => page.keyboard.press('Enter', { delay: 100 }),
    async () => {
      await clickActiveGridCell(page);
      await page.keyboard.press('Enter', { delay: 100 });
    },
    async () => page.keyboard.press('F2'),
    async () => doubleClickActiveGridCell(page),
  ];
};

const fillAndCommitTextEditor = async (
  page: Page,
  text: string,
  maxAttempts = 2
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const openTextEditor of getTextEditorOpenActions(page)) {
      try {
        await openTextEditor();

        if (await fillVisibleTextEditor(page, text)) {
          return;
        }
      } catch (error) {
        lastError = error;
        await page.keyboard.press('Escape').catch(() => undefined);
      }
    }

    await page.keyboard.press('Escape').catch(() => undefined);
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Unable to fill the active grid text editor');
};

const getDescriptionEditorCandidates = (page: Page) => {
  return [
    page.getByTestId('markdown-editor').locator(descriptionBox).first(),
    page.locator(descriptionBox).first(),
    page.locator('textarea.bulk-edit-description-editor-textarea').first(),
  ];
};

const findVisibleDescriptionEditor = async (page: Page) => {
  for (const editor of getDescriptionEditorCandidates(page)) {
    if (await waitForVisibleLocator(editor, EDITOR_OPEN_TIMEOUT)) {
      return editor;
    }
  }

  return undefined;
};

const clickMarkdownEditorSave = async (page: Page) => {
  const markdownSaveButton = page
    .getByTestId('markdown-editor')
    .getByTestId('save');

  if (await waitForVisibleLocator(markdownSaveButton, EDITOR_OPEN_TIMEOUT)) {
    await markdownSaveButton.click();
  } else {
    await page.getByTestId('save').click();
  }

  await page.getByTestId('markdown-editor').waitFor({ state: 'detached' });
};

const fillVisibleDescriptionEditor = async (
  page: Page,
  description: string
) => {
  const editor = await findVisibleDescriptionEditor(page);

  if (!editor) {
    return false;
  }

  try {
    await editor.evaluate((element) =>
      element.scrollIntoView({ block: 'center', inline: 'nearest' })
    );
    await editor.fill(description, { timeout: 10000 });

    const tagName = await editor.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'textarea') {
      await editor.press('Control+Enter');
      await editor.waitFor({ state: 'detached' });
    } else {
      await clickMarkdownEditorSave(page);
    }

    return true;
  } catch {
    await page.keyboard.press('Escape').catch(() => undefined);

    return false;
  }
};

const getDescriptionEditorOpenActions = (page: Page) => {
  return [
    async () => undefined,
    async () => page.keyboard.press('Enter', { delay: 100 }),
    async () => {
      await clickActiveGridCell(page);
      await page.keyboard.press('Enter', { delay: 100 });
    },
    async () => page.keyboard.press('F2'),
    async () => doubleClickActiveGridCell(page),
  ];
};

export const waitForImportGridLoadMaskToDisappear = async (
  page: Page,
  timeout = 30000
) => {
  await expect(page.locator(IMPORT_GRID_LOAD_MASK_SELECTOR)).toHaveCount(0, {
    timeout,
  });
};

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
  await fillAndCommitTextEditor(page, text);
};

export const fillDescriptionDetails = async (
  page: Page,
  description: string,
  maxAttempts = 2
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const openDescriptionEditor of getDescriptionEditorOpenActions(page)) {
      try {
        await openDescriptionEditor();

        if (await fillVisibleDescriptionEditor(page, description)) {
          return;
        }
      } catch (error) {
        lastError = error;
        await page.keyboard.press('Escape').catch(() => undefined);
      }
    }

    await page.keyboard.press('Escape').catch(() => undefined);
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Unable to fill the active grid description editor');
};

const clickInlineSave = async (page: Page) => {
  const saveButton = page.getByTestId('inline-save-btn');

  // eslint-disable-next-line playwright/no-force-option -- grid cells and the fixed import footer can overlap inline editors.
  await saveButton.click({ force: true });
  await saveButton.waitFor({ state: 'detached' });
};

const clickAssociatedTagSave = async (page: Page) => {
  const saveButton = page.getByTestId('saveAssociatedTag');

  // eslint-disable-next-line playwright/no-force-option -- grid cells and the fixed import footer can overlap inline editors.
  await saveButton.click({ force: true });
  await saveButton.waitFor({ state: 'detached' });
};

export const fillOwnerDetails = async (page: Page, owners: string[]) => {
  await page.keyboard.press('Enter', { delay: 100 });

  await expect(page.getByTestId('select-owner-tabs')).toBeVisible();

  await expect(
    page.locator('.ant-tabs-tab-active').getByText('Teams')
  ).toBeVisible();

  await waitForAllLoadersToDisappear(page);

  const userListResponse = page.waitForResponse(
    '/api/v1/search/query?q=&index=user&*'
  );
  await page.getByRole('tab', { name: 'Users' }).click();
  await userListResponse;

  await waitForAllLoadersToDisappear(page);

  await page
    .getByTestId('owner-select-users-search-bar')
    .waitFor({ state: 'visible' });

  await page.click('[data-testid="owner-select-users-search-bar"]');

  for (const owner of owners) {
    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=user*'
    );
    await page.locator('[data-testid="owner-select-users-search-bar"]').clear();
    await page.fill('[data-testid="owner-select-users-search-bar"]', owner);
    await searchOwner;
    await expect(
      page.locator('[data-testid="select-owner-tabs"] [data-testid="loader"]')
    ).toHaveCount(0);

    await page.getByRole('listitem', { name: owner }).click();
  }

  await page
    .locator('[id^="rc-tabs-"][id$="-panel-users"]')
    .getByTestId('selectable-list-update-btn')
    .click();

  await page
    .getByTestId('selectable-list-update-btn')
    .waitFor({ state: 'detached' });
};

export const fillTeamOwnerDetails = async (page: Page, owners: string[]) => {
  await page.keyboard.press('Enter', { delay: 100 });

  await expect(page.getByTestId('select-owner-tabs')).toBeVisible();

  await expect(
    page.locator('.ant-tabs-tab-active').getByText('Users')
  ).toBeVisible();

  await waitForAllLoadersToDisappear(page);

  await page
    .locator("[data-testid='select-owner-tabs']")
    .getByRole('tab', { name: 'Teams' })
    .click();

  await waitForAllLoadersToDisappear(page);

  await page
    .getByTestId('owner-select-teams-search-bar')
    .waitFor({ state: 'visible' });

  await page.click('[data-testid="owner-select-teams-search-bar"]');

  for (const owner of owners) {
    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=team*'
    );
    await page.locator('[data-testid="owner-select-teams-search-bar"]').clear();
    await page.fill('[data-testid="owner-select-teams-search-bar"]', owner);
    await searchOwner;
    await expect(
      page.locator('[data-testid="select-owner-tabs"] [data-testid="loader"]')
    ).toHaveCount(0);
    await page.getByRole('listitem', { name: owner }).click();
  }

  await page
    .locator('[id^="rc-tabs-"][id$="-panel-teams"]')
    .getByTestId('selectable-list-update-btn')
    .click();

  await page
    .getByTestId('selectable-list-update-btn')
    .waitFor({ state: 'detached' });
};

export const fillEntityTypeDetails = async (page: Page, entityType: string) => {
  await page.keyboard.press('Enter', { delay: 100 });

  await page.getByTestId('entity-type-select').click();
  await page.getByTitle(entityType, { exact: true }).nth(0).click();
  await clickInlineSave(page);
};

export const fillTagDetails = async (page: Page, tag: string) => {
  await page.keyboard.press('Enter', { delay: 100 });

  const tagSelectorInput = page
    .locator('[data-testid="tag-selector"] input')
    .first();
  await tagSelectorInput.waitFor({ state: 'visible' });

  const waitForQueryResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );
  await page.keyboard.type(tag);
  await waitForQueryResponse;

  await page.click(`[data-testid="tag-${tag}"]`);
  await clickInlineSave(page);
};

export const fillGlossaryTermDetails = async (
  page: Page,
  glossary: { parent: string; name: string }
) => {
  await page.keyboard.press('Enter', { delay: 100 });

  await waitForAllLoadersToDisappear(page);

  await page
    .locator('.async-tree-select-list-dropdown')
    .waitFor({ state: 'visible' });

  const tagSelectorInput = page
    .locator('[data-testid="tag-selector"] input')
    .first();
  await tagSelectorInput.waitFor({ state: 'visible' });

  const searchResponse = page.waitForResponse(
    `/api/v1/search/query?q=**&index=glossaryTerm&**`
  );
  await page.keyboard.type(glossary.name);
  await searchResponse;

  await waitForAllLoadersToDisappear(page);
  await page.getByTestId(`tag-"${glossary.parent}"."${glossary.name}"`).click();
  await clickAssociatedTagSave(page);
};

export const fillDomainDetails = async (
  page: Page,
  domains: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.keyboard.press('Enter');

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
  await clickAssociatedTagSave(page);
};

const getActiveCellPopoverOpenActions = (page: Page) => {
  return [
    async () => page.keyboard.press('Enter', { delay: 100 }),
    async () => {
      await clickActiveGridCell(page);
      await page.keyboard.press('Enter', { delay: 100 });
    },
    async () => page.keyboard.press('F2'),
    async () => doubleClickActiveGridCell(page),
  ];
};

const openActiveCellPopover = async (
  page: Page,
  targetLocator: Locator,
  responseUrlPattern: string | undefined,
  maxAttempts = 2
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const openEditor of getActiveCellPopoverOpenActions(page)) {
      try {
        const response = responseUrlPattern
          ? page
              .waitForResponse(responseUrlPattern, {
                timeout: EDITOR_OPEN_TIMEOUT,
              })
              .catch(() => undefined)
          : undefined;
        await openEditor();
        await response;

        if (await waitForVisibleLocator(targetLocator, EDITOR_OPEN_TIMEOUT)) {
          return;
        }
      } catch (error) {
        lastError = error;
      }
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Unable to open the active cell popover editor');
};

const openRadioCardEditor = async (
  page: Page,
  radioTestId: string,
  responseUrlPattern: string,
  maxAttempts = 2
) => {
  await openActiveCellPopover(
    page,
    page.getByTestId(radioTestId),
    responseUrlPattern,
    maxAttempts
  );
};

const clickRadioCardUpdate = async (page: Page, updateButtonTestId: string) => {
  const updateButton = page.getByTestId(updateButtonTestId);

  await updateButton.click();
  await updateButton.waitFor({ state: 'detached' });
};

export const fillTierDetails = async (
  page: Page,
  tier: string,
  _isBulkEdit?: boolean
) => {
  const radioTestId = `radio-btn-${tier}`;
  await openRadioCardEditor(page, radioTestId, '/api/v1/tags?parent=Tier*');

  await page.getByTestId(radioTestId).click();
  await clickRadioCardUpdate(page, 'update-tier-card');
};

export const fillCertificationDetails = async (
  page: Page,
  certification: string,
  _isBulkEdit?: boolean
) => {
  const radioTestId = `radio-btn-${certification}`;
  await openRadioCardEditor(
    page,
    radioTestId,
    '/api/v1/tags?parent=Certification*'
  );

  await page.getByTestId(radioTestId).click();
  await clickRadioCardUpdate(page, 'update-certification');
};

export const fillStoredProcedureCode = async (page: Page) => {
  await page.keyboard.press('Enter', { delay: 100 });

  // Wait for the loader to disappear
  await expect(page.locator('.ant-skeleton-content')).toHaveCount(0);

  await page
    .getByTestId('code-mirror-container')
    .getByRole('textbox')
    .fill(BULK_IMPORT_EXPORT_SQL_QUERY);

  await page.getByTestId('save').click();

  await page.getByTestId('schema-modal').waitFor({ state: 'detached' });
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
    await page.locator(descriptionBox).waitFor({ state: 'visible' });

    await page
      .locator(descriptionBox)
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.MARKDOWN);

    await clickOutside(page);

    await page.getByTestId('markdown-editor').getByTestId('save').click();

    await page.locator(descriptionBox).waitFor({ state: 'detached' });

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
      page
        .getByTestId(propertyName)
        .getByRole('columnheader', { name: columns[0] })
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
  await doubleClickActiveGridCell(page);

  await page
    .getByTestId('custom-property-editor')
    .waitFor({ state: 'attached', timeout: IMPORT_STATUS_TIMEOUT });

  await waitForAllLoadersToDisappear(page);

  // Wait for skeleton loaders to disappear
  await expect(page.locator('.ant-skeleton')).toHaveCount(0);

  for (const propertyName of Object.values(CUSTOM_PROPERTIES_TYPES)) {
    await editGlossaryCustomProperty(
      page,
      propertyListName[propertyName],
      propertyName
    );
  }

  await page.getByTestId('save').click();

  await page
    .getByTestId('custom-property-editor')
    .waitFor({ state: 'detached' });
};

export const fillExtensionDetails = async (
  page: Page,
  propertyListName: Record<string, string>
) => {
  // Pressing Enter to open this editor can race the previous cell's commit
  // and revert earlier edits in the row, so open it via double-click instead.
  await doubleClickActiveGridCell(page);

  const customPropertyEditor = page.getByTestId('custom-property-editor');

  await customPropertyEditor.waitFor({
    state: 'attached',
    timeout: IMPORT_STATUS_TIMEOUT,
  });

  // Verify header text
  await expect(customPropertyEditor.getByTestId('header')).toContainText(
    'Edit CustomProperty'
  );

  // Verify save and cancel buttons are visible
  await expect(page.getByTestId('save')).toBeVisible();
  await expect(page.getByTestId('cancel')).toBeVisible();

  await waitForAllLoadersToDisappear(page);

  // Wait for skeleton loader to disappear
  await expect(page.locator('.ant-skeleton')).toHaveCount(0);

  for (const propertyName of Object.values(CUSTOM_PROPERTIES_TYPES)) {
    await editEntityCustomProperty(
      page,
      propertyListName[propertyName],
      propertyName
    );
  }

  await page.getByTestId('save').click();

  await page
    .getByTestId('custom-property-editor')
    .waitFor({ state: 'detached' });
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
  propertyListName?: Record<string, string>,
  isBulkEdit?: boolean
) => {
  await selectActiveRowCellByColumn(page, 'name');
  if (isBulkEdit) {
    await expect(
      page.locator('.rdg-cell[aria-selected="true"][aria-readonly="true"]')
    ).toContainText(row.name);
  } else {
    await fillTextInputDetails(page, row.name);
  }

  await selectActiveRowCellByColumn(page, 'displayName');
  await fillTextInputDetails(page, row.displayName);

  await selectActiveRowCellByColumn(page, 'description');
  await fillDescriptionDetails(page, row.description);

  await selectActiveRowCellByColumn(page, 'synonyms');
  await fillTextInputDetails(page, row.synonyms);

  await selectActiveRowCellByColumn(page, 'relatedTerms');
  await fillGlossaryTermDetails(page, row.relatedTerm);

  await selectActiveRowCellByColumn(page, 'references');
  await fillTextInputDetails(page, row.references);

  await selectActiveRowCellByColumn(page, 'tags');
  await fillTagDetails(page, row.tag);

  await selectActiveRowCellByColumn(page, 'reviewers');
  await fillOwnerDetails(page, row.reviewers);

  await selectActiveRowCellByColumn(page, 'owner');
  await fillOwnerDetails(page, row.owners);

  await selectActiveRowCellByColumn(page, 'color');
  await fillTextInputDetails(page, '#ccc');

  const base64Src =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  await selectActiveRowCellByColumn(page, 'iconURL');
  await fillTextInputDetails(page, base64Src);

  if (propertyListName && Object.keys(propertyListName).length > 0) {
    await selectActiveRowCellByColumn(page, 'extension');
    await fillExtensionDetails(page, propertyListName);
  }
};

export const validateImportStatus = async (
  page: Page,
  status: { passed: string; failed: string; processed: string }
) => {
  await page
    .getByTestId('processed-row')
    .waitFor({ timeout: IMPORT_STATUS_TIMEOUT });
  await expect(page.getByTestId('processed-row')).toHaveText(status.processed, {
    timeout: IMPORT_STATUS_TIMEOUT,
  });
  await expect(page.getByTestId('passed-row')).toHaveText(status.passed, {
    timeout: IMPORT_STATUS_TIMEOUT,
  });
  await expect(page.getByTestId('failed-row')).toHaveText(status.failed, {
    timeout: IMPORT_STATUS_TIMEOUT,
  });

  await waitForVisibleLocator(page.locator('.rdg-header-row').first(), 5000);
};

export const startCsvPreview = async (page: Page, timeout = 90000) => {
  const nextPreviewButton = page.getByRole('button', {
    name: /Next:\s*Preview/i,
  });
  const nextButton = (await waitForVisibleLocator(nextPreviewButton, 1000))
    ? nextPreviewButton
    : page.getByRole('button', { name: /^Next$/i });

  await expect(nextButton).toBeEnabled({ timeout });
  await nextButton.click();
};

export const startCsvPreviewAndWaitForGrid = async (
  page: Page,
  options?: {
    csvImportCompletedPromise?: Promise<void>;
    timeout?: number;
  }
) => {
  const timeout = options?.timeout ?? 90000;

  if (
    !(await waitForVisibleLocator(
      page.locator('.rdg-header-row').first(),
      1000
    ))
  ) {
    await startCsvPreview(page, timeout);
  }

  if (options?.csvImportCompletedPromise) {
    await options.csvImportCompletedPromise;
  }

  await page
    .getByText('Import is in progress.')
    .waitFor({ state: 'detached', timeout });
  await page
    .locator('.rdg-header-row')
    .first()
    .waitFor({ state: 'visible', timeout });
};

export const uploadCSVAndWaitForGrid = async (
  page: Page,
  filePath: string,
  options?: {
    isContentString?: boolean;
    tempFileName?: string;
    csvImportCompletedPromise?: Promise<void>;
  }
): Promise<{ rowCount: number; tempFilePath?: string }> => {
  await waitForAllLoadersToDisappear(page);
  if (
    !(await waitForVisibleLocator(page.getByTestId('stepper-container'), 1000))
  ) {
    await page
      .getByTestId('csv-workflow-stepper')
      .waitFor({ state: 'visible' });
  }
  await expect(
    page.getByText('Drag & Drop or Browse CSV file here')
  ).toBeVisible();

  const uploadWidget = page.getByTestId('upload-file-widget');
  await uploadWidget.waitFor({ state: 'attached' });
  let actualFilePath = filePath;
  let tempFilePath: string | undefined;

  if (options?.isContentString) {
    const tempDir = os.tmpdir();
    const tempFileName = options?.tempFileName || `temp-${Date.now()}.csv`;
    tempFilePath = path.join(tempDir, tempFileName);
    fs.writeFileSync(tempFilePath, filePath);
    actualFilePath = tempFilePath;
  }

  await uploadWidget.setInputFiles([actualFilePath]);

  await startCsvPreviewAndWaitForGrid(page, {
    csvImportCompletedPromise: options?.csvImportCompletedPromise,
  });
  const rowCount = await page.locator('.rdg-row').count();
  return { rowCount, tempFilePath };
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

export const createColumnRowDetailsWithEncloseDot = () => {
  return {
    ...createColumnRowDetails(),
    name: 'playwright.column ${uuid()',
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
    await page.locator(descriptionBox).waitFor({ state: 'visible' });

    await page
      .locator(descriptionBox)
      .fill(FIELD_VALUES_CUSTOM_PROPERTIES.MARKDOWN);

    await page.getByTestId('markdown-editor').getByTestId('save').click();

    await page.locator(descriptionBox).waitFor({ state: 'detached' });
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
    teamOwners?: string[];
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
  customPropertyRecord?: Record<string, string>,
  isFirstCellClick?: boolean,
  isBulkEdit?: boolean
) => {
  if (!isFirstCellClick) {
    await page.locator('.rdg-cell-name').last().click();
  }

  await selectActiveRowCellByColumn(page, 'name');

  if (isBulkEdit) {
    await expect(
      page.locator('.rdg-cell[aria-selected="true"][aria-readonly="true"]')
    ).toContainText(row.name);
  } else {
    await fillTextInputDetails(page, row.name);
  }

  await selectActiveRowCellByColumn(page, 'displayName');
  await fillTextInputDetails(page, row.displayName);

  await selectActiveRowCellByColumn(page, 'description');
  await fillDescriptionDetails(page, row.description);

  await selectActiveRowCellByColumn(page, 'owner');
  await fillOwnerDetails(page, row.owners);

  if (row.teamOwners && row.teamOwners.length > 0) {
    await fillTeamOwnerDetails(page, row.teamOwners);
  }

  await selectActiveRowCellByColumn(page, 'tags');
  await fillTagDetails(page, row.tag);

  await selectActiveRowCellByColumn(page, 'glossaryTerms');
  await fillGlossaryTermDetails(page, row.glossary);

  await selectActiveRowCellByColumn(page, 'tiers');
  await fillTierDetails(page, row.tier, isBulkEdit);

  await selectActiveRowCellByColumn(page, 'certification');
  await fillCertificationDetails(page, row.certification, isBulkEdit);

  if (row.retentionPeriod) {
    await selectActiveRowCellByColumn(page, 'retentionPeriod');
    await fillTextInputDetails(page, row.retentionPeriod);
  }

  if (row.sourceUrl) {
    await selectActiveRowCellByColumn(page, 'sourceUrl');
    await fillTextInputDetails(page, row.sourceUrl);
  }

  await selectActiveRowCellByColumn(page, 'domains');
  await fillDomainDetails(page, row.domains);

  if (customPropertyRecord && Object.keys(customPropertyRecord).length > 0) {
    await selectActiveRowCellByColumn(page, 'extension');
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

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillTextInputDetails(page, row.displayName);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillDescriptionDetails(page, row.description);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillTextInputDetails(page, row.dataTypeDisplay);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillTextInputDetails(page, row.dataType);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillTextInputDetails(page, row.arrayDataType);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillTextInputDetails(page, row.dataLength);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillTagDetails(page, row.tag);

  await moveToNextColumnWithVerification(page);
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  await fillGlossaryTermDetails(page, row.glossary);
};

export const pressKeyXTimes = async (
  page: Page,
  length: number,
  key: string
) => {
  for (let i = 0; i < length; i++) {
    if (key === 'ArrowLeft') {
      await moveToPrevColumnWithVerification(page);
    } else if (key === 'ArrowRight') {
      await moveToNextColumnWithVerification(page);
    } else {
      // Fallback for non-arrow keys (e.g. Backspace, Enter) — no column-change verification needed.
      await page.locator(RDG_ACTIVE_CELL_SELECTOR).press(key, { delay: 200 });
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
    case GlobalSettingOptions.GLOSSARY_TERM:
      entity = CUSTOM_PROPERTIES_ENTITIES.entity_glossaryTerm;

      break;
    default:
      break;
  }

  if (!entity) {
    return propertyListName;
  }

  const propertiesList = Object.values(CUSTOM_PROPERTIES_TYPES);

  for (const property of propertiesList) {
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
  await selectActiveRowCellByColumn(page, 'entityType');
  await fillEntityTypeDetails(page, entityType);

  await selectActiveRowCellByColumn(page, 'fullyQualifiedName');
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
  await selectActiveRowCellByColumn(page, 'name');

  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR);
  const isActive = await activeCell.isVisible();

  if (isActive) {
    await fillTextInputDetails(page, row.name);
  } else {
    await selectActiveRowCellByColumn(page, 'name');
    await fillTextInputDetails(page, row.name);
  }

  await selectActiveRowCellByColumn(page, 'displayName');
  await fillTextInputDetails(page, row.displayName);

  await selectActiveRowCellByColumn(page, 'description');
  await fillDescriptionDetails(page, row.description);

  await selectActiveRowCellByColumn(page, 'tags');
  await fillTagDetails(page, row.tag);

  await selectActiveRowCellByColumn(page, 'glossaryTerms');
  await fillGlossaryTermDetails(page, row.glossary);

  await selectActiveRowCellByColumn(page, 'entityType');
  await fillEntityTypeDetails(page, row.entityType);

  await selectActiveRowCellByColumn(page, 'fullyQualifiedName');
  await fillTextInputDetails(page, row.fullyQualifiedName);

  await selectActiveRowCellByColumn(page, 'column.dataTypeDisplay');
  await fillTextInputDetails(page, row.dataTypeDisplay);

  await selectActiveRowCellByColumn(page, 'column.dataType');
  await fillTextInputDetails(page, row.dataType);

  await selectActiveRowCellByColumn(page, 'column.arrayDataType');
  await fillTextInputDetails(page, row.arrayDataType);

  await selectActiveRowCellByColumn(page, 'column.dataLength');
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

/**
 * Moves to the next column with verification to prevent flakiness.
 * Verifies that the column index actually changes after ArrowRight.
 * If the column index doesn't change, keeps retrying ArrowRight until it changes.
 */
const moveToNextColumnWithVerification = async (page: Page): Promise<void> => {
  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR);

  const currentColIndex = await activeCell.getAttribute('aria-colindex');

  await page.keyboard.press('ArrowRight', { delay: 100 });

  let newColIndex = await activeCell.getAttribute('aria-colindex');
  let retries = 0;

  while (
    currentColIndex === newColIndex &&
    retries < MAX_COLUMN_NAVIGATION_RETRIES
  ) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
    newColIndex = await activeCell.getAttribute('aria-colindex');
    retries++;
  }

  await expect(
    activeCell,
    `ArrowRight did not advance column after ${MAX_COLUMN_NAVIGATION_RETRIES} retries (stuck at aria-colindex=${currentColIndex})`
  ).not.toHaveAttribute('aria-colindex', currentColIndex ?? '');
};

const moveToPrevColumnWithVerification = async (page: Page): Promise<void> => {
  const activeCell = page.locator(RDG_ACTIVE_CELL_SELECTOR);

  const currentColIndex = await activeCell.getAttribute('aria-colindex');

  await page.keyboard.press('ArrowLeft', { delay: 100 });

  let newColIndex = await activeCell.getAttribute('aria-colindex');
  let retries = 0;

  while (
    currentColIndex === newColIndex &&
    retries < MAX_COLUMN_NAVIGATION_RETRIES
  ) {
    await page.keyboard.press('ArrowLeft', { delay: 100 });
    newColIndex = await activeCell.getAttribute('aria-colindex');
    retries++;
  }

  await expect(
    activeCell,
    `ArrowLeft did not advance column after ${MAX_COLUMN_NAVIGATION_RETRIES} retries (stuck at aria-colindex=${currentColIndex})`
  ).not.toHaveAttribute('aria-colindex', currentColIndex ?? '');
};

export const performDeleteOperationOnEntity = async (page: Page) => {
  // Display Name Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Backspace');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Description Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Backspace');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Owners Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Backspace');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Tag Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Backspace');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Glossary Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Delete');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Tier Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Delete');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Certification Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Delete');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Retention Period Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Delete');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Source URL Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Delete');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();

  // Domains Remove
  await moveToNextColumnWithVerification(page);
  await page.keyboard.press('Delete');
  await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();
};

export const performColumnSelectAndDeleteOperation = async (page: Page) => {
  const displayNameHeader = page.getByRole('columnheader', {
    name: 'Display Name',
  });

  const firstRow = page.locator('.rdg-row').first();
  const firstCell = firstRow.locator('.rdg-cell').nth(1);

  await displayNameHeader.click();

  await expect(firstCell).not.toBeFocused();

  await expect(displayNameHeader).toBeFocused();

  await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(9);

  await page.keyboard.press('Delete');

  await expect(
    page.getByRole('gridcell', { name: 'Playwright,Database', exact: true })
  ).not.toBeVisible(); // Display Name cell should be deleted
};

export const performBulkDownload = async (page: Page, fileName: string) => {
  const downloadPromise = page.waitForEvent('download');

  await page.click('[data-testid="manage-button"]');
  await page
    .getByTestId('manage-dropdown-list-container')
    .waitFor({ state: 'visible' });
  await page.click('[data-testid="export-button-title"]');

  await expect(page.locator('.ant-modal-wrap')).toBeVisible();

  await page.fill('#fileName', fileName);
  await page.click('#submit-button');

  await page.locator('.message-banner-wrapper').waitFor({ state: 'detached' });
  const download = await downloadPromise;

  // Wait for the download process to complete and save the downloaded file somewhere.
  await download.saveAs('downloads/' + download.suggestedFilename());
};

/**
 * Fill test case details in the grid
 * All fields are optional to allow testing of required field validations
 * Supports all test case CSV columns
 * @param row - Test case row details
 * @param page - Playwright page object
 */
export const fillTestCaseDetails = async (
  row: {
    name?: string;
    displayName?: string;
    description?: string;
    testDefinition?: string;
    entityFQN?: string;
    testSuite?: string;
    parameterValues?: string;
    computePassedFailedRowCount?: string;
    useDynamicAssertion?: string;
    inspectionQuery?: string;
    tags?: string;
    glossary?: {
      name: string;
      parent: string;
    };
  },
  page: Page
) => {
  // Fill name if provided
  if (row.name) {
    await fillTextInputDetails(page, row.name);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill displayName if provided
  if (row.displayName) {
    await fillTextInputDetails(page, row.displayName);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill description if provided
  if (row.description) {
    await fillDescriptionDetails(page, row.description);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill testDefinition if provided
  if (row.testDefinition) {
    await fillTextInputDetails(page, row.testDefinition);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill entityFQN if provided
  if (row.entityFQN) {
    await fillTextInputDetails(page, row.entityFQN);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill testSuite if provided
  if (row.testSuite) {
    await fillTextInputDetails(page, row.testSuite);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill parameterValues if provided
  if (row.parameterValues) {
    await fillTextInputDetails(page, row.parameterValues);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill computePassedFailedRowCount if provided
  if (row.computePassedFailedRowCount) {
    await fillTextInputDetails(page, row.computePassedFailedRowCount);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill useDynamicAssertion if provided
  if (row.useDynamicAssertion) {
    await fillTextInputDetails(page, row.useDynamicAssertion);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill inspectionQuery if provided
  if (row.inspectionQuery) {
    await fillTextInputDetails(page, row.inspectionQuery);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill tags if provided
  if (row.tags) {
    await fillTagDetails(page, row.tags);
  }
  await page.keyboard.press('ArrowRight', { delay: 100 });

  // Fill glossaryTerms if provided
  if (row.glossary) {
    await fillGlossaryTermDetails(page, row.glossary);
  }
};
