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
import {
  APIRequestContext,
  expect,
  Locator,
  Page,
  Response,
} from '@playwright/test';
import {
  CUSTOM_PROPERTY_INVALID_NAMES,
  CUSTOM_PROPERTY_NAME_VALIDATION_ERROR,
  ENTITY_REFERENCE_PROPERTIES,
  NAME_SUFFIX,
} from '../constant/customProperty';
import { SidebarItem } from '../constant/sidebar';
import {
  EntityTypeEndpoint,
  ENTITY_PATH,
} from '../support/entity/Entity.interface';
import { UserClass } from '../support/user/UserClass';
import { selectOption, showAdvancedSearchDialog } from './advancedSearch';
import { CODE_EDITOR_CONTENT, typeInCodeEditor } from './codeEditor';
import {
  clickIgnoringToasts,
  descriptionBoxReadOnly,
  fillDescriptionBox,
  getDescriptionBox,
  selectOptionWithRetry,
  uuid,
} from './common';
import { pickDateInCorePicker } from './dateTime';
import { waitForAllLoadersToDisappear } from './entity';
import {
  navigateToEntityPanelTab,
  navigateToExploreAndSelectTable,
} from './entityPanel';
import { sidebarClick } from './sidebar';
import { waitForAntOverlayToOpen } from './waitHelpers';

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

/** Types `HH:mm:ss` into the core TimePicker's segments inside `scope`. */
const typeTimeInCorePicker = async (scope: Locator, time: string) => {
  const hourSegment = scope
    .getByTestId('time-picker')
    .getByRole('spinbutton', { name: /hour/i });
  await hourSegment.click();
  // Segments auto-advance after two digits.
  await hourSegment.page().keyboard.type(time.replace(/:/g, ''));
};

/**
 * Edit action of a tab card or widget row: the pencil when the property has a
 * value, or the large card's "No value yet" button (e.g. "Set duration").
 */
export const getCustomPropertyEditButton = (container: Locator) =>
  container
    .getByTestId('edit-icon')
    .or(container.getByTestId('add-value-button'));

/**
 * Opens the custom property edit modal from a tab card or a widget row and
 * returns the modal, which portals to document.body outside the container.
 */
export const openCustomPropertyEditModal = async (
  page: Page,
  container: Locator
) => {
  const editButton = getCustomPropertyEditButton(container);
  await editButton.scrollIntoViewIfNeeded();
  await clickIgnoringToasts(editButton);

  const editModal = page.getByTestId('custom-property-edit-modal');
  await expect(editModal).toBeVisible();

  return editModal;
};

/**
 * Closes a select/combobox listbox left open in the edit modal, which would
 * otherwise cover the footer. The open combobox aria-hides the rest of the
 * modal, hence includeHidden.
 */
export const closeEditModalListbox = (editModal: Locator) =>
  editModal.getByRole('heading', { includeHidden: true }).click();

const clearAssetSelection = async (scope: Page | Locator) => {
  const chips = scope
    .getByTestId('asset-select-list')
    .getByTestId('autocomplete-selected-item');

  for (const label of await chips.allInnerTexts()) {
    const escaped = label.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    await chips
      .filter({ hasText: new RegExp(`^${escaped}$`) })
      .getByRole('button')
      .click();
  }

  await expect(chips).toHaveCount(0);
};

/**
 * Enters `value` in the edit modal's editor for `propertyType` and saves.
 * Shared by every surface that edits through the modal: the Custom
 * Properties tab, the side widget and the bulk-edit extension editor.
 */
