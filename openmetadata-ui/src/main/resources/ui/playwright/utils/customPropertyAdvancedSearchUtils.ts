/*
 *  Copyright 2026 Collate.
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
import { isObject, isUndefined } from 'lodash';
import {
  CP_BASE_VALUES,
  MULTISELECT_OPERATORS,
} from '../constant/customPropertyAdvancedSearch';
import { DashboardClass } from '../support/entity/DashboardClass';
import { TopicClass } from '../support/entity/TopicClass';
import { selectOption } from './advancedSearch';
import { getApiContext, uuid } from './common';
import { waitForAllLoadersToDisappear } from './entity';

export interface CustomPropertyDetails {
  name: string;
  description: string;
  propertyType: {
    name: string;
    type: string;
    id: string;
  };
  customPropertyConfig?: {
    config:
      | string
      | string[]
      | { values: string[]; multiSelect: boolean }
      | { columns: string[] };
  };
}

export interface CPASTestData {
  types: { name: string; id: string }[];
  cpMetadataType: { name: string; id: string };
  createdCPData: CustomPropertyDetails[];
}

export const getCustomPropertyCreationData = (types: CPASTestData['types']) => {
  const namePrefix = `new${uuid()}cpas${uuid()}`;
  const typeIdMapping = types.reduce((acc, type) => {
    acc[type.name] = type.id;

    return acc;
  }, {} as Record<string, string>);

  return {
    'date-cp': {
      name: `${namePrefix}datecp`,
      description: `Description for ${namePrefix}date-cp`,
      propertyType: {
        name: 'date-cp',
        type: 'type',
        id: typeIdMapping['date-cp'],
      },
      customPropertyConfig: { config: 'dd-MM-yyyy' },
    },
    'dateTime-cp': {
      name: `${namePrefix}dateTimecp`,
      description: `Description for ${namePrefix}dateTime-cp`,
      propertyType: {
        name: 'dateTime-cp',
        type: 'type',
        id: typeIdMapping['dateTime-cp'],
      },
      customPropertyConfig: { config: 'dd-MM-yyyy HH:mm:ss' },
    },
    duration: {
      name: `${namePrefix}duration`,
      description: `Description for ${namePrefix}duration`,
      propertyType: {
        name: 'duration',
        type: 'type',
        id: typeIdMapping['duration'],
      },
    },
    email: {
      name: `${namePrefix}email`,
      description: `Description for ${namePrefix}email`,
      propertyType: { name: 'email', type: 'type', id: typeIdMapping['email'] },
    },
    entityReference: {
      name: `${namePrefix}entityReference`,
      description: `Description for ${namePrefix}entityReference`,
      propertyType: {
        name: 'entityReference',
        type: 'type',
        id: typeIdMapping['entityReference'],
      },
      customPropertyConfig: { config: ['topic'] },
    },
    entityReferenceList: {
      name: `${namePrefix}entityReferenceList`,
      description: `Description for ${namePrefix}entityReferenceList`,
      propertyType: {
        name: 'entityReferenceList',
        type: 'type',
        id: typeIdMapping['entityReferenceList'],
      },
      customPropertyConfig: { config: ['topic'] },
    },
    enum: {
      name: `${namePrefix}enum`,
      description: `Description for ${namePrefix}enum`,
      propertyType: { name: 'enum', type: 'type', id: typeIdMapping['enum'] },
      customPropertyConfig: {
        config: {
          values: ['Option 1', 'Option 2', 'Option 3'],
          multiSelect: false,
        },
      },
    },
    'hyperlink-cp': {
      name: `${namePrefix}hyperlink-cp`,
      description: `Description for ${namePrefix}hyperlink-cp`,
      propertyType: {
        name: 'hyperlink-cp',
        type: 'type',
        id: typeIdMapping['hyperlink-cp'],
      },
    },
    integer: {
      name: `${namePrefix}integer`,
      description: `Description for ${namePrefix}integer`,
      propertyType: {
        name: 'integer',
        type: 'type',
        id: typeIdMapping['integer'],
      },
    },
    markdown: {
      name: `${namePrefix}markdown`,
      description: `Description for ${namePrefix}markdown`,
      propertyType: {
        name: 'markdown',
        type: 'type',
        id: typeIdMapping['markdown'],
      },
    },
    number: {
      name: `${namePrefix}number`,
      description: `Description for ${namePrefix}number`,
      propertyType: {
        name: 'number',
        type: 'type',
        id: typeIdMapping['number'],
      },
    },
    sqlQuery: {
      name: `${namePrefix}sqlQuery`,
      description: `Description for ${namePrefix}sqlQuery`,
      propertyType: {
        name: 'sqlQuery',
        type: 'type',
        id: typeIdMapping['sqlQuery'],
      },
    },
    string: {
      name: `${namePrefix}string`,
      description: `Description for ${namePrefix}string`,
      propertyType: {
        name: 'string',
        type: 'type',
        id: typeIdMapping['string'],
      },
    },
    'table-cp': {
      name: `${namePrefix}tablecp`,
      description: `Description for ${namePrefix}tablecp`,
      propertyType: {
        name: 'table-cp',
        type: 'type',
        id: typeIdMapping['table-cp'],
      },
      customPropertyConfig: {
        config: {
          columns: ['Sr No', 'Name', 'Role'],
        },
      },
    },
    'time-cp': {
      name: `${namePrefix}timecp`,
      description: `Description for ${namePrefix}timecp`,
      propertyType: {
        name: 'time-cp',
        type: 'type',
        id: typeIdMapping['time-cp'],
      },
      customPropertyConfig: { config: 'HH:mm:ss' },
    },
    timeInterval: {
      name: `${namePrefix}timeInterval`,
      description: `Description for ${namePrefix}timeInterval`,
      propertyType: {
        name: 'timeInterval',
        type: 'type',
        id: typeIdMapping['timeInterval'],
      },
    },
    timestamp: {
      name: `${namePrefix}timestamp`,
      description: `Description for ${namePrefix}timestamp`,
      propertyType: {
        name: 'timestamp',
        type: 'type',
        id: typeIdMapping['timestamp'],
      },
    },
  };
};

export const getCustomPropertyValues = (
  createdCPData: CustomPropertyDetails[],
  topic1: TopicClass,
  topic2: TopicClass
) => {
  const topic1Ref = {
    id: topic1.entityResponseData.id,
    name: topic1.entityResponseData.name,
    type: 'topic',
    deleted: false,
    description: topic1.entityResponseData.description,
    displayName: topic1.entityResponseData.displayName,
    fullyQualifiedName: topic1.entityResponseData.fullyQualifiedName,
  };
  const topic2Ref = {
    id: topic2.entityResponseData.id,
    name: topic2.entityResponseData.name,
    type: 'topic',
    deleted: false,
    description: topic2.entityResponseData.description,
    displayName: topic2.entityResponseData.displayName,
    fullyQualifiedName: topic2.entityResponseData.fullyQualifiedName,
  };

  const cpTypeToNameMapping = createdCPData.reduce((acc, cp) => {
    acc[cp.propertyType.name] = cp.name;

    return acc;
  }, {} as Record<string, string>);

  return {
    [cpTypeToNameMapping['date-cp']]: CP_BASE_VALUES.dateCp,
    [cpTypeToNameMapping['dateTime-cp']]: CP_BASE_VALUES.dateTimeCp,
    [cpTypeToNameMapping['duration']]: CP_BASE_VALUES.duration,
    [cpTypeToNameMapping['email']]: CP_BASE_VALUES.email,
    [cpTypeToNameMapping['entityReference']]: topic1Ref,
    [cpTypeToNameMapping['entityReferenceList']]: [topic1Ref, topic2Ref],
    [cpTypeToNameMapping['enum']]: CP_BASE_VALUES.enum,
    [cpTypeToNameMapping['hyperlink-cp']]: CP_BASE_VALUES.hyperlinkCp,
    [cpTypeToNameMapping['integer']]: CP_BASE_VALUES.integer,
    [cpTypeToNameMapping['markdown']]: CP_BASE_VALUES.markdown,
    [cpTypeToNameMapping['number']]: CP_BASE_VALUES.number,
    [cpTypeToNameMapping['sqlQuery']]: CP_BASE_VALUES.sqlQuery,
    [cpTypeToNameMapping['string']]: CP_BASE_VALUES.string,
    [cpTypeToNameMapping['table-cp']]: CP_BASE_VALUES.tableCp,
    [cpTypeToNameMapping['time-cp']]: CP_BASE_VALUES.timeCp,
    [cpTypeToNameMapping['timeInterval']]: CP_BASE_VALUES.timeInterval,
    [cpTypeToNameMapping['timestamp']]: CP_BASE_VALUES.timestamp,
  };
};

export const setupCustomPropertyAdvancedSearchTest = async (
  page: Page,
  testData: CPASTestData,
  dashboard: DashboardClass,
  topic1: TopicClass,
  topic2: TopicClass
) => {
  const { apiContext, afterAction } = await getApiContext(page);

  // Get the metadata types info required to create custom properties
  const typesInfo = await apiContext.get(
    '/api/v1/metadata/types?category=field&limit=20'
  );

  // Get the dashboard metadata types info to add custom properties to it
  const cpMetadataType = await apiContext.get(
    '/api/v1/metadata/types/name/dashboard?fields=customProperties'
  );

  testData.types = (await typesInfo.json()).data;
  testData.cpMetadataType = await cpMetadataType.json();

  // Map and prepare the data required for creating custom properties of different types
  const cpCreationData = getCustomPropertyCreationData(testData.types);
  testData.createdCPData = Object.values(cpCreationData);

  // The API calls need to be sequential as the server replaces some types with others
  // due to simultaneous requests causing conflicts.
  for (const type of testData.types) {
    const typeData = cpCreationData[type.name as keyof typeof cpCreationData];

    if (!isUndefined(typeData)) {
      await apiContext.put(
        `/api/v1/metadata/types/${testData.cpMetadataType.id}`,
        {
          data: typeData,
        }
      );
    }
  }

  // Get the custom property to values mapping to add to the dashboard entity
  const cpValuesData = getCustomPropertyValues(
    testData.createdCPData,
    topic1,
    topic2
  );

  // Update the dashboard entity with the created custom property values
  await apiContext.patch(
    `/api/v1/dashboards/${dashboard.entityResponseData.id}`,
    {
      data: [
        {
          op: 'add',
          path: '/extension',
          value: cpValuesData,
        },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );

  await afterAction();
};

export const getOperatorLabel = (operator: string): string => {
  const operatorMap: Record<string, string> = {
    equal: '==',
    not_equal: '!=',
    like: 'Contains',
    not_like: 'Not contains',
    is_null: 'Is null',
    is_not_null: 'Is not null',
    between: 'Between',
    not_between: 'Not between',
    multiselect_contains: 'Contains',
    multiselect_not_contains: 'Not contains',
    multiselect_equals: 'Equals',
    multiselect_not_equals: 'Not equals',
    select_equals: '==',
    select_not_equals: '!=',
    regexp: 'Regular Expression',
  };

  return operatorMap[operator] || operator;
};

const handlePropertyValueInput = async (
  page: Page,
  ruleLocator: ReturnType<Page['locator']>,
  operator: string,
  value: string | number | { start: string | number; end: string | number },
  propertyType?: string
) => {
  const inputElement = ruleLocator.locator('.rule--widget input');

  // Fill the input only if it's visible
  if (await inputElement.isVisible()) {
    // Convert object values to JSON strings
    const stringValue = isObject(value) ? JSON.stringify(value) : String(value);
    await inputElement.click();
    await inputElement.fill(stringValue);

    // Press Enter for multiselect operators and date types
    if (
      MULTISELECT_OPERATORS.includes(operator) ||
      ((operator === 'equal' || operator === 'not_equal') &&
        propertyType === 'dateTime-cp') ||
      propertyType === 'date-cp'
    ) {
      await page.keyboard.press('Enter');
    }

    // Handle entity reference selection
    if (
      propertyType === 'entityReference' ||
      propertyType === 'entityReferenceList'
    ) {
      await page
        .locator(`.ant-select-dropdown:visible [title*="${value as string}"]`)
        .first()
        .click();
    }
  }
};

export const applyCustomPropertyFilter = async (
  page: Page,
  propertyName: string,
  operator: string,
  value: string | number | { start: string | number; end: string | number },
  entityType: string = 'Dashboard',
  propertyType?: string
) => {
  const ruleLocator = page.locator('.rule').nth(0);

  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    'Custom Properties',
    true
  );

  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    entityType,
    true
  );

  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    propertyName,
    true
  );

  const operatorLabel = getOperatorLabel(operator);
  await selectOption(
    page,
    ruleLocator.locator('.rule--operator .ant-select'),
    operatorLabel
  );

  if (!operator.includes('null')) {
    if (operator === 'between' || operator === 'not_between') {
      const rangeValue = value as {
        start: string | number;
        end: string | number;
      };
      const startInput = ruleLocator.locator('.rule--value input').first();
      const endInput = ruleLocator.locator('.rule--value input').last();

      await startInput.click();
      await startInput.fill(String(rangeValue.start));
      await endInput.click();
      await endInput.fill(String(rangeValue.end));

      await page.keyboard.press('Enter');
    } else {
      await handlePropertyValueInput(
        page,
        ruleLocator,
        operator,
        value,
        propertyType
      );
    }
  }
};

export const verifySearchResults = async (
  page: Page,
  dashboardFQN: string,
  shouldBeVisible: boolean,
  filterValue?: string
) => {
  const searchResponse = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=15*'
  );
  await page.getByTestId('apply-btn').click();
  await searchResponse;

  await waitForAllLoadersToDisappear(page);

  const dashboardCardSelector = `table-data-card_${dashboardFQN}`;

  if (shouldBeVisible) {
    await expect(page.getByTestId(dashboardCardSelector)).toBeVisible();
  } else {
    await expect(page.getByTestId(dashboardCardSelector)).not.toBeVisible();
  }

  if (filterValue) {
    await expect(
      page.getByTestId('advance-search-filter-container')
    ).toBeVisible();
  }
};

export const clearAdvancedSearchFilters = async (page: Page) => {
  const clearResponse = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('clear-filters').click();
  await clearResponse;
  await waitForAllLoadersToDisappear(page);
};
