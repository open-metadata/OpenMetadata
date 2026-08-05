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
  buildMustEsFilterForTier,
} from '../utils/DataQuality/DataQualityPureUtils';
import {
  fetchCountOfIncidentStatusTypeByDays,
  fetchEntityCoveredWithDQ,
  fetchIncidentTimeMetrics,
  fetchTestCaseStatusMetricsByDays,
  fetchTestCaseSummary,
  fetchTestCaseSummaryByDimension,
  fetchTestCaseSummaryByNoDimension,
  fetchTotalEntityCount,
} from './dataQualityDashboardAPI';
import { batchedDataQualityReport } from './dataQualityReportBatcher';

const SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER =
  'should call getDataQualityReport with correct query when ownerFqn is provided';
const SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_2 =
  'should call getDataQualityReport with correct query when all filters are provided';
const SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_3 =
  'should call getDataQualityReport with correct query when no filters are provided';
const TIER_TIER1 = 'Tier.Tier1';
const BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME =
  'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=stateId';
const SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_4 =
  'should call getDataQualityReport with correct query when tags and tier are provided';
const SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_5 =
  'should call getDataQualityReport with correct query when date range is provided';
const BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_2 =
  'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=metrics:aggType=nested:path=metrics,bucketName=byName:aggType=terms:field=metrics.name.keyword,bucketName=avgValue:aggType=avg:field=metrics.value';
const BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3 =
  'bucketName=byDay:aggType=date_histogram:field=timestamp&calendar_interval=day,bucketName=newIncidents:aggType=cardinality:field=testCase.fullyQualifiedName';
jest.mock('./testAPI', () => ({
  getDataQualityReport: jest.fn(),
}));

jest.mock('./dataQualityReportBatcher', () => ({
  batchedDataQualityReport: jest.fn(),
}));

jest.mock('../utils/DataQuality/DataQualityPureUtils', () => ({
  buildMustEsFilterForOwner: jest.fn(),
  buildMustEsFilterForTags: jest.fn(),
  buildMustEsFilterForTier: jest.fn(),
  buildDataQualityDashboardFilters: jest.fn().mockReturnValue([]),
  buildMustEsFilterForDataProducts: jest.fn(),
}));