export const fillCustomPropertyEditModal = async (data: {
  page: Page;
  editModal: Locator;
  propertyType: string;
  value: string;
  /** Column names of a table-cp property, in value order. */
  tableColumns?: string[];
}) => {
  const {
    page,
    editModal,
    propertyType,
    value,
    tableColumns = ['pw-column1', 'pw-column2'],
  } = data;

  switch (propertyType) {
    case 'markdown':
      // Typed, not filled: the block editor only reports keyboard input.
      await expect(getDescriptionBox(editModal)).toBeVisible();
      await getDescriptionBox(editModal).click();
      await page.keyboard.type(value);

      break;

    case 'email':
      await expect(editModal.getByTestId('email-input')).toBeVisible();
      await editModal.getByTestId('email-input').fill(value);

      break;

    case 'duration':
      await expect(editModal.getByTestId('duration-input')).toBeVisible();
      await editModal.getByTestId('duration-input').fill(value);

      break;

    case 'enum': {
      const enumInput = editModal
        .getByTestId('enum-select')
        .getByRole('combobox');
      await enumInput.fill(value);
      await page.getByRole('option', { name: value, exact: true }).click();
      // Multi-select keeps the listbox open over the footer.
      await closeEditModalListbox(editModal);

      break;
    }

    case 'sqlQuery':
      await typeInCodeEditor(page, editModal, value);

      break;

    case 'timestamp':
      await expect(editModal.getByTestId('timestamp-input')).toBeVisible();
      await editModal.getByTestId('timestamp-input').fill(value);

      break;

    case 'timeInterval': {
      const [startValue, endValue] = value.split(',');
      // Epoch inputs sit behind the editor's "Enter manually" switch. Click
      // its label: react-aria's visually hidden input overlaps the footer.
      await editModal.getByTestId('time-interval-manual-toggle').click();
      await expect(editModal.getByTestId('start-input')).toBeVisible();
      await editModal.getByTestId('start-input').fill(startValue);
      await expect(editModal.getByTestId('end-input')).toBeVisible();
      await editModal.getByTestId('end-input').fill(endValue);

      break;
    }

    case 'time-cp': {
      await typeTimeInCorePicker(editModal, value);

      break;
    }

    case 'date-cp':
    case 'dateTime-cp': {
      const [datePart, timePart] = value.split(' ');
      await pickDateInCorePicker(
        page,
        editModal.getByTestId('date-time-picker').getByRole('button'),
        datePart
      );
      if (timePart) {
        await typeTimeInCorePicker(editModal, timePart);
      }

      break;
    }

    case 'string':
    case 'integer':
    case 'number':
      await expect(editModal.getByTestId('value-input')).toBeVisible();
      await editModal.getByTestId('value-input').fill(value);

      break;

    case 'entityReference':
    case 'entityReferenceList': {
      // Single-select hides its input while a value is picked.
      await clearAssetSelection(editModal);
      const refValues = value.split(',');

      for (const val of refValues) {
        const searchApi = `**/api/v1/search/query?q=*${encodeURIComponent(
          val
        )}*`;
        const referenceInput = editModal
          .getByTestId('asset-select-list')
          .getByRole('combobox');
        await page.route(searchApi, (route) => route.continue());
        await referenceInput.clear();
        const searchEntity = page.waitForResponse(searchApi);
        await referenceInput.fill(val);
        await searchEntity;
        await page.getByRole('option').getByTestId(val).click();
      }
      // The results listbox stays open over the footer.
      await closeEditModalListbox(editModal);

      break;
    }

    case 'table-cp': {
      const values = value.split(',');
      // The inline table editor opens with one empty row.
      for (const [index, column] of tableColumns.entries()) {
        await editModal.getByTestId(`${column}-0`).fill(values[index]);
      }

      break;
    }

    case 'hyperlink-cp': {
      // Value format: "url,displayText" or just "url"
      const [url, displayText] = value.split(',');
      await expect(editModal.getByTestId('hyperlink-url-input')).toBeVisible();
      await editModal.getByTestId('hyperlink-url-input').fill(url);
      if (displayText) {
        await editModal
          .getByTestId('hyperlink-display-text-input')
          .fill(displayText);
      }

      break;
    }
  }

  await editModal.getByTestId('inline-save-btn').click();
  await expect(editModal).toBeHidden();
};

/**
 * Opens an entity's Custom Properties tab. The page's widgets share one cached
 * type definition, so the tab may not refetch it: wait for the cards instead
 * of the types request.
 */
export const openCustomPropertiesTab = async (page: Page) => {
  await page.getByTestId('custom_properties').click();
  await expect(page.getByTestId('custom-properties-card')).toBeVisible();
};

/** Card of `propertyName` on the Custom Properties tab. */
export const getCustomPropertyCard = (
  scope: Page | Locator,
  propertyName: string
) => scope.getByTestId(`custom-property-${propertyName}-card`);

/** Row of the Custom Properties side widget for `propertyName`. */
export const getCustomPropertyWidgetRow = (
  scope: Page | Locator,
  propertyName: string
) =>
  scope
    .getByTestId('custom-properties-widget')
    .getByTestId(`custom-property-${propertyName}-row`);

/** Every row edit icon in the Custom Properties side widget. */
export const getCustomPropertyWidgetEditIcons = (scope: Page | Locator) =>
  scope.getByTestId('custom-properties-widget').getByTestId('edit-icon');

