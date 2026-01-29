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
import { expect, Page, Response } from '@playwright/test';
import { isObject, isUndefined, upperFirst } from 'lodash';
import {
  CP_BASE_VALUES,
  MULTISELECT_OPERATORS,
} from '../constant/customPropertyAdvancedSearch';
import { EntityType } from '../enum/entity.enum';
import { EntityClass } from '../support/entity/EntityClass';
import { TopicClass } from '../support/entity/TopicClass';
import { selectOption, showAdvancedSearchDialog } from './advancedSearch';
import { getApiContext, uuid } from './common';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from './entity';

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
  propertyNames: Record<string, string>;
}

export const getCustomPropertyCreationData = (
  types: CPASTestData['types']
): Record<string, CustomPropertyDetails> => {
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
  entity: EntityClass,
  topic1: TopicClass,
  topic2: TopicClass
) => {
  const { apiContext, afterAction } = await getApiContext(page);

  // Get the metadata types info required to create custom properties
  const typesInfo = await apiContext.get(
    '/api/v1/metadata/types?category=field&limit=20'
  );

  // Get the entity metadata types info to add custom properties to it
  const cpMetadataType = await apiContext.get(
    `/api/v1/metadata/types/name/${entity.entityType}?fields=customProperties`
  );

  testData.types = (await typesInfo.json()).data;
  testData.cpMetadataType = await cpMetadataType.json();

  // Map and prepare the data required for creating custom properties of different types
  const cpCreationData = getCustomPropertyCreationData(testData.types);

  // The API calls need to be sequential as the server replaces some types with others
  // due to simultaneous requests causing conflicts.
  for (const type of testData.types) {
    const typeData = cpCreationData[type.name];

    if (!isUndefined(typeData)) {
      await apiContext.put(
        `/api/v1/metadata/types/${testData.cpMetadataType.id}`,
        {
          data: typeData,
        }
      );
    }
  }

  testData.createdCPData = Object.values(cpCreationData);

  // Get the custom property to values mapping to add to the entity
  const cpValuesData = getCustomPropertyValues(
    Object.values(cpCreationData),
    topic1,
    topic2
  );

  // Update the entity with the created custom property values
  await apiContext.patch(
    `/api/v1/${entity.endpoint}/${entity.entityResponseData.id}`,
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
    let getInitialOptions: Promise<Response> | undefined;
    let getSearchResults: Promise<Response> | undefined;

    // Convert object values to JSON strings
    const stringValue = isObject(value) ? JSON.stringify(value) : String(value);

    if (
      propertyType === 'entityReference' ||
      propertyType === 'entityReferenceList'
    ) {
      // Listen to the get options API call
      getInitialOptions = page.waitForResponse(
        '/api/v1/search/aggregate?*field=displayName.keyword*'
      );
    }

    await inputElement.click();

    if (!isUndefined(getInitialOptions)) {
      await getInitialOptions;
    }

    if (
      propertyType === 'entityReference' ||
      propertyType === 'entityReferenceList'
    ) {
      // Listen to the search API call after typing the value
      getSearchResults = page.waitForResponse(
        `/api/v1/search/aggregate?*${getEncodedFqn(
          escapeESReservedCharacters(stringValue)
        )}*`
      );
    }

    await inputElement.fill(stringValue);

    if (!isUndefined(getSearchResults)) {
      await getSearchResults;
    }

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

export const applyCustomPropertyFilter = async ({
  page,
  propertyName,
  operator,
  value,
  entityType,
  propertyType,
}: {
  page: Page;
  propertyName: string;
  operator: string;
  value?: string | number | { start: string | number; end: string | number };
  entityType: EntityType;
  propertyType?: string;
}) => {
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
    upperFirst(entityType),
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

  if (!operator.includes('null') && !isUndefined(value)) {
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
  entityFQN: string,
  shouldBeVisible: boolean
) => {
  const searchResponse = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=15*'
  );
  await page.getByTestId('apply-btn').click();
  await searchResponse;

  await waitForAllLoadersToDisappear(page);

  const entityCardSelector = `table-data-card_${entityFQN}`;

  if (shouldBeVisible) {
    await expect(page.getByTestId(entityCardSelector)).toBeVisible();
  } else {
    await expect(page.getByTestId(entityCardSelector)).not.toBeVisible();
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

export const testASForTextTypedCP = async ({
  page,
  propertyName,
  entity,
  equalValue,
  likeValue,
}: {
  page: Page;
  propertyName: string;
  entity: EntityClass;
  equalValue: string;
  likeValue: string;
}) => {
  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'equal',
    value: equalValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_equal',
    value: equalValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'like',
    value: likeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_like',
    value: likeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_not_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);
};

export const testASForNumberTypedCP = async ({
  page,
  propertyName,
  entity,
  equalValue,
  rangeValue,
}: {
  page: Page;
  propertyName: string;
  entity: EntityClass;
  equalValue: number;
  rangeValue: {
    start: number;
    end: number;
  };
}) => {
  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'equal',
    value: equalValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_equal',
    value: equalValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'between',
    value: rangeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_between',
    value: rangeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_not_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);
};

export const testASForEntityReferenceTypedCP = async ({
  page,
  propertyName,
  entity,
  topic1,
  topic2,
}: {
  page: Page;
  propertyName: string;
  entity: EntityClass;
  topic1: TopicClass;
  topic2?: TopicClass;
}) => {
  const containsText = topic1.entityResponseData.displayName.substring(1, 5);
  const regexpText = `${topic1.entityResponseData.displayName.substring(
    0,
    2
  )}.*${topic1.entityResponseData.displayName.substring(5, 7)}.*`;

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'select_equals',
    value: topic1.entityResponseData.displayName,
    entityType: entity.entityType,
    propertyType: 'entityReference',
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  if (!isUndefined(topic2)) {
    await showAdvancedSearchDialog(page);
    await applyCustomPropertyFilter({
      page,
      propertyName,
      operator: 'select_equals',
      value: topic2.entityResponseData.displayName,
      entityType: entity.entityType,
      propertyType: 'entityReference',
    });
    await verifySearchResults(
      page,
      entity.entityResponseData.fullyQualifiedName,
      true
    );
    await clearAdvancedSearchFilters(page);
  }

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'select_not_equals',
    value: topic1.entityResponseData.displayName,
    entityType: entity.entityType,
    propertyType: 'entityReference',
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'like',
    value: containsText,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_like',
    value: containsText,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'regexp',
    value: regexpText,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_not_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);
};

export const testASForDateTypedCP = async ({
  page,
  propertyName,
  entity,
  equalValue,
  rangeValue,
  propertyType,
}: {
  page: Page;
  propertyName: string;
  entity: EntityClass;
  equalValue: string;
  rangeValue: {
    start: string;
    end: string;
  };
  propertyType: string;
}) => {
  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'equal',
    value: equalValue,
    entityType: entity.entityType,
    propertyType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_equal',
    value: equalValue,
    entityType: entity.entityType,
    propertyType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'between',
    value: rangeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'not_between',
    value: rangeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_not_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);
};

export const testASForEnumTypedCP = async ({
  page,
  propertyName,
  entity,
  equalValue,
  likeValue,
}: {
  page: Page;
  propertyName: string;
  entity: EntityClass;
  equalValue: string;
  likeValue: string;
}) => {
  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'multiselect_equals',
    value: equalValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'multiselect_contains',
    value: likeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'multiselect_not_equals',
    value: equalValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'multiselect_not_contains',
    value: likeValue,
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    false
  );
  await clearAdvancedSearchFilters(page);

  await showAdvancedSearchDialog(page);
  await applyCustomPropertyFilter({
    page,
    propertyName,
    operator: 'is_not_null',
    entityType: entity.entityType,
  });
  await verifySearchResults(
    page,
    entity.entityResponseData.fullyQualifiedName,
    true
  );
  await clearAdvancedSearchFilters(page);
};
