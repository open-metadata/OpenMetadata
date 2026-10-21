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
import { render, screen } from '@testing-library/react';
import { KpiTargetType } from '../../../../../generated/dataInsight/kpi/kpi';
import { KpiProgress } from '../../../../../hooks/useKpiProgress';
import KpiProgressRow from './KpiProgressRow';

jest.mock('@openmetadata/ui-core-components/charts', () => ({
  AreaChart: () => <div data-testid="area-chart" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echoes the options, so a test can see the formatted figures a label got.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: () => 'Jan 1',
}));

const KPI: KpiProgress = {
  current: 28,
  daysLeft: 35,
  delta: 2,
  endDate: 1_760_000_000_000,
  fullyQualifiedName: 'ownership-coverage',
  id: 'kpi-ownership',
  metricType: KpiTargetType.Percentage,
  name: 'Ownership coverage',
  projected: 34,
  series: [26, 28],
  status: 'atRisk',
  target: 63,
  windowDays: 30,
  windowEnd: 1_757_000_000_000,
  windowStart: 1_754_000_000_000,
};

const renderRow = (kpi: Partial<KpiProgress> = {}) =>
  render(
    <ul>
      <KpiProgressRow kpi={{ ...KPI, ...kpi }} />
    </ul>
  );

describe('KpiProgressRow', () => {
  it('formats a percentage KPI as a percentage', () => {
    renderRow();

    expect(screen.getByTestId('kpi-current')).toHaveTextContent('28%');
    expect(screen.getByTestId('kpi-target')).toHaveTextContent('"value":"63%"');
    expect(screen.getByTestId('kpi-remaining')).toHaveTextContent(
      '"value":"35%"'
    );
  });

  // A fixed `%` suffix printed a count target as "1500%".
  it('formats a number KPI as a plain number', () => {
    renderRow({
      current: 1200,
      metricType: KpiTargetType.Number,
      projected: 1400,
      target: 1500,
    });

    expect(screen.getByTestId('kpi-current')).toHaveTextContent('1,200');
    expect(screen.getByTestId('kpi-current')).not.toHaveTextContent('%');
    expect(screen.getByTestId('kpi-target')).toHaveTextContent(
      '"value":"1,500"'
    );
    expect(screen.getByTestId('kpi-projection')).toHaveTextContent(
      '"value":"1,400"'
    );
  });

  // The delta read "this week" whatever range was selected.
  it('words the change for the selected window', () => {
    renderRow({ windowDays: 90 });

    expect(screen.getByTestId('kpi-delta')).toHaveTextContent(
      'message.value-in-last-count-days {"count":90,"value":"+2%"}'
    );
  });

  it('words an unchanged KPI for the selected window too', () => {
    renderRow({ delta: 0, windowDays: 30 });

    expect(screen.getByTestId('kpi-delta')).toHaveTextContent(
      'message.no-change-in-last-count-days {"count":30}'
    );
  });

  it('reads "since start" on all time', () => {
    const { unmount } = renderRow({ windowDays: null });

    expect(screen.getByTestId('kpi-delta')).toHaveTextContent(
      'message.value-since-start {"value":"+2%"}'
    );

    unmount();
    renderRow({ delta: null, windowDays: null });

    expect(screen.getByTestId('kpi-delta')).toHaveTextContent(
      'message.no-change-since-start'
    );
  });

  it('keeps the days left as its own plural phrase', () => {
    renderRow();

    expect(screen.getByTestId('kpi-days-left')).toHaveTextContent(
      'message.count-days-left {"count":35}'
    );
    expect(screen.getByTestId('kpi-days-left').textContent).not.toMatch(/·/);
  });

  it('projects only a KPI that is off track', () => {
    const { unmount } = renderRow();

    expect(screen.getByTestId('kpi-projection')).toBeInTheDocument();

    unmount();
    renderRow({ status: 'onTrack' });

    expect(screen.queryByTestId('kpi-projection')).toBeNull();
  });
});