export const setValueForProperty = async (data: {
  page: Page;
  propertyName: string;
  value: string;
  propertyType: string;
  endpoint: EntityTypeEndpoint;
}) => {
  const { page, propertyName, value, propertyType, endpoint } = data;
  await page.click('[data-testid="custom_properties"]');

  const container = getCustomPropertyCard(page, propertyName);

  await expect(container.getByTestId('property-name')).toContainText(
    propertyName
  );

  const editModal = await openCustomPropertyEditModal(page, container);

  const patchRequestPromise = page.waitForResponse(`/api/v1/${endpoint}/*`);
  await fillCustomPropertyEditModal({ page, editModal, propertyType, value });
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

  const container = getCustomPropertyCard(page, propertyName);

  if (propertyType === 'enum') {
    await expect(container.getByTestId('enum-value')).toContainText(value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');
    const interval = container.getByTestId('time-interval-value');

    // The timeline shows formatted dates; the raw epoch bounds are attributes.
    await expect(interval).toHaveAttribute('data-start', startValue);
    await expect(interval).toHaveAttribute('data-end', endValue);
  } else if (propertyType === 'sqlQuery') {
    await expect(container.locator(CODE_EDITOR_CONTENT)).toContainText(value);
  } else if (propertyType === 'table-cp') {
    const values = value.split(',');

    await expect(
      page
        .getByRole('row')
        .filter({ hasText: values[0] })
        .filter({ hasText: values[1] })
        .filter({ visible: true })
    ).not.toHaveCount(0);
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
  endpoint: EntityTypeEndpoint,
  propertyTypes: readonly CustomPropertyTypeByName[] = Object.values(
    CustomPropertyTypeByName
  )
) => {
  const propertiesResponse = await apiContext.get(
    '/api/v1/metadata/types?category=field&limit=20'
  );
  const properties = await propertiesResponse.json();
  const propertyList = properties.data.filter(
    (item: { name: CustomPropertyTypeByName }) =>
      propertyTypes.includes(item.name)
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
  const needsReferenceUsers = propertyTypes.some(
    (propertyType) =>
      propertyType === CustomPropertyTypeByName.ENTITY_REFERENCE ||
      propertyType === CustomPropertyTypeByName.ENTITY_REFERENCE_LIST
  );

  if (needsReferenceUsers) {
    for (let i = 0; i < 4; i++) {
      const user = new UserClass();
      await user.create(apiContext);
      users.push(user);
    }
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
    const customPropertyName = `cp-${item.name}-${uuid()}${NAME_SUFFIX}`;
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

  return { customProperties, cleanupUser, userNames };
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

  // Validation check — name must start with a letter/number and must not contain: " * : ^ $ \ < > & ~ /
  await page.fill(
    '[data-testid="name"]',
    CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_COLON
  );

  await expect(page.locator('#name_help')).toContainText(
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // Correct name
  await page.fill('[data-testid="name"]', propertyName);

  // displayName
  await page.fill('[data-testid="display-name"]', propertyName);

  // Select custom type
  await selectOptionWithRetry(
    page.locator('[data-testid="propertyType"]'),
    page.getByRole('option', { name: customType, exact: true })
  );

  // Enum configuration
  if (customType === 'Enum' && enumConfig) {
    for (const val of enumConfig.values) {
      const enumInput = page.locator(String.raw`#root\/enumConfig`);
      await enumInput.clear();
      await enumInput.pressSequentially(val, { delay: 50 });
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
      await columnInput.pressSequentially(val, { delay: 100 });
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
    await selectOptionWithRetry(
      page.getByTestId('formatConfig'),
      page.getByRole('option', { name: formatConfig, exact: true })
    );
  }

  // Description
  await expect(
    page.locator(String.raw`#root\/entityReferenceConfig_list`)
  ).not.toBeVisible();

  await getDescriptionBox(page).waitFor({ state: 'visible' });
  await expect(getDescriptionBox(page)).toHaveCount(1);
  await getDescriptionBox(page).click();
  await page.keyboard.type(customPropertyData.description, { delay: 50 });

  // Click on name field to blur description and trigger validation without closing modal
  await page.click('[data-testid="name"]');

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
  await page.getByTestId('custom-property-form').waitFor({
    state: 'detached',
  });

  // CRITICAL: Wait for UI to update after API response
  await waitForAllLoadersToDisappear(page);

  expect(response.status()).toBe(200);
  await expect(
    page.locator('tr').filter({ hasText: propertyName })
  ).toBeVisible();
};

/**
 * Records every custom-property save PATCH from before the click. The UI
 * patches a property by name with a `test` guard and retries when a concurrent
 * edit shifted the list, so a save can be one or more stale-index rejections
 * (400) followed by the attempt that lands. Call `expectSaved` after asserting
 * the visible outcome, so a failed save reports on that assertion first.
 */
export const recordCustomPropertySaves = (page: Page) => {
  const saves: Response[] = [];
  const onResponse = (res: Response) => {
    if (
      res.url().includes('/api/v1/metadata/types/') &&
      res.request().method() === 'PATCH'
    ) {
      saves.push(res);
    }
  };
  page.on('response', onResponse);

  return {
    expectSaved: async () => {
      await expect.poll(() => saves.at(-1)?.status()).toBe(200);
      page.off('response', onResponse);

      // Anything before the successful save must be a rejected attempt the UI
      // retried, not a failure that was silently dropped.
      expect(saves.slice(0, -1).map((res) => res.status())).toEqual(
        saves.slice(0, -1).map(() => 400)
      );
    },
  };
};

/**
 * Removes one custom property by name without touching the others. Replacing
 * the whole list from an earlier read would drop properties that concurrently
 * running specs added in between, so this removes by index guarded by a `test`
 * on the name, rebuilt from a fresh read if the list shifted.
 */
export const removeCustomPropertyViaApi = async (
  apiContext: APIRequestContext,
  typeFqn: string,
  propertyName: string
) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const typeRes = await apiContext.get(
      `/api/v1/metadata/types/name/${typeFqn}?fields=customProperties`
    );
    const type = (await typeRes.json()) as {
      id: string;
      customProperties?: { name: string }[];
    };
    const index = (type.customProperties ?? []).findIndex(
      (property) => property.name === propertyName
    );

    if (index === -1) {
      return;
    }

    const res = await apiContext.patch(`/api/v1/metadata/types/${type.id}`, {
      data: [
        {
          op: 'test',
          path: `/customProperties/${index}/name`,
          value: propertyName,
        },
        { op: 'remove', path: `/customProperties/${index}` },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });

    if (res.ok()) {
      return;
    }
  }

  throw new Error(`Could not remove custom property ${propertyName}`);
};

export const editCreatedProperty = async (
  page: Page,
  propertyName: string,
  type?: string
) => {
  const propertyRow = page.locator(`[data-row-key="${propertyName}"]`);

  if (type === 'Enum') {
    await expect(
      propertyRow.getByTestId('enum-config').getByTestId('config-value')
    ).toHaveText(['enum1', 'enum2', 'enum3']);
  }

  if (type === 'Table') {
    const tableConfig = propertyRow.getByTestId('table-config');
    await expect(tableConfig).toBeVisible();
    await expect(tableConfig).toContainText('Columns');
    await expect(
      tableConfig.getByTestId('config-value').filter({ hasText: 'pw-column1' })
    ).toBeVisible();
    await expect(
      tableConfig.getByTestId('config-value').filter({ hasText: 'pw-column2' })
    ).toBeVisible();
  }

  await selectOptionWithRetry(
    propertyRow.getByTestId('property-actions'),
    page.getByRole('menuitem', { name: 'Edit' })
  );

  const modal = page.getByTestId('edit-custom-property-modal');
  const displayNameInput = modal
    .getByTestId('edit-custom-property-display-name')
    .getByRole('textbox');

  await displayNameInput.fill(propertyName.toUpperCase());

  await fillDescriptionBox(page, '');
  await fillDescriptionBox(page, 'This is new description');

  if (type === 'Enum') {
    const enumInput = modal
      .getByTestId('edit-custom-property-enum-config')
      .locator('input');

    await enumInput.fill('updatedValue');
    await enumInput.press('Enter');
  }

  if (ENTITY_REFERENCE_PROPERTIES.includes(type ?? '')) {
    await selectOptionWithRetry(
      modal
        .getByTestId('edit-custom-property-entity-ref-config')
        .locator('input'),
      page.getByRole('option', { exact: true, name: 'Table' })
    );

    // Multi-select keeps the listbox open over the footer.
    await closeEditModalListbox(modal);
    await expect(page.getByRole('listbox')).toBeHidden();
  }

  const saves = recordCustomPropertySaves(page);

  await modal.getByTestId('edit-custom-property-save').click();

  await expect(modal).not.toBeVisible();
  await saves.expectSaved();

  // Fetching for updated descriptions for the created custom property
  await expect(propertyRow.getByTestId('property-description')).toContainText(
    'This is new description'
  );

  // The row shows the first three config values and counts the rest.
  if (type === 'Enum') {
    const enumConfig = propertyRow.getByTestId('enum-config');

    await expect(enumConfig.getByTestId('config-value')).toHaveText([
      'enum1',
      'enum2',
      'enum3',
    ]);
    await expect(enumConfig.getByTestId('config-hidden-count')).toHaveText(
      '+1'
    );
  }

  if (ENTITY_REFERENCE_PROPERTIES.includes(type ?? '')) {
    const entityConfig = propertyRow.getByTestId(`${propertyName}-config`);

    await expect(entityConfig.getByTestId('config-value')).toHaveText([
      'User',
      'Team',
      'Metric',
    ]);
    await expect(entityConfig.getByTestId('config-hidden-count')).toHaveText(
      '+1'
    );
  }
};

export const deleteCreatedProperty = async (
  page: Page,
  propertyName: string
) => {
  await selectOptionWithRetry(
    page
      .locator(`[data-row-key="${propertyName}"]`)
      .getByTestId('property-actions'),
    page.getByRole('menuitem', { name: 'Delete' })
  );

  const dialog = page.getByRole('dialog', { name: 'Delete Property' });

  await waitForAntOverlayToOpen(dialog);
  await expect(dialog.getByTestId('body-text')).toContainText(propertyName);

  const saves = recordCustomPropertySaves(page);

  await dialog.getByTestId('save-button').click();

  // ConfirmationModal is destroyOnClose: assert the body text unmounts so
  // the modal mask is gone before the next sidebar click in callers' loops.
  await expect(page.locator('[data-testid="body-text"]')).not.toBeAttached();
  await saves.expectSaved();
  await expect(
    page.locator(`[data-row-key="${propertyName}"]`)
  ).not.toBeVisible();
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
  await waitForAllLoadersToDisappear(page);

  // Open advanced search dialog
  await showAdvancedSearchDialog(page);

  const ruleLocator = page.getByTestId('query-builder-rule-0');

  // Select "Custom Properties" from the field dropdown. Each level below it
  // gets its own control in the row, suffixed by depth.
  await selectOption(
    page,
    ruleLocator.getByTestId('advanced-search-field-select'),
    'Custom Properties',
    true
  );

  if (entityType !== 'TableColumn') {
    await selectOption(
      page,
      ruleLocator.getByTestId('advanced-search-field-select-1'),
      entityType,
      true
    );

    if (propertyType === 'Time Interval') {
      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-field-select-2'),
        `${propertyName} (Start)`,
        true
      );
      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-field-select-2'),
        `${propertyName} (End)`,
        true
      );
    } else if (propertyType === 'Hyperlink') {
      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-field-select-2'),
        `${propertyName} URL`,
        true
      );
      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-field-select-2'),
        `${propertyName} Display Text`,
        true
      );
    } else if (propertyType === 'Table') {
      for (const column of propertyConfig ?? []) {
        await selectOption(
          page,
          ruleLocator.getByTestId('advanced-search-field-select-2'),
          `${propertyName} - ${column}`,
          true
        );
      }
    } else {
      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-field-select-2'),
        propertyName,
        true
      );
    }
  }
  await page.getByTestId('cancel-btn').click();
};

