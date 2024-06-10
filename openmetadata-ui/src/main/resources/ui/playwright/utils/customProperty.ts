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

export enum CustomPropertyType {
  STRING = 'String',
  INTEGER = 'Integer',
  MARKDOWN = 'Markdown',
}
export enum CustomPropertyTypeByName {
  STRING = 'string',
  INTEGER = 'integer',
  MARKDOWN = 'markdown',
  NUMBER = 'number',
  DURATION = 'duration',
  EMAIL = 'email',
  ENUM = 'enum',
  SQL_QUERY = 'sqlQuery',
  TIMESTAMP = 'timestamp',
  ENTITY_REFERENCE = 'entityReference',
  ENTITY_REFERENCE_LIST = 'entityReferenceList',
}

export interface CustomProperty {
  name: string;
  type: CustomPropertyType;
  description: string;
  propertyType: {
    name: string;
    type: string;
  };
}

export const setValueForProperty = async (data: {
  page: Page;
  propertyName: string;
  value: string;
  propertyType: string;
}) => {
  const { page, propertyName, value, propertyType } = data;
  await page.click('[data-testid="custom_properties"]');

  await expect(page.locator('tbody')).toContainText(propertyName);

  const editButton = page.locator(
    `[data-row-key="${propertyName}"] [data-testid="edit-icon"]`
  );
  await editButton.scrollIntoViewIfNeeded();
  await editButton.click({ force: true });

  switch (propertyType) {
    case 'markdown':
      await page
        .locator(
          '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
        )
        .isVisible();
      await page
        .locator(
          '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
        )
        .fill(value);
      await page.locator('[data-testid="save"]').click();

      break;

    case 'email':
      await page.locator('[data-testid="email-input"]').isVisible();
      await page.locator('[data-testid="email-input"]').fill(value);
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'duration':
      await page.locator('[data-testid="duration-input"]').isVisible();
      await page.locator('[data-testid="duration-input"]').fill(value);
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'enum':
      await page.locator('#enumValues').click();
      await page.locator('#enumValues').type(`${value}{Enter}`);
      await page.click('body'); // Assuming clickOutside is clicking on the body to blur
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'sqlQuery':
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.type(value);
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'timestamp':
      await page.locator('[data-testid="timestamp-input"]').isVisible();
      await page.locator('[data-testid="timestamp-input"]').fill(value);
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'timeInterval': {
      const [startValue, endValue] = value.split(',');
      await page.locator('[data-testid="start-input"]').isVisible();
      await page.locator('[data-testid="start-input"]').fill(startValue);
      await page.locator('[data-testid="end-input"]').isVisible();
      await page.locator('[data-testid="end-input"]').fill(endValue);
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'string':
    case 'integer':
    case 'number':
      await page.locator('[data-testid="value-input"]').isVisible();
      await page.locator('[data-testid="value-input"]').fill(value);
      await page.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'entityReference':
    case 'entityReferenceList': {
      const refValues = value.split(',');

      for (const val of refValues) {
        const searchApi = `**/api/v1/search/query?q=*${encodeURIComponent(
          val
        )}*`;
        await page.route(searchApi, (route) => route.continue());
        await page.locator('#entityReference').clear();
        await page.locator('#entityReference').fill(val);
        await page.waitForResponse(searchApi);
        await page.locator(`[data-testid="${val}"]`).click();
      }

      await page.locator('[data-testid="inline-save-btn"]').click();

      break;
    }
  }

  await page.waitForResponse('/api/v1/*/*');
  if (propertyType === 'enum') {
    await expect(page.locator('[data-testid="enum-value"]')).toContainText(
      value
    );
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');

    await expect(
      page.locator('[data-testid="time-interval-value"]')
    ).toContainText(startValue);
    await expect(
      page.locator('[data-testid="time-interval-value"]')
    ).toContainText(endValue);
  } else if (propertyType === 'sqlQuery') {
    await expect(page.locator('.CodeMirror-scroll')).toContainText(value);
  } else if (
    !['entityReference', 'entityReferenceList'].includes(propertyType)
  ) {
    await expect(
      page.locator(`[data-row-key="${propertyName}"]`)
    ).toContainText(value.replace(/\*|_/gi, ''));
  }
};

export const validateValueForProperty = async (data: {
  page: Page;
  propertyName: string;
  value: string;
  propertyType: string;
}) => {
  const { page, propertyName, value, propertyType } = data;
  await page.locator('.ant-tabs-tab').first().click();
  await page
    .locator(
      '[data-testid="entity-right-panel"] [data-testid="custom-properties-table"]'
    )
    .scrollIntoViewIfNeeded();

  if (propertyType === 'enum') {
    await expect(page.locator('[data-testid="enum-value"]')).toContainText(
      value
    );
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');

    await expect(
      page.locator('[data-testid="time-interval-value"]')
    ).toContainText(startValue);
    await expect(
      page.locator('[data-testid="time-interval-value"]')
    ).toContainText(endValue);
  } else if (propertyType === 'sqlQuery') {
    await expect(page.locator('.CodeMirror-scroll')).toContainText(value);
  } else if (
    !['entityReference', 'entityReferenceList'].includes(propertyType)
  ) {
    await expect(
      page.locator(`[data-row-key="${propertyName}"]`)
    ).toContainText(value.replace(/\*|_/gi, ''));
  }
};
