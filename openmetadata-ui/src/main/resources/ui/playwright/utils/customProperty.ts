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
  ENTITY_PATH,
  EntityTypeEndpoint,
} from '../support/entity/Entity.interface';
import { UserClass } from '../support/user/UserClass';
import { selectOption, showAdvancedSearchDialog } from './advancedSearch';
import {
  clickOutside,
  descriptionBox,
  descriptionBoxReadOnly,
  uuid,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';
import {
  navigateToEntityPanelTab,
  navigateToExploreAndSelectTable,
} from './entityPanel';
import { sidebarClick } from './sidebar';

export enum CustomPropertyType {
  STRING = 'String',
  INTEGER = 'Integer',
  MARKDOWN = 'Markdown',
}
export enum CustomPropertyTypeByName {
  TABLE_CP = 'table-cp',
  HYPERLINK_CP = 'hyperlink-cp',
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

  const isInputVisible = await page
    .locator(`div.rdg-editor-container.rdg-cell-${columnName}`)
    .isVisible();

  if (!isInputVisible) {
    await page.locator(`div.rdg-cell-${columnName}`).last().dblclick();
  }
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

  const patchRequestPromise = page.waitForResponse(`/api/v1/${endpoint}/*`);
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

    case 'hyperlink-cp': {
      // Value format: "url,displayText" or just "url"
      const [url, displayText] = value.split(',');
      await page.locator('[data-testid="hyperlink-url-input"]').isVisible();
      await page.locator('[data-testid="hyperlink-url-input"]').fill(url);
      if (displayText) {
        await page
          .locator('[data-testid="hyperlink-display-text-input"]')
          .fill(displayText);
      }
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }
  }
  const patchRequest = await patchRequestPromise;

  expect(patchRequest.status()).toBe(200);
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
      page.getByRole('row', { name: `${values[0]} ${values[1]}` }).first()
    ).toBeVisible();
  } else if (propertyType === 'hyperlink-cp') {
    // Value format: "url,displayText" or just "url"
    const [url, displayText] = value.split(',');
    const hyperlinkElement = container.getByTestId('hyperlink-value');

    await expect(hyperlinkElement).toBeVisible();
    await expect(hyperlinkElement).toHaveAttribute('href', url);
    // Check display text if provided, otherwise check URL is displayed
    if (displayText) {
      await expect(hyperlinkElement).toContainText(displayText);
    } else {
      await expect(hyperlinkElement).toContainText(url);
    }
  } else if (propertyType === 'markdown') {
    // For markdown, remove * and _ as they are formatting characters
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
    // For other types (string, integer, number, duration), match exact value without transformation
    await expect(container.getByTestId('property-value')).toContainText(value);
  } else if ('entityReferenceList' === propertyType) {
    const refValues = value.split(',');

    for (const val of refValues) {
      await expect(container.getByTestId(val)).toBeVisible();
      await expect(container.getByTestId('no-data')).not.toBeVisible();
    }
  } else if ('entityReference' === propertyType) {
    await expect(container.getByTestId('entityReference-value')).toContainText(
      value
    );
    await expect(container.getByTestId('no-data')).not.toBeVisible();
  } else {
    await expect(container.getByTestId('property-value')).toBeVisible();
    await expect(container.getByTestId('no-data')).not.toBeVisible();
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

    case 'hyperlink-cp':
      return {
        value: 'https://example.com,Example Link',
        newValue: 'https://openmetadata.io,OpenMetadata',
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
    acc[`user${index + 1}`] = user.getUserDisplayName();

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
  customPropertyData: { description: string; entityApiType?: string };
  customType: string;
  enumConfig?: { values: string[]; multiSelect: boolean };
  formatConfig?: string;
  entityReferenceConfig?: string[];
  tableConfig?: { columns: string[] };
}) => {
  // Add Custom property for selected entity
  await page.click('[data-testid="add-field-button"]');

  // Check if Create button is initially disabled
  await expect(page.locator('[data-testid="create-button"]')).toBeDisabled();

  // Click the switch to show service doc panel
  await page.locator('[data-testid="show-side-panel-switch"]').click();

  // Validation checks
  await page.fill(
    '[data-testid="name"] input',
    CUSTOM_PROPERTY_INVALID_NAMES.CAPITAL_CASE
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  await page.fill(
    '[data-testid="name"] input',
    CUSTOM_PROPERTY_INVALID_NAMES.WITH_UNDERSCORE
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  await page.fill(
    '[data-testid="name"] input',
    CUSTOM_PROPERTY_INVALID_NAMES.WITH_SPACE
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  await page.fill(
    '[data-testid="name"] input',
    CUSTOM_PROPERTY_INVALID_NAMES.WITH_DOTS
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // Name in another language
  await page.fill('[data-testid="name"] input', '汝らヴェディア');

  await expect(page.locator('#name_help')).not.toBeVisible();

  // Correct name
  await page.fill('[data-testid="name"] input', propertyName);

  // displayName
  await page.fill('[data-testid="display-name"] input', propertyName);

  // Select custom type
  await page.locator('[data-testid="propertyType"]').click();
  await page.getByTitle(`${customType}`, { exact: true }).click();

  // Enum configuration
  if (customType === 'Enum' && enumConfig) {
    for (const val of enumConfig.values) {
      const enumInput = page.locator(String.raw`#root\/enumConfig`);
      await enumInput.clear();
      await enumInput.type(val, { delay: 50 });
      await enumInput.press('Enter');
      await expect(enumInput).toHaveValue('');
    }

    if (enumConfig.multiSelect) {
      await page.getByTestId('multiSelect').click();
    }
  }
  // Table configuration
  if (customType === 'Table' && tableConfig) {
    for (const val of tableConfig.columns) {
      const columnInput = page.locator(String.raw`#root\/columns`);
      await expect(columnInput).toBeVisible();
      await columnInput.click();
      await columnInput.clear();
      await columnInput.type(val, { delay: 100 }); // Slow typing to prevent merge
      await columnInput.press('Enter');
      await expect(columnInput).toHaveValue(''); // Verify input is consumed
    }
  }

  // Entity reference configuration
  if (
    ENTITY_REFERENCE_PROPERTIES.includes(customType) &&
    entityReferenceConfig
  ) {
    for (const val of entityReferenceConfig) {
      await page.click(String.raw`#root\/entityReferenceConfig`);
      await page.keyboard.type(val);

      // CRITICAL: Use :visible selector chain pattern (Rule 4 from deflake guide)
      const option = page
        .locator('.ant-select-dropdown:visible')
        .locator(`[title="${val}"]`);
      await expect(option).toBeVisible();
      await option.click();

      // Close the dropdown by pressing Escape
      await page.keyboard.press('Escape');

      // Wait for dropdown to close
      await expect(page.locator('.ant-select-dropdown')).toBeHidden();

      // Verify the selection was applied
      await expect(
        page.locator(String.raw`#root\/entityReferenceConfig_list`)
      ).not.toBeVisible();
    }
  }

  // Format configuration
  if (['Date', 'Date Time', 'Time'].includes(customType) && formatConfig) {
    await page.getByTestId('formatConfig').click();
    await page.getByRole('option', { name: formatConfig, exact: true }).click();
  }

  // Description
  await expect(
    page.locator(String.raw`#root\/entityReferenceConfig_list`)
  ).not.toBeVisible();

  await page.waitForSelector(descriptionBox, { state: 'visible' });
  await page.locator(descriptionBox).click();
  await page.keyboard.type(customPropertyData.description, { delay: 50 });

  // Click on name field to blur description and trigger validation without closing modal
  await page.click('[data-testid="name"] input');

  await expect(page.locator('#propertyType_help')).not.toBeVisible();
  await expect(page.locator('#description_help')).not.toBeVisible();

  const createButton = page.locator('[data-testid="create-button"]');
  await expect(createButton).toBeVisible();
  const createPropertyPromise = page.waitForResponse(
    '/api/v1/metadata/types/*'
  );
  await expect(createButton).toBeEnabled();
  await createButton.click();

  const response = await createPropertyPromise;
  await page.waitForSelector('[data-testid="custom-property-form"]', {
    state: 'detached',
  });

  // CRITICAL: Wait for UI to update after API response
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

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
    const tableConfig = page.locator(
      `[data-row-key="${propertyName}"] [data-testid="table-config"]`
    );
    await expect(tableConfig).toBeVisible();
    await expect(tableConfig).toContainText('Columns:');
    await expect(
      tableConfig.locator('li', { hasText: 'pw-column1' })
    ).toBeVisible();
    await expect(
      tableConfig.locator('li', { hasText: 'pw-column2' })
    ).toBeVisible();
  }

  await editButton.click();

  // displayName
  await page.fill('[data-testid="display-name"]', '');
  await page.fill('[data-testid="display-name"]', propertyName.toUpperCase());

  await page.locator(descriptionBox).fill('');
  await page.locator(descriptionBox).fill('This is new description');

  if (type === 'Enum') {
    await page.click(String.raw`#root\/customPropertyConfig`);
    await page.fill(String.raw`#root\/customPropertyConfig`, 'updatedValue');
    await page.press(String.raw`#root\/customPropertyConfig`, 'Enter');
    await clickOutside(page);
  }

  if (ENTITY_REFERENCE_PROPERTIES.includes(type ?? '')) {
    await page.click(String.raw`#root\/customPropertyConfig`);
    await page.fill(String.raw`#root\/customPropertyConfig`, 'Table');
    await page.press(String.raw`#root\/customPropertyConfig`, 'Enter');
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
  entityType: string,
  propertyType?: string,
  propertyConfig?: string[]
) => {
  await sidebarClick(page, SidebarItem.EXPLORE);

  // Wait for loader to disappear instead of networkidle
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  // Open advanced search dialog
  await showAdvancedSearchDialog(page);

  const ruleLocator = page.locator('.rule').nth(0);

  // Select "Custom Properties" from the field dropdown
  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    'Custom Properties',
    true
  );

  if (entityType !== 'TableColumn') {
    await selectOption(
      page,
      ruleLocator.locator('.rule--field .ant-select'),
      entityType,
      true
    );

    if (propertyType === 'Time Interval') {
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        `${propertyName} (Start)`,
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        `${propertyName} (End)`,
        true
      );
    } else if (propertyType === 'Hyperlink') {
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        `${propertyName} URL`,
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        `${propertyName} Display Text`,
        true
      );
    } else if (propertyType === 'Table') {
      for (const column of propertyConfig ?? []) {
        await selectOption(
          page,
          ruleLocator.locator('.rule--field .ant-select'),
          `${propertyName} - ${column}`,
          true
        );
      }
    } else {
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        propertyName,
        true
      );
    }
  }
  await page.getByTestId('cancel-btn').click();
};

