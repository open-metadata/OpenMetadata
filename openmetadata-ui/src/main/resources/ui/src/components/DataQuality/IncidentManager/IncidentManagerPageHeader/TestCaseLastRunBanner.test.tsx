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

import { fireEvent, render, screen } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import {
  TestCaseStatus,
  type TestCaseResolutionStatus,
  type TestCaseResult,
} from '../../../../generated/tests/testCase';
import {
  MOCK_TASK_DATA,
  MOCK_TEST_CASE_RESOLUTION_STATUS,
} from '../../../../mocks/TestCase.mock';
import TestCaseLastRunBanner from './TestCaseLastRunBanner.component';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';

const mockNavigate = jest.fn();
const LAST_RUN_BANNER_TEST_IDS = {
  [TestCaseStatus.Aborted]: 'test-case-last-run-banner-aborted',
  [TestCaseStatus.Failed]: 'test-case-last-run-banner-failed',
  [TestCaseStatus.Queued]: 'test-case-last-run-banner-queued',
  [TestCaseStatus.Success]: 'test-case-last-run-banner-success',
} as const;
const NO_RUN_BANNER_TEST_ID = 'test-case-last-run-banner-not-run-yet';
const LAST_RUN_INCIDENT_TEST_ID = 'test-case-last-run-incident';
const RESULT_EXPECTED_TEST_ID = 'test-case-result-expected';
const LAST_RUN_STATUS_TEST_ID = 'test-case-last-run-status';
const LAST_RUN_ICON_TEST_ID = 'test-case-last-run-icon';
const LAST_RUN_SUMMARY_TEST_ID = 'test-case-last-run-summary';
const NEXT_RUN_TEST_ID = 'test-case-next-run';
const INCIDENT_ID_TEST_ID = 'test-case-incident-id';
const INCIDENT_STATUS_TEST_ID = 'test-case-incident-status';
const TEST_CASE_RESULT_TIMESTAMP = 1_786_001_601_000;
const TOP_ALIGNED_CLASS = 'tw:self-start';
const TEXT_XS_CLASS = 'tw:text-xs';
const INCIDENT_PATH =
  '/test-case/sample_data.ecommerce_db.shopify.dim_address.table_column_count_between/issues';

const defaultProps: TestCaseLastRunBannerProps = {
  incidentTask: MOCK_TASK_DATA[1],
  parameterValues: [{ name: 'rowCount', value: '1000' }],
  taskLinkInfo: { label: '#9', path: INCIDENT_PATH },
  testCaseStatusData:
    MOCK_TEST_CASE_RESOLUTION_STATUS[1] as TestCaseResolutionStatus,
};

const renderBanner = (props: Partial<TestCaseLastRunBannerProps> = {}) =>
  render(<TestCaseLastRunBanner {...defaultProps} {...props} />);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../../../../utils/FqnUtils', () => ({
  ...jest.requireActual('../../../../utils/FqnUtils'),
  getNameFromFQN: jest.fn().mockReturnValue('getNameFromFQN'),
}));

