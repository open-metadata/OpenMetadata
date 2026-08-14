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
import { omit } from 'lodash';
import { IncidentTimeMetricsType } from '../components/DataQuality/DataQuality.interface';
import { TestCaseStatus } from '../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../generated/tests/testCaseResolutionStatus';
import { DataQualityDashboardChartFilters } from '../pages/DataQuality/DataQualityPage.interface';
import {
  buildDataQualityDashboardFilters,
  buildDataQualityTableFilters,
  buildMustEsFilterForDataProducts,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
  buildMustEsFilterForTier,
} from '../utils/DataQuality/DataQualityPureUtils';
import { batchedDataQualityReport } from './dataQualityReportBatcher';
import { DataQualityReportParamsType, getDataQualityReport } from './testAPI';

export const fetchEntityCoveredWithDQ = (
  filters?: DataQualityDashboardChartFilters,
  unhealthy = false
) => {
  // The selected status filters test-case charts, but must not redefine the
  // Healthy (Success + Queued) and Unhealthy (Failed + Aborted) asset groups.
  const assetFilters = filters ? omit(filters, 'testCaseStatus') : undefined;
  const mustFilter = buildDataQualityDashboardFilters({
    filters: assetFilters,
    unhealthy,
  });

  return batchedDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
        },
      },
    }),
    index: 'testCase',
    aggregationQuery: `bucketName=entityWithTests:aggType=cardinality:field=originEntityFQN`,
    domain: filters?.domainFqn,
  });
};

export const fetchTotalEntityCount = (
  filters?: DataQualityDashboardChartFilters
) => {
  // The table index does not contain test-case-only fields such as entityLink,
  // result status, dimension, platform, or last-run timestamp.
  const mustFilter = buildDataQualityTableFilters(filters);

  return batchedDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: mustFilter,
        },
      },
    }),
    index: 'table',
    aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
    domain: filters?.domainFqn,
  });
};

export const fetchTestCaseSummary = (
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = buildDataQualityDashboardFilters({ filters });

  return batchedDataQualityReport({
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
    domain: filters?.domainFqn,
  });
};

export const fetchTestCaseSummaryByDimension = (
  filters?: DataQualityDashboardChartFilters
) => {
  const mustFilter = buildDataQualityDashboardFilters({ filters });

  return batchedDataQualityReport({
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
    domain: filters?.domainFqn,
  });
};

export const fetchTestCaseSummaryByNoDimension = (
  filters?: DataQualityDashboardChartFilters
) => {
  // Apply every active test-case filter except dimension, then select documents
  // where the dimension field is absent for the dedicated No Dimension card.
  const mustFilter = buildDataQualityDashboardFilters({
    filters: filters ? omit(filters, 'dataQualityDimension') : undefined,
  });

  return batchedDataQualityReport({
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
    domain: filters?.domainFqn,
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
  if (filters?.tags && filters.tags.length > 0) {
    mustFilter.push(buildMustEsFilterForTags(filters.tags, true));
  }
  if (filters?.tier && filters.tier.length > 0) {
    mustFilter.push(buildMustEsFilterForTier(filters.tier, true));
  }
  if (filters?.dataProductFqns && filters.dataProductFqns.length > 0) {
    mustFilter.push(
      buildMustEsFilterForDataProducts(filters.dataProductFqns, 'testCase.')
    );
  }

  return batchedDataQualityReport({
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
    domain: filters?.domainFqn,
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
  if (filters?.tags && filters.tags.length > 0) {
    mustFilter.push(buildMustEsFilterForTags(filters.tags, true));
  }
  if (filters?.tier && filters.tier.length > 0) {
    mustFilter.push(buildMustEsFilterForTier(filters.tier, true));
  }
  if (filters?.dataProductFqns && filters.dataProductFqns.length > 0) {
    mustFilter.push(
      buildMustEsFilterForDataProducts(filters.dataProductFqns, 'testCase.')
    );
  }

  return batchedDataQualityReport({
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
    domain: filters?.domainFqn,
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
  if (filters?.tags && filters.tags.length > 0) {
    mustFilter.push(buildMustEsFilterForTags(filters.tags, true));
  }
  if (filters?.tier && filters.tier.length > 0) {
    mustFilter.push(buildMustEsFilterForTier(filters.tier, true));
  }
  if (filters?.dataProductFqns && filters.dataProductFqns.length > 0) {
    mustFilter.push(
      buildMustEsFilterForDataProducts(filters.dataProductFqns, 'testCase.')
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

  return batchedDataQualityReport({
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
    domain: filters?.domainFqn,
  });
};

export const fetchTestCaseResultByTestSuiteId = (
  testSuiteId: string,
  status?: TestCaseStatus
) => {
  const params: DataQualityReportParamsType = {
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'testSuites',
                      query: {
                        term: {
                          'testSuites.id': testSuiteId,
                        },
                      },
                    },
                  },
                  {
                    term: {
                      'testSuite.id': testSuiteId,
                    },
                  },
                ],
              },
            },
            {
              term: {
                deleted: false,
              },
            },
            ...(status
              ? [
                  {
                    term: {
                      'testCaseResult.testCaseStatus': status,
                    },
                  },
                ]
              : []),
          ],
        },
      },
    }),
    aggregationQuery:
      'bucketName=entityLinks:aggType=terms:field=entityFQN,bucketName=status_counts:aggType=terms:field=testCaseResult.testCaseStatus',
    index: 'testCase',
  };

  return getDataQualityReport(params);
};
