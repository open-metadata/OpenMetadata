/* eslint-disable max-len */
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
import { IncidentTimeMetricsType } from '../components/DataQuality/DataQuality.interface';
import { TestCaseStatus } from '../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../generated/tests/testCaseResolutionStatus';
import { DataQualityDashboardChartFilters } from '../pages/DataQuality/DataQualityPage.interface';
import {
  buildDataQualityDashboardFilters,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
} from '../utils/DataQuality/DataQualityUtils';
import { getDataQualityReport } from './testAPI';

export const fetchEntityCoveredWithDQ = (
  filters?: DataQualityDashboardChartFilters,
  unhealthy = false
) => {
  const mustFilter = buildDataQualityDashboardFilters({ filters, unhealthy });

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
        },
      },
    }),
    index: 'testCase',
    aggregationQuery: `bucketName=entityWithTests:aggType=cardinality:field=originEntityFQN`,
  });
};

export const fetchTotalEntityCount = (
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = buildDataQualityDashboardFilters({
    filters,
    isTableApi: true,
  });

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
        },
      },
    }),
    index: 'table',
    aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
  });
};

export const fetchTestCaseSummary = (
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = buildDataQualityDashboardFilters({ filters });

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
        },
      },
    }),
    index: 'testCase',
    aggregationQuery:
      'bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
  });
};

export const fetchTestCaseSummaryByDimension = (
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = buildDataQualityDashboardFilters({ filters });

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
        },
      },
    }),
    index: 'testCase',
    aggregationQuery:
      'bucketName=dimension:aggType=terms:field=dataQualityDimension,bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
  });
};

export const fetchTestCaseSummaryByNoDimension = (
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = [];
  if (filters?.ownerFqn) {
    mustFilter.push(buildMustEsFilterForOwner(filters.ownerFqn));
  }
  if (filters?.tags || filters?.tier) {
    mustFilter.push(
      buildMustEsFilterForTags([
        ...(filters?.tags ?? []),
        ...(filters?.tier ?? []),
      ])
    );
  }

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
          must_not: [{ exists: { field: 'dataQualityDimension' } }],
        },
      },
    }),
    index: 'testCase',
    aggregationQuery:
      'bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
  });
};

export const fetchCountOfIncidentStatusTypeByDays = (
  status: TestCaseResolutionStatusTypes,
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = [];
  if (filters?.ownerFqn) {
    mustFilter.push(buildMustEsFilterForOwner(filters.ownerFqn, true));
  }
  if (filters?.tags || filters?.tier) {
    mustFilter.push(
      buildMustEsFilterForTags(
        [...(filters?.tags ?? []), ...(filters?.tier ?? [])],
        true
      )
    );
  }

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            { term: { testCaseResolutionStatusType: status } },
            {
              range: {
                timestamp: {
                  lte: filters?.endTs,
                  gte: filters?.startTs,
                },
              },
            },
            ...mustFilter,
          ],
        },
      },
    }),
    index: 'testCaseResolutionStatus',
    aggregationQuery:
      'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=stateId',
  });
};

export const fetchIncidentTimeMetrics = (
  type: IncidentTimeMetricsType,
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = [];
  if (filters?.ownerFqn) {
    mustFilter.push(buildMustEsFilterForOwner(filters.ownerFqn, true));
  }
  if (filters?.tags || filters?.tier) {
    mustFilter.push(
      buildMustEsFilterForTags(
        [...(filters?.tags ?? []), ...(filters?.tier ?? [])],
        true
      )
    );
  }

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            {
              range: {
                timestamp: {
                  lte: filters?.endTs,
                  gte: filters?.startTs,
                },
              },
            },
            {
              nested: {
                path: 'metrics',
                query: {
                  bool: {
                    must: [{ match: { 'metrics.name.keyword': type } }],
                  },
                },
              },
            },
            ...mustFilter,
          ],
        },
      },
    }),
    index: 'testCaseResolutionStatus',
    aggregationQuery:
      'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=metrics:aggType=nested:path=metrics,bucketName=byName:aggType=terms:field=metrics.name.keyword,bucketName=avgValue:aggType=avg:field=metrics.value',
  });
};

export const fetchTestCaseStatusMetricsByDays = (
  status: TestCaseStatus,
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = [];
  if (filters?.ownerFqn) {
    mustFilter.push(buildMustEsFilterForOwner(filters.ownerFqn, true));
  }
  if (filters?.tags || filters?.tier) {
    mustFilter.push(
      buildMustEsFilterForTags(
        [...(filters?.tags ?? []), ...(filters?.tier ?? [])],
        true
      )
    );
  }
  if (filters?.entityFQN) {
    mustFilter.push({
      term: {
        [filters.entityType
          ? `${filters.entityType}.fullyQualifiedName.keyword`
          : 'testCase.entityFQN']: filters.entityFQN,
      },
    });
  }

  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            { term: { testCaseStatus: status } },
            {
              range: {
                timestamp: {
                  lte: filters?.endTs,
                  gte: filters?.startTs,
                },
              },
            },
            ...mustFilter,
          ],
        },
      },
    }),
    index: 'testCaseResult',
    aggregationQuery:
      'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=testCase.fullyQualifiedName',
  });
};
