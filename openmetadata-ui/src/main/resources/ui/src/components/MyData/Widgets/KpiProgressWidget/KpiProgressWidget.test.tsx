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
import {
  KPI_ALL_TIME,
  KPI_WINDOW_DAYS,
  KpiProgress,
  useKpiProgress,
} from '../../../../hooks/useKpiProgress';
import KpiProgressWidget from './KpiProgressWidget';
import { FilterButtonOption } from '../Common/TopicWidget/FilterButton';

jest.mock('@openmetadata/ui-core-components/charts', () => ({
  AreaChart: () => <div data-testid="area-chart" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../../../hooks/useKpiProgress', () => ({
  ...jest.requireActual('../../../../hooks/useKpiProgress'),
  useKpiProgress: jest.fn(),
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

const KPI: KpiProgress = {
  current: 28,
  daysLeft: 35,
  delta: 2,
  endDate: 1_760_000_000_000,
  fullyQualifiedName: 'ownership-coverage',
  id: 'kpi-ownership',
  name: 'Ownership coverage',
  projected: 34,
  series: [26, 28],
  status: 'atRisk',
  target: 63,
  windowEnd: 1_757_000_000_000,
  windowStart: 1_754_000_000_000,
};

const renderWidget = (kpis: KpiProgress[] = [KPI]) => {
  (useKpiProgress as jest.Mock).mockReturnValue({
    atRiskCount: kpis.filter((kpi) => kpi.status !== 'onTrack').length,
    isError: false,
    isLoading: false,
    kpis,
  });

  return render(<KpiProgressWidget widgetKey="KnowledgePanel.KPI-1" />);
};

describe('KpiProgressWidget range filter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens on the default window', () => {
    renderWidget();

    expect(useKpiProgress).toHaveBeenCalledWith(KPI_WINDOW_DAYS);
    expect(screen.getByTestId('kpi-window-filter')).toHaveAttribute(
      'data-selected',
      String(KPI_WINDOW_DAYS)
    );
  });

  // The window drives the fetch, not just the label — a wider range has to
  // re-request the series, or the card would project off the old rate.
  it('refetches on a wider window', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('kpi-window-filter-90'));

    expect(useKpiProgress).toHaveBeenLastCalledWith(90);
  });

  // "All time" is not a day count — it must reach the hook as the sentinel, so
  // each KPI is read from its own start date rather than a window off the clock.
  it('passes the all-time sentinel through unchanged', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId(`kpi-window-filter-${KPI_ALL_TIME}`));

    expect(useKpiProgress).toHaveBeenLastCalledWith(KPI_ALL_TIME);
  });

  // With no KPIs defined there is no series for a range to narrow.
  it('hides the filter when no KPIs exist', () => {
    renderWidget([]);

    expect(screen.queryByTestId('kpi-window-filter')).toBeNull();
  });
});