/**
 * Row of `propertyName` in a side panel's Custom Properties tab: the Explore
 * summary panel or the column detail panel.
 */
export const getCustomPropertyPanelRow = (
  scope: Page | Locator,
  propertyName: string
) =>
  scope
    .getByTestId('custom-properties-list')
    .getByTestId(`custom-property-${propertyName}-row`);

/**
 * Text the panel row summary must contain once `value` is saved, or undefined
 * where the row shows a derived summary (counts, durations, formatted dates,
 * entity display names).
 */
const getExpectedRowSummary = (propertyType: string, value: string) => {
  switch (propertyType) {
    case 'string':
    case 'integer':
    case 'number':
    case 'email':
    case 'duration':
    case 'enum':
      return value;
    case 'markdown':
      return value.replaceAll(/[*_]/g, '');
    case 'hyperlink-cp': {
      const [url, displayText] = value.split(',');

      return displayText || url;
    }
    default:
      return undefined;
  }
};

const validateCustomPropertyPanelRow = async (
  row: Locator,
  propertyType: string,
  value: string
) => {
  const summary = row.getByTestId('property-value');
  const expected = getExpectedRowSummary(propertyType, value);

  await expect(summary).not.toHaveText('Not set');
  if (expected) {
    await expect(summary).toContainText(expected);
  }
};

