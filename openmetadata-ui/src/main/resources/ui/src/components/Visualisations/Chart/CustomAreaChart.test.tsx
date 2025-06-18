/*
 *  Copyright 2024 Collate.
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
import '../../../test/unit/mocks/recharts.mock';
import CustomAreaChart from './CustomAreaChart.component';

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn(),
}));
jest.mock('.../../../constants/Color.constants', () => ({
  PRIMARY_COLOR: '#0000FF',
  BLUE_2: '#0000FF',
}));
jest.mock('../../../constants/constants', () => ({
  WHITE_COLOR: '#FFF',
}));

describe('CustomAreaChart', () => {
  const mockData = [
    { timestamp: 1627849200000, count: 10 },
    { timestamp: 1627935600000, count: 20 },
  ];
  const mockColorScheme = {
    gradientStartColor: '#0000FF',
    gradientEndColor: '#FFFFFF',
    strokeColor: '#FF0000',
  };
  const mockValueFormatter = jest.fn((value) => `Formatted ${value}`);

  it('should render without crashing', () => {
    const { container } = render(
      <CustomAreaChart
        colorScheme={mockColorScheme}
        data={mockData}
        height={200}
        name="test-chart"
        valueFormatter={mockValueFormatter}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('should Area chart', () => {
    render(
      <CustomAreaChart
        colorScheme={mockColorScheme}
        data={mockData}
        height={200}
        name="test-chart"
        valueFormatter={mockValueFormatter}
      />
    );

    const areaChart = screen.getByText('Area');

    expect(areaChart).toBeInTheDocument();
  });
});
