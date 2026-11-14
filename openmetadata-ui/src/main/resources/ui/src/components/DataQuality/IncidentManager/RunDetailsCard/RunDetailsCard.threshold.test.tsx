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
import { act, screen } from '@testing-library/react';
import {
  ProfileSampleType,
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { useTestCaseStore } from '../useTestCase.store';
import RunDetailsCard from './RunDetailsCard';

// Resolved against the real catalog: what is under test is what the reader
// sees, e.g. "1.20% (120 row(s))", which echoed keys would hide. A hoisted
// function that loads the catalog itself, because constants translate at
// import time, before anything below the mocks is initialized.
function mockTranslate(key: string, options?: Record<string, unknown>) {
  const catalog: Record<string, Record<string, string>> = jest.requireActual(
    '../../../../locale/languages/en-us.json'
  );
  const [namespace, ...rest] = key.split('.');
  const template = catalog[namespace]?.[rest.join('.')] ?? key;

  return Object.entries(options ?? {}).reduce(
    (result, [name, value]) => result.split(`{{${name}}}`).join(String(value)),
    template
  );
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  t: (key: string, options?: Record<string, unknown>) =>
    mockTranslate(key, options),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockResolvedValue({ data: [] }),
  runIngestionPipelineForEntity: jest.fn(),
}));

jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({
      permissions: {},
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    }),
  })
);

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

const testCaseOf = (
  definitionName: string,
  parameterValues: { name: string; value: string }[]
) =>
  ({
    name: 'tc',
    fullyQualifiedName: 'svc.db.schema.users.tc',
    entityLink: '<#E::table::svc.db.schema.users::columns::email>',
    parameterValues,
    testDefinition: { id: 'def', type: 'testDefinition', name: definitionName },
  } as TestCase);

const NOT_NULL_ONE_PERCENT = testCaseOf('columnValuesToBeNotNull', [
  { name: 'threshold', value: '1' },
  { name: 'thresholdUnit', value: 'PERCENTAGE' },
]);

const MEAN_FIVE_PERCENT = testCaseOf('columnValueMeanToBeBetween', [
  { name: 'minValueForMeanInCol', value: '90' },
  { name: 'maxValueForMeanInCol', value: '110' },
  { name: 'threshold', value: '5' },
  { name: 'thresholdUnit', value: 'PERCENTAGE' },
]);

const rowRun = (
  testCaseStatus: TestCaseStatus,
  failedRows: number,
  passedRows: number
): TestCaseResult => ({
  timestamp: 1_786_001_601_000,
  testCaseStatus,
  testResultValue: [{ name: 'nullCount', value: String(failedRows) }],
  passedRows,
  failedRows,
  failedRowsPercentage:
    Math.round((failedRows / (failedRows + passedRows)) * 10000) / 100,
});

const renderCard = (result: TestCaseResult, testCase: TestCase) =>
  renderWithQueryClient(
    <RunDetailsCard results={[result]} testCase={testCase} />
  );

describe('RunDetailsCard threshold and scope', () => {
  afterEach(() => {
    act(() => useTestCaseStore.getState().reset());
  });

  it('sets a failing run beside the threshold it exceeded', () => {
    renderCard(rowRun(TestCaseStatus.Failed, 120, 9861), NOT_NULL_ONE_PERCENT);

    expect(screen.getByTestId('run-details-failed')).toHaveTextContent(
      '1.20% (120 row(s))'
    );
    expect(screen.getByTestId('run-details-threshold')).toHaveTextContent(
      '1% of rows'
    );
    expect(screen.getByTestId('run-details-evaluated')).toHaveTextContent(
      '9,981 row(s)'
    );
  });

  it('sets a passing run beside the threshold it stayed within', () => {
    renderCard(rowRun(TestCaseStatus.Success, 5, 9976), NOT_NULL_ONE_PERCENT);

    expect(screen.getByTestId('run-details-failed')).toHaveTextContent(
      '0.05% (5 row(s))'
    );
    expect(screen.getByTestId('run-details-threshold')).toHaveTextContent(
      '1% of rows'
    );
  });

  it('leads with the count when the threshold is a count', () => {
    renderCard(
      rowRun(TestCaseStatus.Failed, 120, 9861),
      testCaseOf('columnValuesToBeNotNull', [
        { name: 'threshold', value: '100' },
        { name: 'thresholdUnit', value: 'ABSOLUTE' },
      ])
    );

    expect(screen.getByTestId('run-details-failed')).toHaveTextContent(
      '120 row(s) (1.20%)'
    );
    expect(screen.getByTestId('run-details-threshold')).toHaveTextContent(
      '100 row(s)'
    );
  });

  it('says a test case with no threshold set tolerates nothing', () => {
    renderCard(
      rowRun(TestCaseStatus.Failed, 3, 97),
      testCaseOf('columnValuesToBeNotNull', [])
    );

    expect(screen.getByTestId('run-details-threshold')).toHaveTextContent(
      'No tolerance'
    );
    expect(screen.getByTestId('run-details-failed')).toHaveTextContent(
      '3 row(s) (3.00%)'
    );
  });

  it('sets a statistical run beside its configured and widened range', () => {
    renderCard(
      {
        timestamp: 1_786_001_601_000,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [{ name: 'mean', value: '87.4' }],
        minBound: 85.5,
        maxBound: 115.5,
      },
      MEAN_FIVE_PERCENT
    );

    expect(screen.getByTestId('run-details-threshold')).toHaveTextContent(
      '5% of the bound'
    );
    expect(
      screen.getByTestId('run-details-configured-range')
    ).toHaveTextContent('90 – 110');
    expect(screen.getByTestId('run-details-effective-range')).toHaveTextContent(
      '85.5 – 115.5'
    );
  });

  it('shows no threshold beside a test that reads none', () => {
    renderCard(
      {
        timestamp: 1_786_001_601_000,
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [{ name: 'rowCount', value: '110' }],
      },
      testCaseOf('tableCustomSQLQuery', [{ name: 'threshold', value: '0' }])
    );

    expect(
      screen.queryByTestId('run-details-threshold-section')
    ).not.toBeInTheDocument();
  });

  it('badges a sampled, partitioned run and says the verdict is the sample’s', () => {
    renderCard(
      {
        ...rowRun(TestCaseStatus.Failed, 120, 9861),
        evaluationScope: {
          sampled: true,
          profileSample: 10,
          profileSampleType: ProfileSampleType.Percentage,
          partitioned: true,
          partitionColumnName: 'event_date',
        },
      },
      NOT_NULL_ONE_PERCENT
    );

    expect(screen.getByTestId('run-details-sampled-badge')).toHaveTextContent(
      '10% sample'
    );
    expect(
      screen.getByTestId('run-details-partitioned-badge')
    ).toHaveTextContent('Partitioned on event_date');
    expect(screen.getByTestId('run-details-sample-note')).toBeInTheDocument();
  });

  it.each([
    ['a full-table run', { sampled: false, partitioned: false }],
    ['a run that recorded no scope', undefined],
  ])('has no badge for %s', (_, evaluationScope) => {
    renderCard(
      { ...rowRun(TestCaseStatus.Failed, 120, 9861), evaluationScope },
      NOT_NULL_ONE_PERCENT
    );

    expect(
      screen.queryByTestId('run-details-sampled-badge')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('run-details-partitioned-badge')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('run-details-sample-note')
    ).not.toBeInTheDocument();
  });
});
