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
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { DataContractProcessedResultCharts } from './ContractExecutionChart.interface';
import ContractExecutionChartTooltip from './ContractExecutionChartTooltip.component';

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeLong: jest.fn((timestamp) => `Formatted: ${timestamp}`),
}));

const datum = {
  name: '1234567890000_0',
  displayTimestamp: 1234567890000,
  value: 1,
  status: ContractExecutionStatus.PartialSuccess,
  failed: 0,
  success: 0,
  aborted: 0,
  running: 0,
  data: {
    id: 'run-1',
    timestamp: 1234567890000,
    contractExecutionStatus: ContractExecutionStatus.PartialSuccess,
  },
} as DataContractProcessedResultCharts;

describe('ContractExecutionChartTooltip', () => {
  it('shows the run time, the status name and a swatch in the bar colour', () => {
    const { container } = render(
      <ContractExecutionChartTooltip
        color="#a0a000"
        datum={datum}
        label="Contract Execution Status"
        statusLabel="Partial Success"
      />
    );

    expect(screen.getByText('Formatted: 1234567890000')).toBeInTheDocument();
    expect(screen.getByText('Contract Execution Status')).toBeInTheDocument();
    expect(screen.getByText('Partial Success')).toBeInTheDocument();
    expect(container.querySelector('rect')).toHaveAttribute('fill', '#a0a000');
  });

  it('keeps the label as given (no start-casing)', () => {
    render(
      <ContractExecutionChartTooltip
        color="#00a000"
        datum={datum}
        label="label.contract-execution-status"
        statusLabel="Success"
      />
    );

    expect(
      screen.getByText('label.contract-execution-status')
    ).toBeInTheDocument();
  });
});
