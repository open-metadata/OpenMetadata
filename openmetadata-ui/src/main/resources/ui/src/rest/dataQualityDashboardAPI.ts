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
import { getDataQualityReport } from './testAPI';

export const fetchEntityCoveredWithDQ = (unhealthy = false) => {
  return getDataQualityReport({
    ...(unhealthy
      ? {
          q: JSON.stringify({
            query: {
              bool: {
                must: [
                  {
                    terms: {
                      'testCaseStatus.keyword': ['Failed', 'Aborted'],
                    },
                  },
                ],
              },
            },
          }),
        }
      : {}),
    index: 'testCase',
    aggregationQuery: `bucketName=entityWithTests:aggType=cardinality:field=originEntityFQN`,
  });
};

export const fetchTotalEntityCount = () => {
  return getDataQualityReport({
    index: 'table',
    aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
  });
};

export const fetchTestCaseSummary = () => {
  return getDataQualityReport({
    index: 'testCase',
    aggregationQuery:
      'bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
  });
};

export const fetchTestCaseSummaryByDimension = () => {
  return getDataQualityReport({
    index: 'testCase',
    aggregationQuery:
      'bucketName=dimension:aggType=terms:field=dataQualityDimension,bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
  });
};

export const fetchCountOfIncidentStatusTypeByDays = (
  status: TestCaseResolutionStatusTypes
) => {
  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            { term: { testCaseResolutionStatusType: status } },
            {
              range: {
                // Todo: Update the timestamp range
                timestamp: {
                  lte: 1729148365000,
                  gte: 1727784000000,
                },
              },
            },
          ],
        },
      },
    }),
    index: 'testCaseResolutionStatus',
    aggregationQuery:
      'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=stateId',
  });
};

export const fetchIncidentTimeMetrics = (type: IncidentTimeMetricsType) => {
  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            {
              range: {
                // Todo: Update the timestamp range
                timestamp: {
                  lte: 1729148365000,
                  gte: 1727784000000,
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
          ],
        },
      },
    }),
    index: 'testCaseResolutionStatus',
    aggregationQuery:
      'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=metrics:aggType=nested:path=metrics,bucketName=byName:aggType=terms:field=metrics.name.keyword,bucketName=avgValue:aggType=avg:field=metrics.value',
  });
};

export const fetchTestCaseStatusMetricsByDays = (status: TestCaseStatus) => {
  return getDataQualityReport({
    q: JSON.stringify({
      query: {
        bool: {
          must: [
            { term: { testCaseStatus: status } },
            {
              range: {
                // Todo: Update the timestamp range
                timestamp: {
                  lte: 1729148365000,
                  gte: 1727784000000,
                },
              },
            },
          ],
        },
      },
    }),
    index: 'testCaseResult',
    aggregationQuery:
      'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=testCase.fullyQualifiedName',
  });
};
