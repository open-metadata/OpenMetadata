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
import { TooltipProps } from 'recharts';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import ContractExecutionChartTooltip from './ContractExecutionChartTooltip.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeLong: jest.fn((timestamp) => `Formatted: ${timestamp}`),
}));

describe('ContractExecutionChartTooltip', () => {
  const mockData = {
    id: 'test-id-123',
    dataContractFQN: 'test.contract.fqn',
    timestamp: 1234567890000,
    contractExecutionStatus: ContractExecutionStatus.Success,
  };

  const baseProps: TooltipProps<string | number, string> = {
    active: true,
    payload: [
      {
        color: '#00FF00',
        dataKey: 'success',
        value: 1,
        payload: {
          name: '1234567890000_0',
          displayTimestamp: 1234567890000,
          value: 1,
          status: ContractExecutionStatus.Success,
          failed: 0,
          success: 1,
          aborted: 0,
          data: mockData,
        },
      },
    ],
    label: '1234567890000_0',
  };

  it('should render tooltip when active and has data', () => {
    render(<ContractExecutionChartTooltip {...baseProps} />);

    expect(screen.getByText('Formatted: 1234567890000')).toBeInTheDocument();
    expect(
      screen.getByText('label.contract-execution-status')
    ).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('should not render when not active', () => {
    const props = {
      ...baseProps,
      active: false,
    };

    const { container } = render(<ContractExecutionChartTooltip {...props} />);

    expect(container.firstChild).toBeNull();
  });

  it('should not render when payload is empty', () => {
    const props = {
      ...baseProps,
      payload: [],
    };

    const { container } = render(<ContractExecutionChartTooltip {...props} />);

    expect(container.firstChild).toBeNull();
  });

  it('should not render when data is null', () => {
    const props: TooltipProps<string | number, string> = {
      ...baseProps,
      payload: [
        {
          color: '#00FF00',
          dataKey: 'success',
          value: 1,
          payload: {
            name: '1234567890000_0',
            displayTimestamp: 1234567890000,
            value: 1,
            status: ContractExecutionStatus.Success,
            failed: 0,
            success: 1,
            aborted: 0,
            data: null,
          },
        },
      ],
    };

    const { container } = render(<ContractExecutionChartTooltip {...props} />);

    expect(container.firstChild).toBeNull();
  });

  it('should handle Failed status', () => {
    const failedData = {
      ...mockData,
      contractExecutionStatus: ContractExecutionStatus.Failed,
    };

    const props: TooltipProps<string | number, string> = {
      ...baseProps,
      payload: [
        {
          color: '#FF0000',
          dataKey: 'failed',
          value: 1,
          payload: {
            name: '1234567890000_0',
            displayTimestamp: 1234567890000,
            value: 1,
            status: ContractExecutionStatus.Failed,
            failed: 1,
            success: 0,
            aborted: 0,
            data: failedData,
          },
        },
      ],
    };

    render(<ContractExecutionChartTooltip {...props} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should handle Aborted status', () => {
    const abortedData = {
      ...mockData,
      contractExecutionStatus: ContractExecutionStatus.Aborted,
    };

    const props: TooltipProps<string | number, string> = {
      ...baseProps,
      payload: [
        {
          color: '#FFFF00',
          dataKey: 'aborted',
          value: 1,
          payload: {
            name: '1234567890000_0',
            displayTimestamp: 1234567890000,
            value: 1,
            status: ContractExecutionStatus.Aborted,
            failed: 0,
            success: 0,
            aborted: 1,
            data: abortedData,
          },
        },
      ],
    };

    render(<ContractExecutionChartTooltip {...props} />);

    expect(screen.getByText('Aborted')).toBeInTheDocument();
  });

  it('should fallback to extracting timestamp from name if displayTimestamp is not available', () => {
    const props: TooltipProps<string | number, string> = {
      ...baseProps,
      payload: [
        {
          color: '#00FF00',
          dataKey: 'success',
          value: 1,
          payload: {
            name: '9876543210000_5',
            displayTimestamp: undefined,
            value: 1,
            status: ContractExecutionStatus.Success,
            failed: 0,
            success: 1,
            aborted: 0,
            data: mockData,
          },
        },
      ],
    };

    render(<ContractExecutionChartTooltip {...props} />);

    expect(screen.getByText('Formatted: 9876543210000')).toBeInTheDocument();
  });

  it('should handle undefined payload gracefully', () => {
    const props = {
      active: true,
      payload: undefined,
    } as unknown as TooltipProps<string | number, string>;

    const { container } = render(<ContractExecutionChartTooltip {...props} />);

    expect(container.firstChild).toBeNull();
  });

  it('should display the test-summary-tooltip-container', () => {
    render(<ContractExecutionChartTooltip {...baseProps} />);

    expect(
      screen.getByTestId('test-summary-tooltip-container')
    ).toBeInTheDocument();
  });
});