export const getTestValueForPropertyType = (propertyType: string) => {
  switch (propertyType) {
    case 'Integer':
      return '123';
    case 'String':
      return 'Test Value Persistence';
    case 'Markdown':
      return '**Markdown**';
    case 'Duration':
      return 'PT1H';
    case 'Email':
      return 'test@email.com';
    case 'Number':
      return '456';
    case 'Sql Query':
      return 'SELECT * FROM table';
    case 'Time Interval':
      return '1600000000000,1600000000001';
    case 'Timestamp':
      return '1640995200000';
    case 'Enum':
      return 'enum1';
    case 'Table':
      return 'row1col1';
    case 'Entity Reference':
    case 'Entity Reference List':
      return 'admin';
    case 'Date':
      return '2023-01-01';
    case 'Time':
      return '12:00:00';
    case 'Date Time': // Assuming customType logic
    case 'DateTime':
      return '2023-01-01 12:00:00';
    case 'Hyperlink':
      return 'https://example.com,Example';
    default:
      return 'value';
  }
};

export const editColumnCustomProperty = async (
  page: Page,
  propertyType: string,
  testValue: string
) => {
  if (propertyType === 'Markdown') {
    const editor = page.locator('.om-block-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.type(testValue);
    await editor.blur();
    await page.getByTestId('save').click();
  } else if (propertyType === 'Sql Query') {
    const codeMirror = page.locator(
      '.custom-properties-section-container .CodeMirror'
    );
    await expect(codeMirror).toBeVisible();
    await codeMirror.click();
    await page.keyboard.type(testValue);
  } else if (propertyType === 'Time Interval') {
    const [start, end] = testValue.split(',');
    await page.getByTestId('start-input').fill(start);
    await page.getByTestId('end-input').fill(end);
  } else if (propertyType === 'Timestamp') {
    await page.getByTestId('timestamp-input').fill(testValue);
  } else if (propertyType === 'Duration') {
    await page.getByTestId('duration-input').fill(testValue);
  } else if (propertyType === 'Email') {
    await page.getByTestId('email-input').fill(testValue);
  } else if (propertyType === 'Enum') {
    await page.getByTestId('enum-select').click();
    await page
      .locator('.ant-select-item-option-content')
      .getByText(testValue, { exact: true })
      .click();
  } else if (propertyType === 'Table') {
    await page.locator('[data-testid="add-new-row"]').click();
    await page.waitForSelector('.om-rdg', { state: 'visible' });

    // Fill Row
    await page.locator('div.rdg-cell-pw-column1').last().dblclick();
    await page
      .getByTestId('edit-table-type-property-modal')
      .getByRole('textbox')
      .fill(testValue);
    await page.locator('div.rdg-cell-pw-column1').last().press('Enter');

    await page.locator('div.rdg-cell-pw-column2').last().dblclick();
    await page
      .getByTestId('edit-table-type-property-modal')
      .getByRole('textbox')
      .fill('row1col2');
    await page.locator('div.rdg-cell-pw-column2').last().press('Enter');

    await page.locator('[data-testid="update-table-type-property"]').click();
  } else if (
    ['Entity Reference', 'Entity Reference List'].includes(propertyType)
  ) {
    const input = page.getByTestId('asset-select-list').getByRole('combobox');
    await input.click();
    await input.fill(testValue);
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.status() === 200
    );
    await page.getByTestId(testValue).click();

    // Verify selection is applied before saving
    // The selection usually appears as a tag or text in the container
    await expect(page.getByTestId('asset-select-list')).toContainText(
      testValue
    );
  } else if (['Date', 'Time', 'Date Time', 'DateTime'].includes(propertyType)) {
    // Ant Design Pickers
    const picker = page.getByTestId(
      propertyType === 'Time' ? 'time-picker' : 'date-time-picker'
    );
    await picker.click();
    await page.keyboard.type(testValue);
    await page.keyboard.press('Enter');
  } else if (['String', 'Integer', 'Number'].includes(propertyType)) {
    const valueInput = page.getByTestId('value-input');
    await expect(valueInput).toBeVisible();
    await valueInput.fill(testValue);
  } else if (propertyType === 'Hyperlink') {
    const urlInput = page.getByTestId('hyperlink-url-input');
    await expect(urlInput).toBeVisible();
    const [url, displayText] = testValue.split(',');
    await urlInput.fill(url);
    const displayTextInput = page.getByTestId('hyperlink-display-text-input');
    await expect(displayTextInput).toBeVisible();
    await displayTextInput.fill(displayText);
  }

  if (propertyType !== 'Table' && propertyType !== 'Markdown') {
    await page
      .locator('.custom-properties-section-container')
      .getByTestId('inline-save-btn')
      .click();
  }
};

