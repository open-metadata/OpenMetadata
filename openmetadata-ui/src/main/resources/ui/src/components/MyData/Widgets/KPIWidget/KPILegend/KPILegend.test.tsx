/*
 *  Copyright 2025 Collate.
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
import { KpiTargetType } from '../../../../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../../../../interface/data-insight.interface';
import KPILegend from './KPILegend';

const DAY = 24 * 60 * 60 * 1000;

const buildResult = (
  value: string,
  target: number,
  targetMet: boolean,
  endDate: number
) =>
  ({
    displayName: 'Description KPI',
    metricType: KpiTargetType.Percentage,
    target,
    endDate,
    targetResult: [{ value, targetMet }],
  } as unknown as UIKpiResult);

describe('KPILegend', () => {
  it('clamps progress above the target to a full bar and shows goal completed', () => {
    render(
      <KPILegend
        isFullSize
        kpiLatestResultsRecord={{
          kpi: buildResult('150', 100, true, Date.now() + 5 * DAY),
        }}
      />
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    expect(screen.getByText('label.goal-completed')).toBeInTheDocument();
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('shows goal missed with an empty bar when the target is zero and time is up', () => {
    render(
      <KPILegend
        isFullSize
        kpiLatestResultsRecord={{
          kpi: buildResult('0', 0, false, Date.now() - DAY),
        }}
      />
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0'
    );
    expect(screen.getByText('label.goal-missed')).toBeInTheDocument();
  });

  it('renders the compact legend with days left', () => {
    render(
      <KPILegend
        isFullSize={false}
        kpiLatestResultsRecord={{
          kpi: buildResult('20', 100, false, Date.now() + 3 * DAY),
        }}
      />
    );

    expect(screen.getByText('Description KPI:')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
