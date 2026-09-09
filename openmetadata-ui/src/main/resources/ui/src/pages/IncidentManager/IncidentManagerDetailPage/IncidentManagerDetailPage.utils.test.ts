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

import type { TFunction } from 'i18next';
import {
  PipelineType,
  type IngestionPipeline,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import type { TestCase } from '../../../generated/tests/testCase';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getNextCronRunTimestamp } from '../../../utils/CronUtils';
import { TestCasePageTabs } from '../IncidentManager.interface';
import {
  fetchNextTestCaseRunTimestamp,
  getIncidentManagerPageTitle,
  getTestSuiteFqns,
  shouldFetchNextRun,
} from './IncidentManagerDetailPage.utils';

jest.mock('../../../rest/ingestionPipelineAPI');
jest.mock('../../../utils/CronUtils');

const mockGetIngestionPipelines = getIngestionPipelines as jest.MockedFunction<
  typeof getIngestionPipelines
>;
const mockGetNextCronRunTimestamp =
  getNextCronRunTimestamp as jest.MockedFunction<
    typeof getNextCronRunTimestamp
  >;
const BASIC_SUITE_FQN = 'sample_data.basic_suite';
const TEST_CASE = {
  displayName: 'Customer count check',
  entityLink: '<#E::table::sample_data.ecommerce_db.shopify.customer>',
  name: 'customer_count_check',
  testDefinition: {
    id: 'test-definition-id',
    type: 'testDefinition',
  },
  testSuite: {
    fullyQualifiedName: BASIC_SUITE_FQN,
    id: 'basic-suite-id',
    name: 'basic_suite',
    type: 'testSuite',
  },
  testSuites: [
    {
      fullyQualifiedName: 'sample_data.logical_suite',
      name: 'logical_suite',
    },
    {
      fullyQualifiedName: BASIC_SUITE_FQN,
      name: 'duplicate_basic_suite',
    },
    {
      name: 'name_only_suite',
    },
  ],
} satisfies TestCase;

describe('IncidentManagerDetailPage utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unique suite FQNs and falls back to suite names', () => {
    expect(getTestSuiteFqns(TEST_CASE)).toEqual([
      BASIC_SUITE_FQN,
      'sample_data.logical_suite',
      'name_only_suite',
    ]);
  });

  it('fetches enabled suite pipelines and returns the earliest next run', async () => {
    const firstPipeline = {
      airflowConfig: {
        pipelineTimezone: 'UTC',
        scheduleInterval: '0 8 * * *',
      },
      enabled: true,
    } as IngestionPipeline;
    const secondPipeline = {
      airflowConfig: {
        pipelineTimezone: 'Asia/Kolkata',
        scheduleInterval: '0 9 * * *',
      },
      enabled: true,
    } as IngestionPipeline;

    mockGetIngestionPipelines
      .mockResolvedValueOnce({
        data: [firstPipeline],
        paging: { total: 1 },
      })
      .mockResolvedValueOnce({
        data: [secondPipeline],
        paging: { total: 1 },
      });
    mockGetNextCronRunTimestamp
      .mockResolvedValueOnce(1_800_000_000_000)
      .mockResolvedValueOnce(1_700_000_000_000);

    await expect(
      fetchNextTestCaseRunTimestamp(['suite.one', 'suite.two'])
    ).resolves.toBe(1_700_000_000_000);
    expect(mockGetIngestionPipelines).toHaveBeenNthCalledWith(1, {
      arrQueryFields: ['airflowConfig'],
      limit: 100,
      pipelineType: [PipelineType.TestSuite],
      testSuite: 'suite.one',
    });
    expect(mockGetIngestionPipelines).toHaveBeenNthCalledWith(2, {
      arrQueryFields: ['airflowConfig'],
      limit: 100,
      pipelineType: [PipelineType.TestSuite],
      testSuite: 'suite.two',
    });
    expect(mockGetNextCronRunTimestamp).toHaveBeenNthCalledWith(
      1,
      '0 8 * * *',
      'UTC'
    );
    expect(mockGetNextCronRunTimestamp).toHaveBeenNthCalledWith(
      2,
      '0 9 * * *',
      'Asia/Kolkata'
    );
  });

  it('ignores paused, disabled, and unscheduled pipelines', async () => {
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        {
          airflowConfig: { scheduleInterval: '0 8 * * *' },
          enabled: false,
        },
        {
          airflowConfig: {
            pausePipeline: true,
            scheduleInterval: '0 9 * * *',
          },
          enabled: true,
        },
        {
          airflowConfig: {},
          enabled: true,
        },
      ] as IngestionPipeline[],
      paging: { total: 3 },
    });

    await expect(fetchNextTestCaseRunTimestamp(['suite.one'])).resolves.toBe(
      undefined
    );
    expect(mockGetNextCronRunTimestamp).not.toHaveBeenCalled();
  });

  it('fetches the next run only for the current results tab', () => {
    expect(
      shouldFetchNextRun({
        activeTab: TestCasePageTabs.TEST_CASE_RESULTS,
        dimensionKey: undefined,
        isVersionPage: false,
        testSuiteFqns: ['suite.one'],
      })
    ).toBe(true);
  });

  it.each([
    {
      activeTab: TestCasePageTabs.TEST_CASE_RESULTS,
      dimensionKey: undefined,
      isVersionPage: false,
      testSuiteFqns: [],
    },
    {
      activeTab: TestCasePageTabs.TEST_CASE_RESULTS,
      dimensionKey: undefined,
      isVersionPage: true,
      testSuiteFqns: ['suite.one'],
    },
    {
      activeTab: TestCasePageTabs.TEST_CASE_RESULTS,
      dimensionKey: 'country=india',
      isVersionPage: false,
      testSuiteFqns: ['suite.one'],
    },
    {
      activeTab: TestCasePageTabs.ISSUES,
      dimensionKey: undefined,
      isVersionPage: false,
      testSuiteFqns: ['suite.one'],
    },
  ])('does not fetch the next run outside the current results tab', (input) => {
    expect(shouldFetchNextRun(input)).toBe(false);
  });

  it.each([
    [false, 'label.entity-detail-plural'],
    [true, 'label.entity-version-detail-plural'],
  ])(
    'returns the page title for version mode %s',
    (isVersionPage, titleKey) => {
      const t = jest.fn((key: string) => key) as unknown as TFunction;

      expect(getIncidentManagerPageTitle(t, isVersionPage, TEST_CASE)).toBe(
        titleKey
      );
      expect(t).toHaveBeenCalledWith(titleKey, {
        entity: 'Customer count check',
      });
    }
  );
});