export const validateColumnCustomProperty = async (
  page: Page,
  propertyType: string,
  testValue: string,
  propertyName: string
) => {
  const card = page.getByTestId(propertyName);

  if (propertyType === 'Markdown') {
    await expect(card.getByTestId('viewer-container')).toContainText(
      'Markdown'
    );
  } else if (propertyType === 'Sql Query') {
    await expect(card.getByTestId('property-value')).toContainText(testValue);
  } else if (propertyType === 'Time Interval') {
    const [start, end] = testValue.split(',');
    await expect(card.getByTestId('property-value')).toContainText(start);
    await expect(card.getByTestId('property-value')).toContainText(end);
  } else if (propertyType === 'Table') {
    await expect(
      page.getByRole('row', { name: `${testValue} row1col2` })
    ).toBeVisible();
  } else if (propertyType === 'Entity Reference') {
    await expect(card.getByTestId('property-value')).toContainText(testValue);
  } else if (propertyType === 'Hyperlink') {
    const [_, displayText] = testValue.split(',');
    await expect(card.getByTestId('hyperlink-value')).toContainText(
      displayText
    );
  } else {
    // Generic fallback for String, Integer, Email, Duration, Timestamp, Enum, EntityRef, Date, Time
    // Enum/Date/Time/Ref now use 'value' container with text.
    // Ref: Part 2 test uses getByText(testValue) originally, updated to getByTestId('property-value').
    await expect(card.getByTestId('property-value')).not.toHaveText('Not set');
    await expect(card.getByTestId('property-value')).toContainText(testValue);
  }
};

