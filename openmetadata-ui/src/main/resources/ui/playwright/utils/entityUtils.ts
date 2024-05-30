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
import { lowerCase } from 'lodash';

export const visitEntityPage = async (data: {
  page: Page;
  searchTerm: string;
  dataTestId: string;
}) => {
  const { page, searchTerm, dataTestId } = data;

  await page.getByTestId('searchBox').fill(searchTerm);
  await page.getByTestId(dataTestId).getByTestId('data-name').click();
  await page.getByTestId('searchBox').clear();
};

export const addOwner = async (
  page: Page,
  owner: string,
  type: 'Teams' | 'Users' = 'Users'
) => {
  await page.getByTestId('edit-owner').click();
  await page.getByRole('tab', { name: type }).click();

  await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .fill(owner);
  await page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(owner)}*`
  );
  await page.getByRole('listitem', { name: owner }).click();

  await expect(page.getByTestId('owner-link')).toContainText(owner);
};

export const updateOwner = async (
  page: Page,
  owner: string,
  type: 'Teams' | 'Users' = 'Users'
) => {
  await page.getByTestId('edit-owner').click();
  await page.getByRole('tab', { name: type }).click();

  await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .fill(owner);
  await page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(owner)}*`
  );
  await page.getByRole('listitem', { name: owner }).click();

  await expect(page.getByTestId('owner-link')).toContainText(owner);
};

export const removeOwner = async (page: Page) => {
  await page.getByTestId('edit-owner').click();

  await expect(page.getByTestId('remove-owner').locator('svg')).toBeVisible();

  await page.getByTestId('remove-owner').locator('svg').click();

  await expect(page.getByTestId('owner-link')).toContainText('No Owner');
};

export const assignTier = async (page: Page, tier: string) => {
  await page.getByTestId('edit-tier').click();
  await page.getByTestId(`radio-btn-${tier}`).click();
  await page.getByTestId('Tier').click();

  await expect(page.getByTestId('Tier')).toContainText(tier);
};

export const removeTier = async (page: Page) => {
  await page.getByTestId('edit-tier').click();
  await page.getByTestId('clear-tier').click();
  await page.getByTestId('Tier').click();

  await expect(page.getByTestId('Tier')).toContainText('No Tier');
};

export const updateDescription = async (page: Page, description: string) => {
  await page.getByTestId('edit-description').click();
  await page.locator('.ProseMirror').first().click();
  await page.locator('.ProseMirror').first().clear();
  await page.locator('.ProseMirror').first().fill(description);
  await page.getByTestId('save').click();

  await expect(
    page.getByTestId('asset-description-container').getByRole('paragraph')
  ).toContainText(description);
};

export const assignTag = async (
  page: Page,
  tag: string,
  action: 'Add' | 'Edit' = 'Add'
) => {
  await page
    .getByTestId('entity-right-panel')
    .getByTestId('tags-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  await page.locator('#tagsForm_tags').fill(tag);
  await page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );
  await page.getByTestId(`tag-${tag}`).click();
  await page.getByTestId('saveAssociatedTag').click();

  await expect(
    page
      .getByTestId('entity-right-panel')
      .getByTestId('tags-container')
      .getByTestId(`tag-${tag}`)
  ).toBeVisible();
};

export const removeTag = async (page: Page, tags: string[]) => {
  for (const tag of tags) {
    await page
      .getByTestId('entity-right-panel')
      .getByTestId('tags-container')
      .getByTestId('edit-button')
      .click();

    await page
      .getByTestId(`selected-tag-${tag}`)
      .getByTestId('remove-tags')
      .locator('svg')
      .click();

    await page.getByTestId('saveAssociatedTag').click();

    expect(
      page
        .getByTestId('entity-right-panel')
        .getByTestId('tags-container')
        .getByTestId(`tag-${tag}`)
    ).not.toBeVisible();
  }
};

type GlossaryTermOption = {
  displayName: string;
  name: string;
  fullyQualifiedName: string;
};

export const assignGlossaryTerm = async (
  page: Page,
  glossaryTerm: GlossaryTermOption,
  action: 'Add' | 'Edit' = 'Add'
) => {
  await page
    .getByTestId('entity-right-panel')
    .getByTestId('glossary-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  await page.locator('#tagsForm_tags').fill(glossaryTerm.displayName);
  await page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(glossaryTerm.displayName)}*`
  );
  await page.getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`).click();
  await page.getByTestId('saveAssociatedTag').click();

  await expect(
    page
      .getByTestId('entity-right-panel')
      .getByTestId('glossary-container')
      .getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`)
  ).toBeVisible();
};

export const removeGlossaryTerm = async (
  page: Page,
  glossaryTerms: GlossaryTermOption[]
) => {
  for (const tag of glossaryTerms) {
    await page
      .getByTestId('entity-right-panel')
      .getByTestId('glossary-container')
      .getByTestId('edit-button')
      .click();

    await page
      .getByTestId('glossary-container')
      .getByTestId(new RegExp(tag.name))
      .getByTestId('remove-tags')
      .locator('svg')
      .click();

    await page.getByTestId('saveAssociatedTag').click();

    expect(
      page
        .getByTestId('entity-right-panel')
        .getByTestId('glossary-container')
        .getByTestId(`tag-${tag.fullyQualifiedName}`)
    ).not.toBeVisible();
  }
};
