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
import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  EntityTypeEndpoint,
  ENTITY_PATH,
} from '../support/entity/Entity.interface';
import { uuid } from './common';

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

  await expect(page.getByRole('cell', { name: propertyName })).toContainText(
    propertyName
  );

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
      await page.locator('#enumValues').fill(value);
      await page.locator('#enumValues').press('Enter');
      await page.mouse.click(0, 0);
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
    await expect(
      page.getByLabel('Custom Properties').getByTestId('enum-value')
    ).toContainText(value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');

    await expect(
      page.getByLabel('Custom Properties').getByTestId('time-interval-value')
    ).toContainText(startValue);
    await expect(
      page.getByLabel('Custom Properties').getByTestId('time-interval-value')
    ).toContainText(endValue);
  } else if (propertyType === 'sqlQuery') {
    await expect(
      page.getByLabel('Custom Properties').locator('.CodeMirror-scroll')
    ).toContainText(value);
  } else if (
    !['entityReference', 'entityReferenceList'].includes(propertyType)
  ) {
    await expect(page.getByRole('row', { name: propertyName })).toContainText(
      value.replace(/\*|_/gi, '')
    );
  }
};

export const validateValueForProperty = async (data: {
  page: Page;
  propertyName: string;
  value: string;
  propertyType: string;
}) => {
  const { page, propertyName, value, propertyType } = data;
  await page.click('[data-testid="custom_properties"]');

  if (propertyType === 'enum') {
    await expect(
      page.getByLabel('Custom Properties').getByTestId('enum-value')
    ).toContainText(value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');

    await expect(
      page.getByLabel('Custom Properties').getByTestId('time-interval-value')
    ).toContainText(startValue);
    await expect(
      page.getByLabel('Custom Properties').getByTestId('time-interval-value')
    ).toContainText(endValue);
  } else if (propertyType === 'sqlQuery') {
    await expect(
      page.getByLabel('Custom Properties').locator('.CodeMirror-scroll')
    ).toContainText(value);
  } else if (
    !['entityReference', 'entityReferenceList'].includes(propertyType)
  ) {
    await expect(page.getByRole('row', { name: propertyName })).toContainText(
      value.replace(/\*|_/gi, '')
    );
  }
};

export const getPropertyValues = (type: string) => {
  switch (type) {
    case 'integer':
      return {
        value: '123',
        newValue: '456',
      };
    case 'string':
      return {
        value: 'string value',
        newValue: 'new string value',
      };
    case 'markdown':
      return {
        value: '**Bold statement**',
        newValue: '__Italic statement__',
      };

    case 'number':
      return {
        value: '123',
        newValue: '456',
      };
    case 'duration':
      return {
        value: 'PT1H',
        newValue: 'PT2H',
      };
    case 'email':
      return {
        value: 'john@gamil.com',
        newValue: 'user@getcollate.io',
      };
    case 'enum':
      return {
        value: 'small',
        newValue: 'medium',
      };
    case 'sqlQuery':
      return {
        value: 'Select * from table',
        newValue: 'Select * from table where id = 1',
      };

    case 'timestamp':
      return {
        value: '1710831125922',
        newValue: '1710831125923',
      };
    case 'entityReference':
      return {
        value: 'Adam Matthews',
        newValue: 'Aaron Singh',
      };

    case 'entityReferenceList':
      return {
        value: 'Aaron Johnson,Organization',
        newValue: 'Aaron Warren',
      };

    default:
      return {
        value: '',
        newValue: '',
      };
  }
};

export const createCustomPropertyForEntity = async (
  apiContext: APIRequestContext,
  endpoint: EntityTypeEndpoint
) => {
  const propertiesResponse = await apiContext.get(
    '/api/v1/metadata/types?category=field&limit=20'
  );
  const properties = await propertiesResponse.json();
  const propertyList = properties.data.filter((item) =>
    Object.values(CustomPropertyTypeByName).includes(item.name)
  );

  const entitySchemaResponse = await apiContext.get(
    `/api/v1/metadata/types/name/${ENTITY_PATH[endpoint]}`
  );
  const entitySchema = await entitySchemaResponse.json();

  let customProperties = {} as Record<
    string,
    {
      value: string;
      newValue: string;
      property: CustomProperty;
    }
  >;

  for (const item of propertyList) {
    const customPropertyResponse = await apiContext.put(
      `/api/v1/metadata/types/${entitySchema.id}`,
      {
        data: {
          name: `cyCustomProperty${uuid()}`,
          description: `cyCustomProperty${uuid()}`,
          propertyType: {
            id: item.id ?? '',
            type: 'type',
          },
          ...(item.name === 'enum'
            ? {
                customPropertyConfig: {
                  config: {
                    multiSelect: true,
                    values: ['small', 'medium', 'large'],
                  },
                },
              }
            : {}),
          ...(['entityReference', 'entityReferenceList'].includes(item.name)
            ? {
                customPropertyConfig: {
                  config: ['user', 'team'],
                },
              }
            : {}),
        },
      }
    );

    const customProperty = await customPropertyResponse.json();

    // Process the custom properties
    customProperties = customProperty.customProperties.reduce((prev, curr) => {
      const propertyTypeName = curr.propertyType.name;

      return {
        ...prev,
        [propertyTypeName]: {
          ...getPropertyValues(propertyTypeName),
          property: curr,
        },
      };
    }, {});
  }

  return customProperties;
};