export const verifyTableColumnCustomPropertyPersistence = async ({
  page,
  tableName,
  tableFqn,
  propertyName,
  propertyType,
}: {
  page: Page;
  tableName: string;
  tableFqn: string;
  propertyName: string;
  propertyType: string;
}) => {
  const testValue = getTestValueForPropertyType(propertyType);

  // 1. Navigate to Table Details
  await navigateToExploreAndSelectTable(page, tableName);
  await page.getByTestId(`table-data-card_${tableFqn}`).click();

  // 2. Open Column Detail Panel
  const firstColumnLink = page.locator('[data-testid="column-name"]').first();
  await firstColumnLink.click();
  const sidePanel = page.locator('.column-detail-panel-container');
  await expect(sidePanel).toBeVisible();

  // 3. Go to Custom Properties Tab
  const customPropertiesTab = page.getByTestId('custom-properties-tab');
  await customPropertiesTab.click();

  const searchbar = page
    .locator('.custom-properties-section-container')
    .getByTestId('search-bar-container')
    .getByRole('textbox');
  await expect(searchbar).toBeVisible();
  await searchbar.fill(propertyName);

  // 4. Edit Value
  const card = page.getByTestId(propertyName);
  await card.getByTestId('edit-icon-right-panel').click();

  // Define wait for response
  const updateColumnResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/columns/name') &&
      response.request().method() === 'PUT'
  );

  // Edit logic
  await editColumnCustomProperty(page, propertyType, testValue);

  // Wait for response
  await updateColumnResponse;

  // CRITICAL: Wait for UI to update after API response
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  // Validation
  await validateColumnCustomProperty(
    page,
    propertyType,
    testValue,
    propertyName
  );

  // 5. Reload Page
  const getColumnDetails = page.waitForResponse(
    '/api/v1/tables/name/*/columns?*fields=*extension*'
  );
  const getTableColumnTypes = page.waitForResponse(
    '/api/v1/metadata/types/name/tableColumn*'
  );
  await page.reload();
  await getTableColumnTypes;
  await getColumnDetails;

  await page.waitForSelector(
    '.column-detail-panel-container [data-testid="custom-properties-tab"]',
    {
      state: 'visible',
    }
  );
  await customPropertiesTab.click();
  await expect(searchbar).toBeVisible();
  await searchbar.fill(propertyName);

  // Validation Logic After Reload
  await validateColumnCustomProperty(
    page,
    propertyType,
    testValue,
    propertyName
  );

  // Close
  await page.getByTestId('close-button').click();
  await expect(sidePanel).not.toBeVisible();
};

