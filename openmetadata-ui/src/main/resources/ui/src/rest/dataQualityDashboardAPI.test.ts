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
/* eslint-disable max-len */
import { IncidentTimeMetricsType } from '../components/DataQuality/DataQuality.interface';
import { EntityType } from '../enums/entity.enum';
import { TestCaseStatus } from '../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../generated/tests/testCaseResolutionStatus';
import {
  buildDataQualityDashboardFilters,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
} from '../utils/DataQuality/DataQualityUtils';
import {
  fetchCountOfIncidentStatusTypeByDays,
  fetchEntityCoveredWithDQ,
  fetchIncidentTimeMetrics,
  fetchTestCaseStatusMetricsByDays,
  fetchTestCaseSummary,
  fetchTestCaseSummaryByDimension,
  fetchTotalEntityCount,
} from './dataQualityDashboardAPI';
import { getDataQualityReport } from './testAPI';

jest.mock('./testAPI', () => ({
  getDataQualityReport: jest.fn(),
}));

jest.mock('../utils/DataQuality/DataQualityUtils', () => ({
  buildMustEsFilterForOwner: jest.fn(),
  buildMustEsFilterForTags: jest.fn(),
  buildDataQualityDashboardFilters: jest.fn().mockReturnValue([]),
}));

describe('dataQualityDashboardAPI', () => {
  describe('fetchTotalEntityCount', () => {
    it('should call getDataQualityReport with correct query when ownerFqn is provided', async () => {
      const filters = { ownerFqn: 'owner1' };
      (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
        {
          term: {
            'owners.fullyQualifiedName': 'owner1',
          },
        },
      ]);

      await fetchTotalEntityCount(filters);

      expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
        filters: { ownerFqn: 'owner1' },
        isTableApi: true,
      });
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
                  },
                },
              ],
            },
          },
        }),
        index: 'table',
        aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
      });
    });

    it('should call getDataQualityReport with correct query when tags are provided', async () => {
      const filters = { tags: ['tag1', 'tag2'] };
      (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
        {
          bool: {
            should: [
              { term: { 'tags.tagFQN': 'tag1' } },
              { term: { 'tags.tagFQN': 'tag2' } },
            ],
          },
        },
      ]);

      await fetchTotalEntityCount(filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: [
                      { term: { 'tags.tagFQN': 'tag1' } },
                      { term: { 'tags.tagFQN': 'tag2' } },
                    ],
                  },
                },
              ],
            },
          },
        }),
        index: 'table',
        aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
      });
    });

    it('should call getDataQualityReport with correct query when tier is provided', async () => {
      const filters = { tier: ['tier1', 'tier2'] };
      (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
        {
          bool: {
            should: [
              { term: { 'tier.tagFQN': 'tier1' } },
              { term: { 'tier.tagFQN': 'tier2' } },
            ],
          },
        },
      ]);

      await fetchTotalEntityCount(filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: [
                      { term: { 'tier.tagFQN': 'tier1' } },
                      { term: { 'tier.tagFQN': 'tier2' } },
                    ],
                  },
                },
              ],
            },
          },
        }),
        index: 'table',
        aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
      });
    });

    it('should call getDataQualityReport with correct query when all filters are provided', async () => {
      const filters = { ownerFqn: 'owner1', tags: ['tag1'], tier: ['tier1'] };
      (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
        {
          term: {
            'owners.fullyQualifiedName': 'owner1',
          },
        },
        {
          bool: {
            should: [{ term: { 'tags.tagFQN': 'tag1' } }],
          },
        },
        {
          bool: {
            should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          },
        },
      ]);

      await fetchTotalEntityCount(filters);

      expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
        filters: { ownerFqn: 'owner1', tags: ['tag1'], tier: ['tier1'] },
        isTableApi: true,
      });
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
                  },
                },
                {
                  bool: {
                    should: [{ term: { 'tags.tagFQN': 'tag1' } }],
                  },
                },
                {
                  bool: {
                    should: [{ term: { 'tier.tagFQN': 'tier1' } }],
                  },
                },
              ],
            },
          },
        }),
        index: 'table',
        aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
      });
    });

    it('should call getDataQualityReport with correct query when no filters are provided', async () => {
      await fetchTotalEntityCount();

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [],
            },
          },
        }),
        index: 'table',
        aggregationQuery: `bucketName=count:aggType=cardinality:field=fullyQualifiedName`,
      });
    });
  });

  const testCaseData = {
    filters: {
      ownerFqn: 'owner1',
      tags: ['tag1', 'tag2'],
      tier: ['tier1', 'tier2'],
    },
    ownerExpectedQuery: {
      term: {
        'owners.fullyQualifiedName': 'owner1',
      },
    },

    test1: {
      q: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  'owners.fullyQualifiedName': 'owner1',
                },
              },
            ],
          },
        },
      }),
    },
    test2: {
      expected: {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tag2' } },
              ],
            },
          },
        },
      },
      q: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                nested: {
                  path: 'tags',
                  query: {
                    bool: {
                      must: [
                        { match: { 'tags.tagFQN': 'tag1' } },
                        { match: { 'tags.tagFQN': 'tag2' } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    },
    test3: {
      expected: {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tier1' } },
                { match: { 'tags.tagFQN': 'tier2' } },
              ],
            },
          },
        },
      },
      q: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                nested: {
                  path: 'tags',
                  query: {
                    bool: {
                      must: [
                        { match: { 'tags.tagFQN': 'tier1' } },
                        { match: { 'tags.tagFQN': 'tier2' } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    },
    test4: {
      expected: {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tag2' } },
                { match: { 'tags.tagFQN': 'tier1' } },
                { match: { 'tags.tagFQN': 'tier2' } },
              ],
            },
          },
        },
      },
      q: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  'owners.fullyQualifiedName': 'owner1',
                },
              },
              {
                nested: {
                  path: 'tags',
                  query: {
                    bool: {
                      must: [
                        { match: { 'tags.tagFQN': 'tag1' } },
                        { match: { 'tags.tagFQN': 'tag2' } },
                        { match: { 'tags.tagFQN': 'tier1' } },
                        { match: { 'tags.tagFQN': 'tier2' } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    },
    test5: {
      q: JSON.stringify({
        query: {
          bool: {
            must: [],
          },
        },
      }),
    },
  };

  const testCases = [
    {
      functionName: 'fetchTestCaseSummary',
      func: fetchTestCaseSummary,
      index: 'testCase',
      aggregationQuery:
        'bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
    },
    {
      functionName: 'fetchEntityCoveredWithDQ',
      func: fetchEntityCoveredWithDQ,
      index: 'testCase',
      aggregationQuery: `bucketName=entityWithTests:aggType=cardinality:field=originEntityFQN`,
      params: {
        unhealthy: false,
      },
    },
    {
      functionName: 'fetchTestCaseSummaryByDimension',
      func: fetchTestCaseSummaryByDimension,
      index: 'testCase',
      aggregationQuery:
        'bucketName=dimension:aggType=terms:field=dataQualityDimension,bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus',
    },
  ];

  testCases.map((testData) => {
    describe(`${testData.functionName}`, () => {
      it('should call getDataQualityReport with correct query when ownerFqn is provided', async () => {
        const filters = { ownerFqn: testCaseData.filters.ownerFqn };
        (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
          testCaseData.ownerExpectedQuery,
        ]);

        await testData.func(filters);

        expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
          filters,
          ...testData.params,
        });
        expect(getDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test1.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });

      it('should call getDataQualityReport with correct query when tags are provided', async () => {
        const filters = { tags: testCaseData.filters.tags };
        (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
          testCaseData.test2.expected,
        ]);

        await testData.func(filters);

        expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
          filters,
          ...testData.params,
        });
        expect(getDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test2.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });

      it('should call getDataQualityReport with correct query when tier is provided', async () => {
        const filters = { tier: testCaseData.filters.tier };
        (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
          testCaseData.test3.expected,
        ]);

        await testData.func(filters);

        expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
          filters,
          ...testData.params,
        });
        expect(getDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test3.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });

      it('should call getDataQualityReport with correct query when all filters are provided', async () => {
        const filters = testCaseData.filters;

        (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
          testCaseData.ownerExpectedQuery,
          testCaseData.test4.expected,
        ]);

        await testData.func(filters);

        expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
          filters,
          ...testData.params,
        });

        expect(getDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test4.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });

      it('should call getDataQualityReport with correct query when no filters are provided', async () => {
        await testData.func();

        expect(getDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test5.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });
    });
  });

  describe('fetchCountOfIncidentStatusTypeByDays', () => {
    it('should call getDataQualityReport with correct query when no filters are provided', async () => {
      const status = TestCaseResolutionStatusTypes.ACK;

      await fetchCountOfIncidentStatusTypeByDays(status);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseResolutionStatusType: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
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
    });

    it('should call getDataQualityReport with correct query when ownerFqn is provided', async () => {
      const status = TestCaseResolutionStatusTypes.Assigned;
      const filters = { ownerFqn: 'owner1' };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce({
        term: {
          'owners.fullyQualifiedName': 'owner1',
        },
      });

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseResolutionStatusType: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
                    },
                  },
                },
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
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
    });

    it('should call getDataQualityReport with correct query when tags and tier are provided', async () => {
      const status = TestCaseResolutionStatusTypes.New;
      const filters = { tags: ['tag1'], tier: ['tier1'] };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce({
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tier1' } },
              ],
            },
          },
        },
      });

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(
        ['tag1', 'tier1'],
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseResolutionStatusType: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
                    },
                  },
                },
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        must: [
                          { match: { 'tags.tagFQN': 'tag1' } },
                          { match: { 'tags.tagFQN': 'tier1' } },
                        ],
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
          'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=stateId',
      });
    });

    it('should call getDataQualityReport with correct query when all filters are provided', async () => {
      const status = TestCaseResolutionStatusTypes.Resolved;
      const filters = { ownerFqn: 'owner1', tags: ['tag1'], tier: ['tier1'] };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce({
        term: {
          'owners.fullyQualifiedName': 'owner1',
        },
      });
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce({
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tier1' } },
              ],
            },
          },
        },
      });

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(
        ['tag1', 'tier1'],
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseResolutionStatusType: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
                    },
                  },
                },
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
                  },
                },
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        must: [
                          { match: { 'tags.tagFQN': 'tag1' } },
                          { match: { 'tags.tagFQN': 'tier1' } },
                        ],
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
          'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=stateId',
      });
    });

    it('should call getDataQualityReport with correct query when date range is provided', async () => {
      const status = TestCaseResolutionStatusTypes.Resolved;
      const filters = { startTs: 1729073964962, endTs: 1729678764965 };

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseResolutionStatusType: status } },
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
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
    });
  });

  describe('fetchIncidentTimeMetrics', () => {
    it('should call getDataQualityReport with correct query when no filters are provided', async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;

      await fetchIncidentTimeMetrics(type);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
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
    });

    it('should call getDataQualityReport with correct query when ownerFqn is provided', async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESPONSE;
      const filters = {
        ownerFqn: testCaseData.filters.ownerFqn,
        startTs: 1729073964962,
        endTs: 1729678764965,
      };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(
        testCaseData.ownerExpectedQuery
      );

      await fetchIncidentTimeMetrics(type, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith(
        testCaseData.filters.ownerFqn,
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
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
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
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
    });

    it('should call getDataQualityReport with correct query when tags and tier are provided', async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;
      const filters = {
        tags: ['tag1'],
        tier: ['tier1'],
        startTs: 1729073964962,
        endTs: 1729678764965,
      };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce({
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tier1' } },
              ],
            },
          },
        },
      });

      await fetchIncidentTimeMetrics(type, filters);

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(
        ['tag1', 'tier1'],
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
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
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        must: [
                          { match: { 'tags.tagFQN': 'tag1' } },
                          { match: { 'tags.tagFQN': 'tier1' } },
                        ],
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
    });

    it('should call getDataQualityReport with correct query when all filters are provided', async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;
      const filters = {
        ownerFqn: testCaseData.filters.ownerFqn,
        tags: ['tag1'],
        tier: ['tier1'],
        startTs: 1729073964962,
        endTs: 1729678764965,
      };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(
        testCaseData.ownerExpectedQuery
      );
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce({
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tier1' } },
              ],
            },
          },
        },
      });

      await fetchIncidentTimeMetrics(type, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(
        ['tag1', 'tier1'],
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
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
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
                  },
                },
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        must: [
                          { match: { 'tags.tagFQN': 'tag1' } },
                          { match: { 'tags.tagFQN': 'tier1' } },
                        ],
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
    });

    it('should call getDataQualityReport with correct query when date range is provided', async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;
      const filters = { startTs: 1729073964962, endTs: 1729678764965 };

      await fetchIncidentTimeMetrics(type, filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
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
    });
  });

  describe('fetchTestCaseStatusMetricsByDays', () => {
    it('should call getDataQualityReport with correct query when no filters are provided', async () => {
      const status = TestCaseStatus.Success;

      await fetchTestCaseStatusMetricsByDays(status);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
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
    });

    it('should call getDataQualityReport with correct query when ownerFqn is provided', async () => {
      const status = TestCaseStatus.Failed;
      const filters = { ownerFqn: testCaseData.filters.ownerFqn };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(
        testCaseData.ownerExpectedQuery
      );

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith(
        testCaseData.filters.ownerFqn,
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
                    },
                  },
                },
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
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
    });

    it('should call getDataQualityReport with correct query when tags and tier are provided', async () => {
      const status = TestCaseStatus.Aborted;
      const filters = { tags: ['tag1'], tier: ['tier1'] };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce({
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tier1' } },
              ],
            },
          },
        },
      });

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(
        ['tag1', 'tier1'],
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
                    },
                  },
                },
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        must: [
                          { match: { 'tags.tagFQN': 'tag1' } },
                          { match: { 'tags.tagFQN': 'tier1' } },
                        ],
                      },
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
    });

    it('should call getDataQualityReport with correct query when all filters are provided', async () => {
      const status = TestCaseStatus.Failed;
      const filters = { ownerFqn: 'owner1', tags: ['tag1'], tier: ['tier1'] };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce({
        term: {
          'owners.fullyQualifiedName': 'owner1',
        },
      });
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce({
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tier1' } },
              ],
            },
          },
        },
      });

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(
        ['tag1', 'tier1'],
        true
      );
      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: undefined,
                      gte: undefined,
                    },
                  },
                },
                {
                  term: {
                    'owners.fullyQualifiedName': 'owner1',
                  },
                },
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        must: [
                          { match: { 'tags.tagFQN': 'tag1' } },
                          { match: { 'tags.tagFQN': 'tier1' } },
                        ],
                      },
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
    });

    it('should call getDataQualityReport with correct query when date range is provided', async () => {
      const status = TestCaseStatus.Success;
      const filters = { startTs: 1729073964962, endTs: 1729678764965 };

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
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
    });

    it('should call getDataQualityReport with provided entityType', async () => {
      const status = TestCaseStatus.Success;
      const filters = {
        entityType: EntityType.TABLE,
        entityFQN: 'entityFQN',
        startTs: 1729073964962,
        endTs: 1729678764965,
      };

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
                    },
                  },
                },
                {
                  term: {
                    'table.fullyQualifiedName.keyword': 'entityFQN',
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
    });

    it('should call getDataQualityReport with normal entity fqn if entityType not provided', async () => {
      const status = TestCaseStatus.Success;
      const filters = {
        entityFQN: 'entityFQN',
        startTs: 1729073964962,
        endTs: 1729678764965,
      };

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(getDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [
                { term: { testCaseStatus: status } },
                {
                  range: {
                    timestamp: {
                      lte: filters.endTs,
                      gte: filters.startTs,
                    },
                  },
                },
                {
                  term: {
                    'testCase.entityFQN': 'entityFQN',
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
    });
  });
});