describe('dataQualityDashboardAPI', () => {
  describe('fetchTotalEntityCount', () => {
    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER, async () => {
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
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_2, async () => {
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
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_3, async () => {
      await fetchTotalEntityCount();

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
      it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER, async () => {
        const filters = { ownerFqn: testCaseData.filters.ownerFqn };
        (buildDataQualityDashboardFilters as jest.Mock).mockReturnValueOnce([
          testCaseData.ownerExpectedQuery,
        ]);

        await testData.func(filters);

        expect(buildDataQualityDashboardFilters).toHaveBeenCalledWith({
          filters,
          ...testData.params,
        });
        expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        expect(batchedDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test3.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });

      it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_2, async () => {
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

        expect(batchedDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test4.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });

      it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_3, async () => {
        await testData.func();

        expect(batchedDataQualityReport).toHaveBeenCalledWith({
          q: testCaseData.test5.q,
          index: testData.index,
          aggregationQuery: testData.aggregationQuery,
        });
      });
    });
  });

  describe('fetchTestCaseSummaryByNoDimension', () => {
    const aggregationQuery =
      'bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus';
    const index = 'testCase';

    it('should call getDataQualityReport with no filters', async () => {
      await fetchTestCaseSummaryByNoDimension();

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [],
              must_not: [{ exists: { field: 'dataQualityDimension' } }],
            },
          },
        }),
        index,
        aggregationQuery,
        domain: undefined,
      });
    });

    it('should call getDataQualityReport with ownerFqn filter', async () => {
      const ownerFilter = {
        nested: {
          path: 'owners',
          query: { term: { 'owners.name': 'owner1' } },
        },
      };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(ownerFilter);

      await fetchTestCaseSummaryByNoDimension({ ownerFqn: 'owner1' });

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1');
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [ownerFilter],
              must_not: [{ exists: { field: 'dataQualityDimension' } }],
            },
          },
        }),
        index,
        aggregationQuery,
        domain: undefined,
      });
    });

    it('should call getDataQualityReport with tags filter using buildMustEsFilterForTags', async () => {
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              should: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tag2' } },
              ],
            },
          },
        },
      };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);

      await fetchTestCaseSummaryByNoDimension({ tags: ['tag1', 'tag2'] });

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1', 'tag2']);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [tagsFilter],
              must_not: [{ exists: { field: 'dataQualityDimension' } }],
            },
          },
        }),
        index,
        aggregationQuery,
        domain: undefined,
      });
    });

    it('should call getDataQualityReport with tier filter using buildMustEsFilterForTier (not tags)', async () => {
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': TIER_TIER1 } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchTestCaseSummaryByNoDimension({ tier: [TIER_TIER1] });

      expect(buildMustEsFilterForTier).toHaveBeenCalledWith([TIER_TIER1]);
      expect(buildMustEsFilterForTags).not.toHaveBeenCalled();
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [tierFilter],
              must_not: [{ exists: { field: 'dataQualityDimension' } }],
            },
          },
        }),
        index,
        aggregationQuery,
        domain: undefined,
      });
    });

    it('should call getDataQualityReport with separate tags and tier filters', async () => {
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              should: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': TIER_TIER1 } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchTestCaseSummaryByNoDimension({
        tags: ['tag1'],
        tier: [TIER_TIER1],
      });

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1']);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith([TIER_TIER1]);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
        q: JSON.stringify({
          query: {
            bool: {
              must: [tagsFilter, tierFilter],
              must_not: [{ exists: { field: 'dataQualityDimension' } }],
            },
          },
        }),
        index,
        aggregationQuery,
        domain: undefined,
      });
    });

    it('should not add tags filter when tags array is empty', async () => {
      await fetchTestCaseSummaryByNoDimension({ tags: [] });

      expect(buildMustEsFilterForTags).not.toHaveBeenCalled();
      expect(batchedDataQualityReport).toHaveBeenCalledWith(
        expect.objectContaining({
          q: JSON.stringify({
            query: {
              bool: {
                must: [],
                must_not: [{ exists: { field: 'dataQualityDimension' } }],
              },
            },
          }),
        })
      );
    });

    it('should not add tier filter when tier array is empty', async () => {
      await fetchTestCaseSummaryByNoDimension({ tier: [] });

      expect(buildMustEsFilterForTier).not.toHaveBeenCalled();
      expect(batchedDataQualityReport).toHaveBeenCalledWith(
        expect.objectContaining({
          q: JSON.stringify({
            query: {
              bool: {
                must: [],
                must_not: [{ exists: { field: 'dataQualityDimension' } }],
              },
            },
          }),
        })
      );
    });
  });

  describe('fetchCountOfIncidentStatusTypeByDays', () => {
    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_3, async () => {
      const status = TestCaseResolutionStatusTypes.ACK;

      await fetchCountOfIncidentStatusTypeByDays(status);

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER, async () => {
      const status = TestCaseResolutionStatusTypes.Assigned;
      const filters = { ownerFqn: 'owner1' };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce({
        term: {
          'owners.fullyQualifiedName': 'owner1',
        },
      });

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_4, async () => {
      const status = TestCaseResolutionStatusTypes.New;
      const filters = { tags: ['tag1'], tier: ['tier1'] };
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1'], true);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith(['tier1'], true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
                tagsFilter,
                tierFilter,
              ],
            },
          },
        }),
        index: 'testCaseResolutionStatus',
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_2, async () => {
      const status = TestCaseResolutionStatusTypes.Resolved;
      const filters = { ownerFqn: 'owner1', tags: ['tag1'], tier: ['tier1'] };
      const ownerFilter = {
        term: {
          'owners.fullyQualifiedName': 'owner1',
        },
      };
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(ownerFilter);
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1'], true);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith(['tier1'], true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
                ownerFilter,
                tagsFilter,
                tierFilter,
              ],
            },
          },
        }),
        index: 'testCaseResolutionStatus',
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_5, async () => {
      const status = TestCaseResolutionStatusTypes.Resolved;
      const filters = { startTs: 1729073964962, endTs: 1729678764965 };

      await fetchCountOfIncidentStatusTypeByDays(status, filters);

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME,
      });
    });
  });

  describe('fetchIncidentTimeMetrics', () => {
    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_3, async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;

      await fetchIncidentTimeMetrics(type);

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_2,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER, async () => {
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
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_2,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_4, async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;
      const filters = {
        tags: ['tag1'],
        tier: ['tier1'],
        startTs: 1729073964962,
        endTs: 1729678764965,
      };
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchIncidentTimeMetrics(type, filters);

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1'], true);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith(['tier1'], true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
                tagsFilter,
                tierFilter,
              ],
            },
          },
        }),
        index: 'testCaseResolutionStatus',
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_2,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_2, async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;
      const filters = {
        ownerFqn: testCaseData.filters.ownerFqn,
        tags: ['tag1'],
        tier: ['tier1'],
        startTs: 1729073964962,
        endTs: 1729678764965,
      };
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(
        testCaseData.ownerExpectedQuery
      );
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchIncidentTimeMetrics(type, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1'], true);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith(['tier1'], true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
                testCaseData.ownerExpectedQuery,
                tagsFilter,
                tierFilter,
              ],
            },
          },
        }),
        index: 'testCaseResolutionStatus',
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_2,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_5, async () => {
      const type = IncidentTimeMetricsType.TIME_TO_RESOLUTION;
      const filters = { startTs: 1729073964962, endTs: 1729678764965 };

      await fetchIncidentTimeMetrics(type, filters);

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_2,
      });
    });
  });

  describe('fetchTestCaseStatusMetricsByDays', () => {
    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_3, async () => {
      const status = TestCaseStatus.Success;

      await fetchTestCaseStatusMetricsByDays(status);

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER, async () => {
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
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_4, async () => {
      const status = TestCaseStatus.Aborted;
      const filters = { tags: ['tag1'], tier: ['tier1'] };
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1'], true);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith(['tier1'], true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
                tagsFilter,
                tierFilter,
              ],
            },
          },
        }),
        index: 'testCaseResult',
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_2, async () => {
      const status = TestCaseStatus.Failed;
      const filters = { ownerFqn: 'owner1', tags: ['tag1'], tier: ['tier1'] };
      const ownerFilter = {
        term: {
          'owners.fullyQualifiedName': 'owner1',
        },
      };
      const tagsFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              must: [{ match: { 'tags.tagFQN': 'tag1' } }],
            },
          },
        },
      };
      const tierFilter = {
        bool: {
          should: [{ term: { 'tier.tagFQN': 'tier1' } }],
          minimum_should_match: 1,
        },
      };
      (buildMustEsFilterForOwner as jest.Mock).mockReturnValueOnce(ownerFilter);
      (buildMustEsFilterForTags as jest.Mock).mockReturnValueOnce(tagsFilter);
      (buildMustEsFilterForTier as jest.Mock).mockReturnValueOnce(tierFilter);

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(buildMustEsFilterForOwner).toHaveBeenCalledWith('owner1', true);
      expect(buildMustEsFilterForTags).toHaveBeenCalledWith(['tag1'], true);
      expect(buildMustEsFilterForTier).toHaveBeenCalledWith(['tier1'], true);
      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
                ownerFilter,
                tagsFilter,
                tierFilter,
              ],
            },
          },
        }),
        index: 'testCaseResult',
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
      });
    });

    it(SHOULD_CALL_GETDATAQUALITYREPORT_WITH_CORRECT_QUER_5, async () => {
      const status = TestCaseStatus.Success;
      const filters = { startTs: 1729073964962, endTs: 1729678764965 };

      await fetchTestCaseStatusMetricsByDays(status, filters);

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
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

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
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

      expect(batchedDataQualityReport).toHaveBeenCalledWith({
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
        aggregationQuery: BUCKETNAME_BYDAY_AGGTYPE_DATE_HISTOGRAM_FIELD_TIME_3,
      });
    });
  });
});
