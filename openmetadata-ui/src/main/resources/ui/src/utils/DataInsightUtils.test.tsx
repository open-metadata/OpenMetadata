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
import { render } from '@testing-library/react';
import { DataInsightChartTooltipProps } from '../interface/data-insight.interface';
import { CustomTooltip } from './DataInsightUtils';

describe('CustomTooltip', () => {
  const defaultProps: DataInsightChartTooltipProps = {
    active: true,
    payload: [
      {
        color: '#ff0000',
        name: 'Test Data',
        value: 100,
        payload: { timestampValue: 1620000000000, 'Test Data': 100, data: 120 },
        dataKey: 'Test Data',
      },
    ],
    valueFormatter: jest.fn((value) => `${value} units`),
    dateTimeFormatter: jest.fn((timestamp) =>
      new Date(timestamp || 0).toLocaleString()
    ),
    isPercentage: false,
    timeStampKey: 'timestampValue',
    transformLabel: true,
  };

  it('renders correctly when active', () => {
    const { getByText } = render(<CustomTooltip {...defaultProps} />);

    // Check if the timestamp is rendered
    expect(getByText(/Test Data/i)).toBeInTheDocument();
    expect(getByText(/100 units/i)).toBeInTheDocument();
  });

  it('renders correctly when customValueKey is provided', () => {
    const { getByText } = render(
      <CustomTooltip {...{ ...defaultProps, customValueKey: 'data' }} />
    );

    // Check if the timestamp is rendered
    expect(getByText(/Test Data/i)).toBeInTheDocument();
    expect(getByText(/120 units/i)).toBeInTheDocument();
  });

  it('returns null when not active', () => {
    const { container } = render(
      <CustomTooltip {...{ ...defaultProps, active: false }} />
    );

    expect(container.firstChild).toBeNull();
  });
});
