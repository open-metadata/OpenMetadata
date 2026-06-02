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
export {
  aggregateTestResultsByEntity,
  buildMustEsFilterForDataProducts,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
  buildMustEsFilterForTier,
  buildTestCaseParams,
  calculateTestCaseStatusCounts,
  COLUMN_AGGREGATE_FIELD,
  convertSearchSourceToTable,
  createTestCaseParameters,
  filterTestCasesByTableAndColumn,
  getColumnFilterEntityLink,
  getColumnNameFromColumnFilterKey,
  getDimensionIcon,
  getEntityLinkForColumnFilter,
  getServiceTypeForTestDefinition,
  transformToTestCaseStatusObject,
} from './DataQualityPureUtils';

import { t } from 'i18next';
import { cloneDeep, isUndefined, omit, omitBy, parseInt } from 'lodash';
import QueryString from 'qs';
import { ReactComponent as ColumnIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table-test.svg';
import { SelectionOption } from '../../components/common/SelectionCardGroup/SelectionCardGroup.interface';
import { StatusData } from '../../components/DataQuality/ChartWidgets/StatusCardWidget/StatusCardWidget.interface';
import { TestCaseSearchParams } from '../../components/DataQuality/DataQuality.interface';
import { SearchDropdownOption } from '../../components/SearchDropdown/SearchDropdown.interface';
import { TEXT_GREY_MUTED } from '../../constants/constants';
import { DEFAULT_DIMENSIONS_DATA } from '../../constants/DataQuality.constants';
import { TestCaseType } from '../../enums/TestSuite.enum';
import { TestCaseStatus } from '../../generated/entity/feed/testCaseResult';
import { DataQualityReport } from '../../generated/tests/dataQualityReport';
import { TestCase } from '../../generated/tests/testCase';
import { DataQualityDimensions } from '../../generated/tests/testDefinition';
import {
  DataQualityDashboardChartFilters,
  DataQualityPageTabs,
} from '../../pages/DataQuality/DataQualityPage.interface';
import { getColumnNameFromEntityLink } from '../EntityLinkUtils';
import { getEntityFQN } from '../FeedUtils';
import { getDataQualityPagePath } from '../RouterUtils';
import { generateEntityLink } from '../TableUtils';
import {
  buildMustEsFilterForDataProducts,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
  buildMustEsFilterForTier,
  buildTestCaseParams,
} from './DataQualityPureUtils';

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

export const buildDataQualityDashboardFilters = (data: {
  filters?: DataQualityDashboardChartFilters;
  unhealthy?: boolean;
  isTableApi?: boolean;
}) => {
  const { filters, unhealthy = false, isTableApi = false } = data;
  const mustFilter = [];

  if (unhealthy) {
    mustFilter.push({
      terms: {
        'testCaseStatus.keyword': ['Failed', 'Aborted'],
      },
    });
  }

  if (filters?.ownerFqn) {
    mustFilter.push(buildMustEsFilterForOwner(filters.ownerFqn));
  }

  if (filters?.tags && isTableApi) {
    mustFilter.push({
      bool: {
        should: filters.tags.map((tag) => ({
          term: {
            'tags.tagFQN': tag,
          },
        })),
      },
    });
  }

  if (filters?.tier && isTableApi) {
    mustFilter.push({
      bool: {
        should: filters.tier.map((tag) => ({
          term: {
            'tier.tagFQN': tag,
          },
        })),
      },
    });
  }

  if (filters?.certification) {
    mustFilter.push({
      bool: {
        should: filters.certification.map((fqn) => ({
          term: { 'certification.tagLabel.tagFQN': fqn },
        })),
      },
    });
  }

  if (filters?.tags && filters.tags.length > 0 && !isTableApi) {
    mustFilter.push(buildMustEsFilterForTags(filters.tags));
  }

  if (filters?.tier && filters.tier.length > 0 && !isTableApi) {
    mustFilter.push(buildMustEsFilterForTier(filters.tier));
  }

  if (filters?.dataProductFqns && filters.dataProductFqns.length > 0) {
    mustFilter.push(buildMustEsFilterForDataProducts(filters.dataProductFqns));
  }

  if (filters?.entityFQN) {
    mustFilter.push({
      term: {
        [isTableApi ? 'fullyQualifiedName.keyword' : 'originEntityFQN']:
          filters.entityFQN,
      },
    });
  }

  if (filters?.serviceName) {
    mustFilter.push({
      term: {
        'service.name.keyword': filters.serviceName,
      },
    });
  }

  if (filters?.testPlatforms) {
    mustFilter.push({
      terms: {
        testPlatforms: filters.testPlatforms,
      },
    });
  }

  if (filters?.dataQualityDimension) {
    mustFilter.push({
      term: {
        dataQualityDimension: filters.dataQualityDimension,
      },
    });
  }

  if (filters?.testCaseStatus) {
    mustFilter.push({
      term: {
        'testCaseResult.testCaseStatus': filters.testCaseStatus,
      },
    });
  }

  if (filters?.testCaseType) {
    if (filters.testCaseType === TestCaseType.table) {
      mustFilter.push({
        bool: { must_not: [{ regexp: { entityLink: '.*::columns::.*' } }] },
      });
    }

    if (filters.testCaseType === TestCaseType.column) {
      mustFilter.push({ regexp: { entityLink: '.*::columns::.*' } });
    }
  }

  if (filters?.startTs && filters?.endTs && !isTableApi) {
    mustFilter.push({
      range: {
        'testCaseResult.timestamp': {
          gte: filters.startTs,
          lte: filters.endTs,
        },
      },
    });
  }

  mustFilter.push({
    term: {
      deleted: false,
    },
  });

  return mustFilter;
};

export const TEST_LEVEL_OPTIONS: SelectionOption[] = [
  {
    value: TestCaseType.table,
    label: t('label.table-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.table-lowercase'),
    }),
    icon: <TableIcon />,
  },
  {
    value: TestCaseType.column,
    label: t('label.column-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.column-lowercase'),
    }),
    icon: <ColumnIcon />,
  },
];

