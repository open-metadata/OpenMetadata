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
import { isArray, isUndefined, omit, omitBy } from 'lodash';
import { StatusByDimension } from '../../components/DataQuality/ChartWidgets/StatusByDimensionWidget/StatusByDimensionWidget.interface';
import { TestCaseSearchParams } from '../../components/DataQuality/DataQuality.interface';
import { TEST_CASE_FILTERS } from '../../constants/profiler.constant';
import { DataQualityReport } from '../../generated/tests/dataQualityReport';
import { TestCaseParameterValue } from '../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import { generateEntityLink } from '../TableUtils';

/**
 * Builds the parameters for a test case search based on the given filters.
 * @param params - The original test case parameters.
 * @param filters - The filters to apply to the test case parameters.
 * @returns The updated test case parameters with the applied filters.
 */
export const buildTestCaseParams = (
  params: ListTestCaseParamsBySearch | undefined,
  filters: string[]
): ListTestCaseParamsBySearch => {
  if (!params) {
    return {};
  }

  const filterParams = (
    paramKey: keyof ListTestCaseParamsBySearch,
    filterKey: string
  ) => (filters.includes(filterKey) ? { [paramKey]: params[paramKey] } : {});

  return {
    ...filterParams('endTimestamp', TEST_CASE_FILTERS.lastRun),
    ...filterParams('startTimestamp', TEST_CASE_FILTERS.lastRun),
    ...filterParams('entityLink', TEST_CASE_FILTERS.table),
    ...filterParams('testPlatforms', TEST_CASE_FILTERS.platform),
    ...filterParams('testCaseType', TEST_CASE_FILTERS.type),
    ...filterParams('testCaseStatus', TEST_CASE_FILTERS.status),
    ...filterParams('tags', TEST_CASE_FILTERS.tags),
    ...filterParams('tier', TEST_CASE_FILTERS.tier),
    ...filterParams('serviceName', TEST_CASE_FILTERS.service),
  };
};

export const createTestCaseParameters = (
  params?: Record<string, string | { [key: string]: string }[]>,
  selectedDefinition?: TestDefinition
): TestCaseParameterValue[] | undefined => {
  return params
    ? Object.entries(params).reduce((acc, [key, value]) => {
        const paramDef = selectedDefinition?.parameterDefinition?.find(
          (param) => param.name === key
        );

        if (paramDef?.dataType === TestDataType.Array && isArray(value)) {
          const arrayValues = value.map((item) => item.value).filter(Boolean);
          if (arrayValues.length) {
            acc.push({ name: key, value: JSON.stringify(arrayValues) });
          }
        } else {
          acc.push({ name: key, value: value as string });
        }

        return acc;
      }, [] as TestCaseParameterValue[])
    : params;
};

export const getTestCaseFiltersValue = (
  values: TestCaseSearchParams,
  selectedFilter: string[]
) => {
  const { lastRunRange, tableFqn } = values;
  const startTimestamp = lastRunRange?.startTs;
  const endTimestamp = lastRunRange?.endTs;
  const entityLink = tableFqn ? generateEntityLink(tableFqn) : undefined;

  const apiParams = {
    ...omit(values, ['lastRunRange', 'tableFqn', 'searchValue']),
    startTimestamp,
    endTimestamp,
    entityLink,
  };

  const updatedParams = omitBy(
    buildTestCaseParams(apiParams, selectedFilter),
    isUndefined
  );

  return updatedParams;
};

export const transformToTestCaseStatusByDimension = (
  inputData: DataQualityReport['data']
): StatusByDimension[] => {
  const result: { [key: string]: StatusByDimension } = {};

  inputData.forEach((item) => {
    const {
      document_count,
      'testCaseResult.testCaseStatus': status,
      dataQualityDimension,
    } = item;
    const count = parseInt(document_count, 10);

    if (!result[dataQualityDimension]) {
      result[dataQualityDimension] = {
        title: dataQualityDimension,
        success: 0,
        failed: 0,
        aborted: 0,
        total: 0,
      };
    }

    if (status === 'success') {
      result[dataQualityDimension].success += count;
    } else if (status === 'failed') {
      result[dataQualityDimension].failed += count;
    } else if (status === 'aborted') {
      result[dataQualityDimension].aborted += count;
    }

    result[dataQualityDimension].total += count;
  });

  return Object.values(result);
};

export const transformToTestCaseStatusObject = (
  data: DataQualityReport['data']
) => {
  // Initialize output data with zeros
  const outputData = {
    success: 0,
    failed: 0,
    aborted: 0,
    total: 0,
  };

  // Use reduce to process input data and calculate the counts
  const updatedData = data.reduce((acc, item) => {
    const count = parseInt(item.document_count);
    const status = item['testCaseResult.testCaseStatus'];

    if (status === 'success') {
      acc.success += count;
    } else if (status === 'failed') {
      acc.failed += count;
    } else if (status === 'aborted') {
      acc.aborted += count;
    }

    acc.total += count; // Update total count

    return acc;
  }, outputData);

  return updatedData;
};

export const buildMustEsFilterForTags = (
  tags: string[],
  isTestCaseResult = false
) => {
  return {
    nested: {
      path: isTestCaseResult ? 'testCase.tags' : 'tags',
      query: {
        bool: {
          must: tags.map((tag) => ({
            match: {
              [isTestCaseResult ? 'testCase.tags.tagFQN' : 'tags.tagFQN']: tag,
            },
          })),
        },
      },
    },
  };
};

export const buildMustEsFilterForOwner = (
  ownerFqn: string,
  isTestCaseResult = false
) => {
  return {
    term: {
      [isTestCaseResult
        ? 'testCase.owners.fullyQualifiedName'
        : 'owners.fullyQualifiedName']: ownerFqn,
    },
  };
};