describe('TestCaseLastRunBanner', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  it.each<[TestCaseStatus, string]>([
    [TestCaseStatus.Failed, 'Query execution failed'],
    [TestCaseStatus.Aborted, 'Connection timed out'],
    [TestCaseStatus.Success, 'All rows passed'],
  ])(
    'shows the latest %s run status and result',
    async (testCaseStatus, result) => {
      const testCaseResult: TestCaseResult = {
        testCaseStatus,
        result,
        testResultValue: [
          { name: 'rowCount', predictedValue: '1000', value: '5' },
        ],
        timestamp: TEST_CASE_RESULT_TIMESTAMP,
      };

      renderBanner({ testCaseResult, testCaseStatus });

      const bannerTestId = LAST_RUN_BANNER_TEST_IDS[testCaseStatus];

      expect(await screen.findByText(result)).toBeInTheDocument();
      expect(screen.getAllByTestId(bannerTestId)).toHaveLength(1);
      expect(screen.getByTestId(bannerTestId)).toHaveClass('tw:font-sans');
      expect(screen.getByTestId(bannerTestId)).toHaveTextContent(
        `label.last-run label.${testCaseStatus.toLowerCase()}`
      );
      expect(screen.getByTestId(LAST_RUN_STATUS_TEST_ID)).toHaveClass(
        {
          [TestCaseStatus.Aborted]: 'tw:text-warning-primary',
          [TestCaseStatus.Failed]: 'tw:text-error-primary',
          [TestCaseStatus.Queued]: 'tw:text-brand-primary',
          [TestCaseStatus.Success]: 'tw:text-success-primary',
        }[testCaseStatus]
      );
      expect(screen.getByTestId('test-case-last-run-prefix')).toHaveClass(
        'tw:text-primary',
        'tw:text-sm'
      );
      expect(screen.getByTestId(LAST_RUN_ICON_TEST_ID)).toHaveClass(
        'tw:size-8',
        'tw:rounded-lg',
        TOP_ALIGNED_CLASS
      );
      expect(screen.getByTestId(LAST_RUN_SUMMARY_TEST_ID)).toHaveClass(
        'tw:py-3.5',
        {
          [TestCaseStatus.Aborted]: 'tw:bg-yellow-50',
          [TestCaseStatus.Failed]: 'tw:bg-error-50',
          [TestCaseStatus.Queued]: 'tw:bg-brand-primary',
          [TestCaseStatus.Success]: 'tw:bg-success-primary',
        }[testCaseStatus]
      );
      expect(
        screen.getByTestId('test-case-last-run-right-section')
      ).toHaveClass('tw:justify-end', 'tw:lg:w-80');
      expect(screen.getByText(result)).toHaveClass(TEXT_XS_CLASS);
      expect(
        screen.getByTestId('test-case-run-description')
      ).toBeInTheDocument();
      expect(screen.getByTestId('test-case-last-run-time')).toHaveClass(
        TEXT_XS_CLASS,
        'tw:font-normal'
      );
      expect(screen.getByTestId(NEXT_RUN_TEST_ID)).toHaveTextContent(
        'label.next · label.not-scheduled'
      );

      if (testCaseStatus === TestCaseStatus.Aborted) {
        expect(
          screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
        ).not.toBeInTheDocument();
      } else {
        expect(screen.getByTestId(RESULT_EXPECTED_TEST_ID)).toHaveTextContent(
          'label.result / label.expected'
        );
        expect(screen.getByText('label.result / label.expected')).toHaveClass(
          'tw:text-secondary'
        );
        expect(screen.getByTestId('test-case-result-value')).toHaveTextContent(
          '5 / 1,000'
        );
        expect(screen.getByText('/ 1,000')).toHaveClass('tw:text-secondary');
      }

      if (
        testCaseStatus === TestCaseStatus.Failed ||
        testCaseStatus === TestCaseStatus.Aborted
      ) {
        const incidentRow = await screen.findByTestId(
          LAST_RUN_INCIDENT_TEST_ID
        );

        expect(incidentRow).toHaveClass(
          {
            [TestCaseStatus.Aborted]: 'tw:bg-yellow-50',
            [TestCaseStatus.Failed]: 'tw:bg-error-50',
          }[testCaseStatus]
        );
        expect(incidentRow).toHaveTextContent('INC–9');
        expect(incidentRow).toHaveTextContent(
          'message.request-test-case-failure-resolution-message getNameFromFQN (testCase)'
        );
        expect(incidentRow).toHaveTextContent('label.acknowledged');
        expect(screen.getByTestId('test-case-incident-icon')).toHaveClass(
          TOP_ALIGNED_CLASS
        );
        expect(
          screen.getByTestId('test-case-incident-text').nextElementSibling
        ).toBe(screen.getByTestId(INCIDENT_STATUS_TEST_ID));

        const incidentActions = screen.getByTestId(
          'test-case-incident-actions'
        );

        expect(incidentActions).toHaveClass('tw:lg:w-52');
        expect(screen.getByTestId(INCIDENT_ID_TEST_ID)).toHaveClass(
          TEXT_XS_CLASS,
          'tw:font-semibold'
        );
        expect(screen.getByTestId(INCIDENT_ID_TEST_ID)).toHaveTextContent(
          /INC.*9,/
        );
        expect(
          screen.getByTestId('test-case-incident-description')
        ).toHaveClass(TEXT_XS_CLASS);
        expect(
          screen.getByTestId('test-case-incident-description')
        ).toContainElement(screen.getByTestId(INCIDENT_ID_TEST_ID));
        expect(screen.getByTestId(INCIDENT_STATUS_TEST_ID)).toHaveClass(
          TOP_ALIGNED_CLASS
        );
        expect(
          screen.getByTestId(INCIDENT_STATUS_TEST_ID).firstElementChild
        ).toHaveClass('tw:bg-white');

        const viewIncidentButton = screen.getByTestId('view-incident-button');

        expect(viewIncidentButton).toHaveTextContent('label.view-entity');
        expect(viewIncidentButton).toHaveClass(
          TEXT_XS_CLASS,
          'tw:ml-auto',
          'tw:shrink-0'
        );
        expect(viewIncidentButton).not.toHaveAttribute('href');

        fireEvent.click(viewIncidentButton);

        expect(mockNavigate).toHaveBeenCalledWith(INCIDENT_PATH);
      } else {
        expect(
          screen.queryByTestId(LAST_RUN_INCIDENT_TEST_ID)
        ).not.toBeInTheDocument();
      }
    }
  );

  it('uses the authoritative test case status when the embedded result is stale', () => {
    renderBanner({
      testCaseResult: {
        result: 'Query execution failed',
        testCaseStatus: TestCaseStatus.Failed,
        timestamp: 1_786_001_601_000,
      },
      testCaseStatus: TestCaseStatus.Aborted,
    });

    expect(screen.getByTestId(LAST_RUN_STATUS_TEST_ID)).toHaveTextContent(
      'label.aborted'
    );
    expect(screen.getByTestId(LAST_RUN_STATUS_TEST_ID)).toHaveClass(
      'tw:text-warning-primary'
    );
    expect(
      screen.getByTestId(LAST_RUN_BANNER_TEST_IDS[TestCaseStatus.Aborted])
    ).not.toHaveTextContent('label.failed');
  });

  it('uses the matching test parameter when the result omits its predicted value', () => {
    renderBanner({
      parameterValues: [
        { name: 'rowCount', value: '10000' },
        { name: 'columnName', value: 'customer_id' },
      ],
      testCaseResult: {
        result: 'Found 110 rows vs. the expected 10,000',
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [{ name: 'rowCount', value: '110' }],
        timestamp: TEST_CASE_RESULT_TIMESTAMP,
      },
      testCaseStatus: TestCaseStatus.Failed,
    });

    expect(screen.getByTestId(RESULT_EXPECTED_TEST_ID)).toHaveTextContent(
      '110 / 10,000'
    );
  });

  it('does not pair a result with an unrelated test parameter', () => {
    const result = 'Found 5 rows';

    renderBanner({
      parameterValues: [{ name: 'columnName', value: 'customer_id' }],
      testCaseResult: {
        result,
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [{ name: 'rowCount', value: '5' }],
        timestamp: TEST_CASE_RESULT_TIMESTAMP,
      },
      testCaseStatus: TestCaseStatus.Failed,
    });

    expect(screen.getByText(result)).toBeInTheDocument();
    expect(
      screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
    ).not.toBeInTheDocument();
  });

  it('explains when the latest run is queued without a result', () => {
    renderBanner({
      testCaseResult: {
        testCaseStatus: TestCaseStatus.Queued,
        timestamp: TEST_CASE_RESULT_TIMESTAMP,
      },
      testCaseStatus: TestCaseStatus.Queued,
    });

    expect(
      screen.getByText('message.test-case-run-queued')
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId(LAST_RUN_BANNER_TEST_IDS[TestCaseStatus.Queued])
    ).toHaveLength(1);
    expect(
      screen.getByTestId(LAST_RUN_BANNER_TEST_IDS[TestCaseStatus.Queued])
    ).toHaveTextContent('label.last-run label.queued');
    expect(
      screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(LAST_RUN_INCIDENT_TEST_ID)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(NEXT_RUN_TEST_ID)).toHaveTextContent(
      'label.next · label.running-now'
    );
  });

  it('shows one not-run-yet banner when no latest result exists', () => {
    renderBanner({
      incidentTask: null,
      taskLinkInfo: null,
      testCaseResult: undefined,
      testCaseStatus: undefined,
      testCaseStatusData: undefined,
    });

    const banner = screen.getByTestId(NO_RUN_BANNER_TEST_ID);

    expect(screen.getAllByTestId(NO_RUN_BANNER_TEST_ID)).toHaveLength(1);
    expect(banner).toHaveTextContent('label.last-run label.not-run-yet');
    expect(banner).toHaveTextContent('message.test-case-not-run-yet');
    expect(banner).toHaveTextContent('label.next · label.not-scheduled');
    expect(
      screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(LAST_RUN_INCIDENT_TEST_ID)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('test-case-last-run-prefix')).toHaveClass(
      'tw:text-sm'
    );
    expect(screen.getByTestId(LAST_RUN_ICON_TEST_ID)).toHaveClass(
      'tw:size-8',
      'tw:rounded-lg',
      TOP_ALIGNED_CLASS
    );
    expect(screen.getByTestId(LAST_RUN_SUMMARY_TEST_ID)).toHaveClass(
      'tw:py-3.5'
    );
    expect(screen.getByText('message.test-case-not-run-yet')).toHaveClass(
      TEXT_XS_CLASS
    );
  });

  it('does not show a negative duration when a cached next run has passed', () => {
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000);

    renderBanner({
      incidentTask: null,
      nextRunTimestamp: 1_000,
      taskLinkInfo: null,
      testCaseResult: undefined,
      testCaseStatus: undefined,
      testCaseStatusData: undefined,
    });

    const nextRun = screen.getByTestId(NEXT_RUN_TEST_ID);

    expect(nextRun).toHaveTextContent('label.not-scheduled');
    expect(nextRun).not.toHaveTextContent('label.in-lowercase');

    dateNowSpy.mockRestore();
  });
});
