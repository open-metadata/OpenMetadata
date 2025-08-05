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
  CUSTOM_PROPERTY_INVALID_NAMES,
  CUSTOM_PROPERTY_NAME_VALIDATION_ERROR,
  ENTITY_REFERENCE_PROPERTIES,
} from '../constant/customProperty';
import { SidebarItem } from '../constant/sidebar';
import {
  EntityTypeEndpoint,
  ENTITY_PATH,
} from '../support/entity/Entity.interface';
import { UserClass } from '../support/user/UserClass';
import { selectOption, showAdvancedSearchDialog } from './advancedSearch';
import {
  clickOutside,
  descriptionBox,
  descriptionBoxReadOnly,
  uuid,
} from './common';
import { sidebarClick } from './sidebar';

export enum CustomPropertyType {
  STRING = 'String',
  INTEGER = 'Integer',
  MARKDOWN = 'Markdown',
}
export enum CustomPropertyTypeByName {
  TABLE_CP = 'table-cp',
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
  TIME_INTERVAL = 'timeInterval',
  TIME_CP = 'time-cp',
  DATE_CP = 'date-cp',
  DATE_TIME_CP = 'dateTime-cp',
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

export const fillTableColumnInputDetails = async (
  page: Page,
  text: string,
  columnName: string
) => {
  await page.locator(`div.rdg-cell-${columnName}`).last().dblclick();

  await page
    .getByTestId('edit-table-type-property-modal')
    .getByRole('textbox')
    .fill(text);

  await page
    .locator(`div.rdg-cell-${columnName}`)
    .last()
    .press('Enter', { delay: 100 });
};

export const setValueForProperty = async (data: {
  page: Page;
  propertyName: string;
  value: string;
  propertyType: string;
  endpoint: EntityTypeEndpoint;
}) => {
  const { page, propertyName, value, propertyType, endpoint } = data;
  await page.click('[data-testid="custom_properties"]');

  const container = page.locator(
    `[data-testid="custom-property-${propertyName}-card"]`
  );

  await expect(
    page.locator(
      `[data-testid="custom-property-${propertyName}-card"] [data-testid="property-name"]`
    )
  ).toHaveText(propertyName);

  const editButton = page.locator(
    `[data-testid="custom-property-${propertyName}-card"] [data-testid="edit-icon"]`
  );
  await editButton.scrollIntoViewIfNeeded();
  await editButton.click({ force: true });

  const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
  switch (propertyType) {
    case 'markdown':
      await page.locator(descriptionBox).isVisible();
      await page.click(descriptionBox);
      await page.keyboard.type(value);
      await page.locator('[data-testid="save"]').click();

      break;

    case 'email':
      await page.locator('[data-testid="email-input"]').isVisible();
      await page.locator('[data-testid="email-input"]').fill(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'duration':
      await page.locator('[data-testid="duration-input"]').isVisible();
      await page.locator('[data-testid="duration-input"]').fill(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'enum':
      await page.click('#enumValues');
      await page.fill('#enumValues', value, { force: true });
      await page.press('#enumValues', 'Enter');
      await clickOutside(page);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'sqlQuery':
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.type(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'timestamp':
      await page.locator('[data-testid="timestamp-input"]').isVisible();
      await page.locator('[data-testid="timestamp-input"]').fill(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'timeInterval': {
      const [startValue, endValue] = value.split(',');
      await page.locator('[data-testid="start-input"]').isVisible();
      await page.locator('[data-testid="start-input"]').fill(startValue);
      await page.locator('[data-testid="end-input"]').isVisible();
      await page.locator('[data-testid="end-input"]').fill(endValue);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'time-cp': {
      await page.locator('[data-testid="time-picker"]').isVisible();
      await page.locator('[data-testid="time-picker"]').click();
      await page.locator('[data-testid="time-picker"]').fill(value);
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'date-cp':
    case 'dateTime-cp': {
      await page.locator('[data-testid="date-time-picker"]').isVisible();
      await page.locator('[data-testid="date-time-picker"]').click();
      await page.locator('[data-testid="date-time-picker"]').fill(value);
      if (propertyType === 'dateTime-cp') {
        await page.getByText('Now', { exact: true }).click();
      } else {
        await page.getByText('Today', { exact: true }).click();
      }
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'string':
    case 'integer':
    case 'number':
      await page.locator('[data-testid="value-input"]').isVisible();
      await page.locator('[data-testid="value-input"]').fill(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

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
        const searchEntity = page.waitForResponse(searchApi);
        await page.locator('#entityReference').fill(val);
        await searchEntity;
        await page.locator(`[data-testid="${val}"]`).click();
      }

      await clickOutside(page);

      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'table-cp': {
      const values = value.split(',');
      await page.locator('[data-testid="add-new-row"]').click();

      // Editor grid to be visible
      await page.waitForSelector('.om-rdg', { state: 'visible' });

      await fillTableColumnInputDetails(page, values[0], 'pw-column1');

      await fillTableColumnInputDetails(page, values[1], 'pw-column2');

      await page.locator('[data-testid="update-table-type-property"]').click();

      break;
    }
  }
  await patchRequest;
};

export const validateValueForProperty = async (data: {
  page: Page;
  propertyName: string;
  value: string;
  propertyType: string;
}) => {
  const { page, propertyName, value, propertyType } = data;
  await page.click('[data-testid="custom_properties"]');

  const container = page.locator(
    `[data-testid="custom-property-${propertyName}-card"]`
  );

  const toggleBtnVisibility = await container
    .locator(`[data-testid="toggle-${propertyName}"]`)
    .isVisible();

  if (toggleBtnVisibility && propertyType !== 'table-cp') {
    await container.locator(`[data-testid="toggle-${propertyName}"]`).click();
  }

  if (propertyType === 'enum') {
    await expect(container.getByTestId('enum-value')).toContainText(value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');

    await expect(container.getByTestId('time-interval-value')).toContainText(
      startValue
    );
    await expect(container.getByTestId('time-interval-value')).toContainText(
      endValue
    );
  } else if (propertyType === 'sqlQuery') {
    await expect(container.locator('.CodeMirror-scroll')).toContainText(value);
  } else if (propertyType === 'table-cp') {
    const values = value.split(',');

    await expect(
      page.getByRole('row', { name: `${values[0]} ${values[1]}` })
    ).toBeVisible();
  } else if (propertyType === 'markdown') {
    await expect(
      container.locator(descriptionBoxReadOnly).last()
    ).toContainText(value.replace(/\*|_/gi, ''));
  } else if (
    ![
      'entityReference',
      'entityReferenceList',
      'date-cp',
      'dateTime-cp',
    ].includes(propertyType)
  ) {
    await expect(container).toContainText(value.replace(/\*|_/gi, ''));
  }
};

export const getPropertyValues = (
  type: string,
  users: Record<string, string>
) => {
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
        value: '1234',
        newValue: '4567',
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
        value: users.user1,
        newValue: users.user2,
      };

    case 'entityReferenceList':
      return {
        value: `${users.user3},Organization`,
        newValue: users.user4,
      };

    case 'timeInterval':
      return {
        value: '1710831125922,1710831125924',
        newValue: '1710831125924,1710831125922',
      };

    case 'time-cp':
      return {
        value: '15:35:59',
        newValue: '17:35:59',
      };

    case 'date-cp':
      return {
        value: '2024-07-09',
        newValue: '2025-07-09',
      };

    case 'dateTime-cp':
      return {
        value: '2024-07-09 15:07:59',
        newValue: '2025-07-09 15:07:59',
      };

    case 'table-cp':
      return {
        value: 'column1,column2',
        newValue: 'column3,column4',
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
  const propertyList = properties.data.filter(
    (item: { name: CustomPropertyTypeByName }) =>
      Object.values(CustomPropertyTypeByName).includes(item.name)
  );

  const entitySchemaResponse = await apiContext.get(
    `/api/v1/metadata/types/name/${
      ENTITY_PATH[endpoint as keyof typeof ENTITY_PATH]
    }`
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
  const users: UserClass[] = [];
  // Loop to create and add 4 new users to the users array
  for (let i = 0; i < 4; i++) {
    const user = new UserClass();
    await user.create(apiContext);
    users.push(user);
  }

  // Reduce the users array to a userNames object with keys as user1, user2, etc., and values as the user's names
  const userNames = users.reduce((acc, user, index) => {
    acc[`user${index + 1}`] = user.getUserName();

    return acc;
  }, {} as Record<string, string>);

  // Define an asynchronous function to clean up (delete) all users in the users array
  const cleanupUser = async (apiContext: APIRequestContext) => {
    for (const user of users) {
      await user.delete(apiContext);
    }
  };

  for (const item of propertyList) {
    const customPropertyName = `pwCustomProperty${uuid()}`;
    const payload = {
      name: customPropertyName,
      description: customPropertyName,
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

      ...(item.name === 'time-cp'
        ? {
            customPropertyConfig: {
              config: 'HH:mm:ss',
            },
          }
        : {}),

      ...(item.name === 'date-cp'
        ? {
            customPropertyConfig: {
              config: 'yyyy-MM-dd',
            },
          }
        : {}),

      ...(item.name === 'dateTime-cp'
        ? {
            customPropertyConfig: {
              config: 'yyyy-MM-dd HH:mm:ss',
            },
          }
        : {}),
      ...(item.name === 'table-cp'
        ? {
            customPropertyConfig: {
              config: {
                columns: ['pw-column1', 'pw-column2'],
              },
            },
          }
        : {}),
    };
    const customPropertyResponse = await apiContext.put(
      `/api/v1/metadata/types/${entitySchema.id}`,
      {
        data: payload,
      }
    );

    const customProperty = await customPropertyResponse.json();

    // Process the custom properties
    const newProperties = customProperty.customProperties.reduce(
      (
        prev: Record<string, string>,
        curr: Record<string, Record<string, string> | string>
      ) => {
        // only process the custom properties which are created via payload
        if (curr.name !== customPropertyName) {
          return prev;
        }

        const propertyTypeName = (curr.propertyType as Record<string, string>)
          .name;

        return {
          ...prev,
          [propertyTypeName]: {
            ...getPropertyValues(propertyTypeName, userNames),
            property: curr,
          },
        };
      },
      {}
    );

    customProperties = { ...customProperties, ...newProperties };
  }

  return { customProperties, cleanupUser };
};

export const addCustomPropertiesForEntity = async ({
  page,
  propertyName,
  customPropertyData,
  customType,
  enumConfig,
  formatConfig,
  entityReferenceConfig,
  tableConfig,
}: {
  page: Page;
  propertyName: string;
  customPropertyData: { description: string };
  customType: string;
  enumConfig?: { values: string[]; multiSelect: boolean };
  formatConfig?: string;
  entityReferenceConfig?: string[];
  tableConfig?: { columns: string[] };
}) => {
  // Add Custom property for selected entity
  await page.click('[data-testid="add-field-button"]');

  // Trigger validation
  await page.click('[data-testid="create-button"]');

  await expect(page.locator('#name_help')).toContainText('Name is required');
  await expect(page.locator('#propertyType_help')).toContainText(
    'Property Type is required'
  );
  await expect(page.locator('#description_help')).toContainText(
    'Description is required'
  );

  // Validation checks
  await page.fill(
    '[data-testid="name"]',
    CUSTOM_PROPERTY_INVALID_NAMES.CAPITAL_CASE
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  await page.fill(
    '[data-testid="name"]',
    CUSTOM_PROPERTY_INVALID_NAMES.WITH_UNDERSCORE
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  await page.fill(
    '[data-testid="name"]',
    CUSTOM_PROPERTY_INVALID_NAMES.WITH_SPACE
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  await page.fill(
    '[data-testid="name"]',
    CUSTOM_PROPERTY_INVALID_NAMES.WITH_DOTS
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // Name in another language
  await page.fill('[data-testid="name"]', '汝らヴェディア');

  await expect(page.locator('#name_help')).not.toBeVisible();

  // Correct name
  await page.fill('[data-testid="name"]', propertyName);

  // displayName
  await page.fill('[data-testid="display-name"]', propertyName);

  // Select custom type
  await page.locator('[id="root\\/propertyType"]').fill(customType);
  await page.getByTitle(`${customType}`, { exact: true }).click();

  // Enum configuration
  if (customType === 'Enum' && enumConfig) {
    for (const val of enumConfig.values) {
      await page.click('#root\\/enumConfig');
      await page.fill('#root\\/enumConfig', val);
      await page.press('#root\\/enumConfig', 'Enter');
    }
    await clickOutside(page);

    if (enumConfig.multiSelect) {
      await page.click('#root\\/multiSelect');
    }
  }
  // Table configuration
  if (customType === 'Table' && tableConfig) {
    for (const val of tableConfig.columns) {
      await page.click('#root\\/columns');
      await page.fill('#root\\/columns', val);
      await page.press('#root\\/columns', 'Enter');
    }
    await clickOutside(page);
  }

  // Entity reference configuration
  if (
    ENTITY_REFERENCE_PROPERTIES.includes(customType) &&
    entityReferenceConfig
  ) {
    for (const val of entityReferenceConfig) {
      await page.click('#root\\/entityReferenceConfig');
      await page.fill('#root\\/entityReferenceConfig', val);
      await page.click(`[title="${val}"]`);
    }
  }

  // Format configuration
  if (['Date', 'Date Time', 'Time'].includes(customType)) {
    await page.fill('#root\\/formatConfig', 'invalid-format');

    await expect(page.locator('#formatConfig_help')).toContainText(
      'Format is invalid'
    );

    if (formatConfig) {
      await page.fill('#root\\/formatConfig', formatConfig);
    }
  }

  // Description

  await page.locator(descriptionBox).fill(customPropertyData.description);

  const createPropertyPromise = page.waitForResponse(
    '/api/v1/metadata/types/name/*?fields=customProperties'
  );

  await page.click('[data-testid="create-button"]');
  await page.waitForSelector('[data-testid="custom-property-form"]', {
    state: 'detached',
  });
  await page.waitForLoadState('networkidle');
  const response = await createPropertyPromise;

  expect(response.status()).toBe(200);
  await expect(
    page.getByRole('row', { name: new RegExp(propertyName, 'i') })
  ).toBeVisible();
};

export const editCreatedProperty = async (
  page: Page,
  propertyName: string,
  type?: string
) => {
  // Fetching for edit button
  const editButton = page.locator(
    `[data-row-key="${propertyName}"] [data-testid="edit-button"]`
  );

  if (type === 'Enum') {
    await expect(
      page.locator(
        `[data-row-key="${propertyName}"] [data-testid="enum-config"]`
      )
    ).toContainText('["enum1","enum2","enum3"]');
  }

  if (type === 'Table') {
    await expect(
      page
        .locator(`[data-row-key="${propertyName}"]`)
        .getByText('Columns:pw-column1pw-column2')
    ).toBeVisible();
  }

  await editButton.click();

  // displayName
  await page.fill('[data-testid="display-name"]', '');
  await page.fill('[data-testid="display-name"]', propertyName.toUpperCase());

  await page.locator(descriptionBox).fill('');
  await page.locator(descriptionBox).fill('This is new description');

  if (type === 'Enum') {
    await page.click('#root\\/customPropertyConfig');
    await page.fill('#root\\/customPropertyConfig', 'updatedValue');
    await page.press('#root\\/customPropertyConfig', 'Enter');
    await clickOutside(page);
  }

  if (ENTITY_REFERENCE_PROPERTIES.includes(type ?? '')) {
    await page.click('#root\\/customPropertyConfig');
    await page.fill('#root\\/customPropertyConfig', 'Table');
    await page.press('#root\\/customPropertyConfig', 'Enter');
    await clickOutside(page);
  }

  const patchRequest = page.waitForResponse('/api/v1/metadata/types/*');

  await page.locator('button[type="submit"]').click();

  const response = await patchRequest;

  expect(response.status()).toBe(200);

  await expect(page.locator('.ant-modal-wrap')).not.toBeVisible();

  // Fetching for updated descriptions for the created custom property
  await expect(
    page.locator(
      `[data-row-key="${propertyName}"] [data-testid="viewer-container"]`
    )
  ).toContainText('This is new description');

  if (type === 'Enum') {
    await expect(
      page.locator(
        `[data-row-key="${propertyName}"] [data-testid="enum-config"]`
      )
    ).toContainText('["enum1","enum2","enum3","updatedValue"]');
  }

  if (ENTITY_REFERENCE_PROPERTIES.includes(type ?? '')) {
    await expect(
      page.locator(
        `[data-row-key="${propertyName}"] [data-testid="${propertyName}-config"]`
      )
    ).toContainText('["user","team","metric","table"]');
  }
};

export const deleteCreatedProperty = async (
  page: Page,
  propertyName: string
) => {
  // Fetching for delete button
  await page
    .locator(`[data-row-key="${propertyName}"]`)
    .scrollIntoViewIfNeeded();
  await page
    .locator(`[data-row-key="${propertyName}"] [data-testid="delete-button"]`)
    .click();

  // Checking property name is present on the delete pop-up
  await expect(page.locator('[data-testid="body-text"]')).toContainText(
    propertyName
  );

  // Ensure the save button is visible before clicking
  await expect(page.locator('[data-testid="save-button"]')).toBeVisible();

  await page.locator('[data-testid="save-button"]').click();
};

export const verifyCustomPropertyInAdvancedSearch = async (
  page: Page,
  propertyName: string,
  entityType: string
) => {
  await sidebarClick(page, SidebarItem.EXPLORE);
  await page.waitForLoadState('networkidle');

  // Open advanced search dialog
  await showAdvancedSearchDialog(page);

  const ruleLocator = page.locator('.rule').nth(0);

  // Select "Custom Properties" from the field dropdown
  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    'Custom Properties'
  );

  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    entityType
  );

  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    propertyName
  );

  await page.getByTestId('cancel-btn').click();
};