export const updateCustomPropertyInRightPanel = async (data: {
  page: Page;
  entityName: string;
  propertyDetails: CustomProperty;
  value: string;
  endpoint: EntityTypeEndpoint;
  skipNavigation?: boolean;
}) => {
  const { page, entityName, propertyDetails, value, endpoint, skipNavigation } =
    data;
  const propertyName = propertyDetails.name;
  const propertyType = propertyDetails.propertyType.name;

  if (!skipNavigation) {
    await navigateToExploreAndSelectTable(page, entityName, endpoint);
    await waitForAllLoadersToDisappear(page);
    await navigateToEntityPanelTab(page, 'custom property');
    await waitForAllLoadersToDisappear(page);
  }

  const searchContainer = page.getByTestId('search-bar-container');
  if (await searchContainer.isVisible()) {
    await searchContainer.getByTestId('searchbar').fill(propertyName);
  }
  await page.waitForTimeout(800);
  const container = page
    .locator('.entity-summary-panel-container')
    .getByTestId(propertyName);

  await expect(container.getByTestId('property-name')).toHaveText(propertyName);

  const editButton = container.getByTestId('edit-icon-right-panel');
  await editButton.scrollIntoViewIfNeeded();
  await editButton.click({ force: true });

  const patchRequestPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${endpoint}/`) &&
      response.request().method() === 'PATCH'
  );

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
      while (
        (await page.locator('.ant-select-selection-item-remove').count()) > 0
      ) {
        await page.locator('.ant-select-selection-item-remove').first().click();
      }
      await page.fill('#enumValues', value);
      await page.locator(`.ant-select-item-option[title="${value}"]`).click();
      await clickOutside(page);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'timestamp':
      await page.locator('[data-testid="timestamp-input"]').isVisible();
      await page.locator('[data-testid="timestamp-input"]').fill(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'time-cp': {
      await page.locator('[data-testid="time-picker"]').isVisible();
      await page.locator('[data-testid="time-picker"]').click();
      await page.locator('[data-testid="time-picker"]').fill(value);
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'timeInterval': {
      const [startValue, endValue] = value.split(',');
      await page.locator('[data-testid="start-input"]').isVisible();
      await page.locator('[data-testid="start-input"]').fill(startValue);
      await page.locator('[data-testid="end-input"]').isVisible();
      await page.locator('[data-testid="end-input"]').fill(endValue);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'date-cp':
    case 'dateTime-cp': {
      await page.locator('[data-testid="date-time-picker"]').isVisible();
      await page.locator('[data-testid="date-time-picker"]').click();
      await page.locator('[data-testid="date-time-picker"]').fill(value);
      await page.locator('[data-testid="date-time-picker"]').press('Enter');
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'string':
    case 'integer':
    case 'number':
      await page.locator('[data-testid="value-input"]').isVisible();
      await page.locator('[data-testid="value-input"]').clear();
      await page.locator('[data-testid="value-input"]').fill(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'entityReference':
    case 'entityReferenceList': {
      // Clear existing values
      while (
        (await page.locator('.ant-select-selection-item-remove').count()) > 0
      ) {
        await page.locator('.ant-select-selection-item-remove').first().click();
      }
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

      await page.locator('[data-testid="update-table-type-property"]').click({
        force: true,
      });

      break;
    }

    case 'sqlQuery':
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.type(value);
      await container.locator('[data-testid="inline-save-btn"]').click();

      break;

    case 'hyperlink-cp': {
      const values = value.split(',');
      await page.getByTestId('hyperlink-url-input').fill(values[0]);
      await page.getByTestId('hyperlink-display-text-input').fill(values[1]);

      await container.locator('[data-testid="inline-save-btn"]').click();

      break;
    }
  }

  const patchRequest = await patchRequestPromise;
  expect(patchRequest.status()).toBe(200);

  // Validate
  const toggleBtnVisibility = await container
    .locator(`[data-testid="toggle-${propertyName}"]`)
    .isVisible();

  if (toggleBtnVisibility && propertyType !== 'table-cp') {
    await container.locator(`[data-testid="toggle-${propertyName}"]`).click();
  }

  if (propertyType === 'enum') {
    await expect(container.getByTestId('property-value')).toContainText(value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');

    await expect(container.getByTestId('property-value')).toContainText(
      startValue
    );
    await expect(container.getByTestId('property-value')).toContainText(
      endValue
    );
  } else if (propertyType === 'table-cp') {
    const values = value.split(',');

    await expect(
      page.getByRole('row', { name: `${values[0]} ${values[1]}` }).first()
    ).toBeVisible();
  } else if (propertyType === 'markdown') {
    // For markdown, remove * and _ as they are formatting characters
    await expect(
      container.locator(descriptionBoxReadOnly).last()
    ).toContainText(value.replaceAll(/[*_]/gi, ''));
  } else if (propertyType === 'hyperlink-cp') {
    const displayText = value.split(',');
    await expect(page.getByTestId('hyperlink-value')).toContainText(
      displayText[1]
    );
  } else if (
    ![
      'entityReference',
      'entityReferenceList',
      'date-cp',
      'dateTime-cp',
    ].includes(propertyType)
  ) {
    // For other types (string, integer, number, duration), match exact value without transformation
    await waitForAllLoadersToDisappear(page);
    await expect(container.getByTestId('property-value')).toContainText(value);
  } else if ('entityReferenceList' === propertyType) {
    const refValues = value.split(',');

    for (const val of refValues) {
      const links = await container.locator('a').all();

      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href?.toLowerCase().includes(val.trim().toLowerCase())) {
          await expect(link).toBeVisible();
          break;
        }
      }

      await expect(container.getByTestId('no-data')).not.toBeVisible();
    }
  } else if ('entityReference' === propertyType) {
    await expect(container.getByRole('link')).toContainText(value, {
      ignoreCase: true,
    });
    await expect(container.getByTestId('no-data')).not.toBeVisible();
  } else {
    await expect(container.getByTestId('property-value')).toBeVisible();
    await expect(container.getByTestId('no-data')).not.toBeVisible();
  }
};