export function getColumnFilterOptions(
  items: TestCase[]
): SearchDropdownOption[] {
  const withColumn = items.filter((tc) =>
    tc.entityLink?.includes('::columns::')
  );
  const pairs = withColumn.map((tc) => {
    const tableFqn = getEntityFQN(tc.entityLink);
    const colName = getColumnNameFromEntityLink(tc.entityLink);

    return {
      key: `${tableFqn}::${colName ?? ''}`,
      label: colName ?? '--',
    };
  });
  const seen = new Set<string>();

  return pairs.filter((p) => {
    if (seen.has(p.key)) {
      return false;
    }

    seen.add(p.key);

    return true;
  });
}

export function getSelectedOptionsFromKeys(
  keys: string[],
  options: SearchDropdownOption[],
  getDefaultLabel: (key: string) => string
): SearchDropdownOption[] {
  return keys.map((key) => {
    const opt = options.find((o) => o.key === key);

    return opt ?? { key, label: getDefaultLabel(key) };
  });
}

export function parseColumnAggregateBuckets(
  buckets: { key?: string }[],
  tableFqn?: string
): SearchDropdownOption[] {
  const seen = new Set<string>();

  return (buckets ?? []).reduce<SearchDropdownOption[]>((acc, b) => {
    const colKey = b.key ?? '';
    const key = tableFqn ? `${tableFqn}::${colKey}` : colKey;
    if (!key || seen.has(key)) {
      return acc;
    }
    seen.add(key);
    acc.push({ key, label: colKey });

    return acc;
  }, []);
}

/** Returns path and search for navigating to the Test Cases tab with a status filter. */
export const getTestCaseTabPath = (testCaseStatus: TestCaseStatus) => ({
  pathname: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
  search: QueryString.stringify({ testCaseStatus }),
});

export const transformToTestCaseStatusByDimension = (
  inputData: DataQualityReport['data']
): StatusData[] => {
  const result: { [key: string]: StatusData } = cloneDeep(
    DEFAULT_DIMENSIONS_DATA
  );

  inputData.forEach((item) => {
    const {
      document_count,
      'testCaseResult.testCaseStatus': status,
      dataQualityDimension = DataQualityDimensions.NoDimension,
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

export const getPieChartLabel = (label: string, value = 0) => {
  return (
    <>
      <text
        dy={8}
        fill="#1D2939"
        fontSize={20}
        fontWeight={600}
        textAnchor="middle"
        x="50%"
        y="56%">
        {value}
      </text>
      <text
        dy={8}
        fill={TEXT_GREY_MUTED}
        fontSize={12}
        fontWeight={500}
        textAnchor="middle"
        x="50%"
        y="44%">
        {label}
      </text>
    </>
  );
};
