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
import { useDataQualitySummary } from '../../../../hooks/useDataQualitySummary';
import { FilterButtonOption } from '../Common/TopicWidget/FilterButton';
import DataQualityWidget from './DataQualityWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echoes the options, so a test can tell which figures a label carries.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { name: 'dale' } }),
}));

// Spread the real module: the widget also reads its exported row count.
jest.mock('../../../../hooks/useDataQualitySummary', () => ({
  ...jest.requireActual('../../../../hooks/useDataQualitySummary'),
  useDataQualitySummary: jest.fn(),
}));

jest.mock('../../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getDataQualityPagePath: () => '/data-quality',
    getTestCaseDetailPagePath: (fqn: string) =>
      `/test-case/${encodeURIComponent(fqn)}`,
  },
}));

// The real control is a popover listbox; here each option is a button so a
// test can pick one without driving react-aria's pointer dance.
jest.mock('../Common/TopicWidget/FilterButton', () => ({
  __esModule: true,
  default: ({
    options,
    value,
    onChange,
    testId,
  }: {
    options: FilterButtonOption[];
    value: string;
    onChange: (next: string) => void;
    testId?: string;
  }) => (
    <div data-selected={value} data-testid={testId}>
      {options.map((option) => (
        <button
          data-testid={`${testId}-${option.value}`}
          key={option.value}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

const failingTest = (index: number) => ({
  entityLink: `<#E::table::svc.db.schema.orders_${index}>`,
  fullyQualifiedName: `svc.db.schema.orders_${index}.null_check #${index}`,
  id: `test-${index}`,
  name: `null_check_${index}`,
});

const SUMMARY = {
  aborted: 1,
  failed: 25,
  failedTests: [0, 1, 2, 3].map(failingTest),
  hasNoTests: false,
  isError: false,
  isFetching: false,
  isLoading: false,
  passed: 74,
  refetch: jest.fn(),
  total: 100,
};

const renderWidget = (summary: Partial<typeof SUMMARY> = {}) => {
  (useDataQualitySummary as jest.Mock).mockReturnValue({
    ...SUMMARY,
    ...summary,
  });

  return render(<DataQualityWidget widgetKey="KnowledgePanel.DataQuality-1" />);
};

describe('DataQualityWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the failing tests with a view action each', () => {
    renderWidget();

    expect(screen.getByTestId('failed-test-test-0')).toBeInTheDocument();
    expect(screen.getByTestId('dq-view-test-test-3')).toBeInTheDocument();
  });

  // "View test" used to open the Data Quality list with a `?testCase=` param
  // nothing reads, and an unencoded FQN in it.
  it('opens the test case page itself, with the FQN encoded', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('dq-view-test-test-1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/test-case/${encodeURIComponent('svc.db.schema.orders_1.null_check #1')}`
    );
  });

  // "N more" compared against the ten fetched while four rendered, and said
  // "assets match this rule".
  it('counts what is hidden against the bucket total, in test wording', () => {
    renderWidget();

    expect(
      screen.getByText('message.count-more-failing-tests {"count":21}')
    ).toBeInTheDocument();
    expect(screen.queryByText(/count-more-assets-match-rule/)).toBeNull();
  });

  it('builds the summary from one interpolated key', () => {
    renderWidget();

    expect(
      screen.getByText(
        'message.count-tests-count-failed {"count":100,"failed":25}'
      )
    ).toBeInTheDocument();
  });

  // A clean run used to read "No test results yet."
  it('says nothing is failing when tests ran and all passed', () => {
    renderWidget({
      aborted: 0,
      failed: 0,
      failedTests: [],
      passed: 12,
      total: 12,
    });

    expect(screen.getByTestId('data-quality-empty')).toHaveTextContent(
      'message.no-failing-tests'
    );
    expect(screen.queryByTestId('topic-status-dataQuality')).toBeNull();
  });

  it('reserves "no results" for a scope where nothing has run', () => {
    renderWidget({
      aborted: 0,
      failed: 0,
      failedTests: [],
      passed: 0,
      total: 0,
    });

    expect(screen.getByTestId('data-quality-empty')).toHaveTextContent(
      'message.no-test-results-yet'
    );
  });

  it('refetches through the filters without dropping back to a skeleton', () => {
    renderWidget({ isFetching: true });

    fireEvent.click(screen.getByTestId('dq-range-filter-30'));

    expect(useDataQualitySummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ range: '30' }),
      'dale'
    );
    // Still mounted, so the filter just used keeps its place and focus.
    expect(screen.getByTestId('dq-range-filter')).toBeInTheDocument();
    expect(screen.queryByTestId('topic-body-skeleton-dataQuality')).toBeNull();
  });

  it('shows an error body, not "no results", when the fetch fails', () => {
    renderWidget({ failed: 0, failedTests: [], isError: true, total: 0 });

    expect(screen.getByTestId('topic-error-dataQuality')).toBeInTheDocument();
    expect(screen.queryByTestId('data-quality-empty')).toBeNull();
  });

  // No test anywhere is a setup gap: the filters have nothing to narrow, so
  // the card offers the first test instead.
  it('offers to create the first test when none exist at all', () => {
    renderWidget({
      aborted: 0,
      failed: 0,
      failedTests: [],
      hasNoTests: true,
      passed: 0,
      total: 0,
    });

    expect(screen.getByTestId('topic-empty-dataQuality')).toHaveTextContent(
      'message.no-test-cases-yet'
    );
    expect(screen.getByTestId('topic-status-dataQuality')).toHaveTextContent(
      'label.not-set-up'
    );
    expect(screen.queryByTestId('dq-range-filter')).toBeNull();
    expect(screen.queryByTestId('data-quality-empty')).toBeNull();

    fireEvent.click(screen.getByTestId('topic-empty-action-dataQuality'));

    expect(mockNavigate).toHaveBeenCalledWith('/data-quality');
  });
});