export const verifyTableColumnCustomPropertyPersistence = async ({
  page,
  columnFqn,
  tableFqn,
  propertyName,
  propertyType,
  users,
}: {
  page: Page;
  columnFqn: string;
  tableFqn: string;
  propertyName: string;
  propertyType: string;
  users: Record<string, string>;
}) => {
  const testValue = getPropertyValues(propertyType, users).value;
  const columnsProfileResponse = () =>
    page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/tables/name/${encodeURIComponent(tableFqn)}/columns`
          ) &&
        response.url().includes('fields') &&
        response.request().method() === 'GET',
      // TODO: Reduce timeout once the latency issue is fixed
      { timeout: 150_000 }
    );

  // 1. Navigate and Open Column Detail Panel
  const initialColumnsResponse = columnsProfileResponse();
  await page.goto(`/table/${columnFqn}`, { waitUntil: 'domcontentloaded' });
  await initialColumnsResponse;
  await waitForAllLoadersToDisappear(page);
  const sidePanel = page.locator('.column-detail-panel-container');
  await expect(sidePanel).toBeVisible();

  // 3. Go to Custom Properties Tab
  const customPropertiesTab = page.getByTestId('custom-properties-tab');
  await customPropertiesTab.click();

  const searchbar = sidePanel.getByTestId('searchbar');
  await expect(searchbar).toBeVisible();
  await searchbar.fill(propertyName);

  // 4. Edit Value
  const row = getCustomPropertyPanelRow(sidePanel, propertyName);
  const editModal = await openCustomPropertyEditModal(page, row);

  const updateColumnResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/columns/name') &&
      response.request().method() === 'PUT' &&
      response.ok()
  );

  await fillCustomPropertyEditModal({
    page,
    editModal,
    propertyType,
    value: testValue,
  });
  await updateColumnResponse;
  await waitForAllLoadersToDisappear(page);

  await validateCustomPropertyPanelRow(row, propertyType, testValue);

  const reloadColumnsResponse = columnsProfileResponse();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await reloadColumnsResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(
    page.locator(
      '.column-detail-panel-container [data-testid="custom-properties-tab"]'
    )
  ).toBeVisible();
  await customPropertiesTab.click();
  await expect(searchbar).toBeVisible();
  await searchbar.clear();
  await searchbar.fill(propertyName);

  await validateCustomPropertyPanelRow(row, propertyType, testValue);

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
  entityFQN?: string;
  exploreTab?: string;
}) => {
  const {
    page,
    entityName,
    propertyDetails,
    value,
    endpoint,
    skipNavigation,
    entityFQN,
    exploreTab,
  } = data;
  const propertyName = propertyDetails.name;
  const propertyType = propertyDetails.propertyType.name;

  if (!skipNavigation) {
    await navigateToExploreAndSelectTable(
      page,
      entityName,
      endpoint,
      exploreTab,
      entityFQN
    );
    await waitForAllLoadersToDisappear(page);
    await navigateToEntityPanelTab(page, 'custom property');
    await waitForAllLoadersToDisappear(page);
  }

  // Scope everything to the panel container to avoid matching stray elements
  // elsewhere on the Explore page when tests run in parallel.
  const panelContainer = page.locator('.entity-summary-panel-container');
  const searchbar = panelContainer.getByTestId('searchbar');
  await expect(searchbar).toBeVisible();
  await searchbar.fill(propertyName);

  // The search is client side, so wait for the filtered list to settle on
  // the single matching row before interacting with it.
  await expect(
    panelContainer.getByTestId('custom-properties-list').getByRole('listitem')
  ).toHaveCount(1);

  const row = getCustomPropertyPanelRow(panelContainer, propertyName);

  await expect(row.getByTestId('property-name')).toContainText(propertyName);

  const editModal = await openCustomPropertyEditModal(page, row);

  const patchRequestPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${endpoint}/`) &&
      response.request().method() === 'PATCH'
  );

  await fillCustomPropertyEditModal({ page, editModal, propertyType, value });

  const patchRequest = await patchRequestPromise;
  expect(patchRequest.status()).toBe(200);

  await validateCustomPropertyPanelRow(row, propertyType, value);
};
