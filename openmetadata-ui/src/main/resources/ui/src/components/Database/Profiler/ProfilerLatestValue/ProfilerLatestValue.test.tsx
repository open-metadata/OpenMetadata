/*
 *  Copyright 2022 Collate.
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
import { act } from 'react-test-renderer';
import { INITIAL_ROW_METRIC_VALUE } from '../../../../constants/profiler.constant';
import { ProfilerLatestValueProps } from '../ProfilerDashboard/profilerDashboard.interface';
import ProfilerLatestValue from './ProfilerLatestValue';

const mockProps: ProfilerLatestValueProps = {
  information: INITIAL_ROW_METRIC_VALUE.information.map((value) => ({
    ...value,
    latestValue: 10,
  })),
};

jest.mock('../../../../constants/constants', () => ({
  JSON_TAB_SIZE: 2,
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getStatisticsDisplayValue: jest.fn().mockImplementation(() => '10'),
}));

describe('ProfilerLatestValue component test', () => {
  it('Component should render', async () => {
    render(<ProfilerLatestValue {...mockProps} />);
    const container = await screen.findByTestId('data-summary-container');
    const title = await screen.findByTestId('title');
    const value = await screen.findByText('10');

    expect(container).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(value).toBeInTheDocument();
  });

  it('If tickFormatter provided, UI should render accordingly', async () => {
    render(<ProfilerLatestValue tickFormatter="%" {...mockProps} />);
    const value = await screen.findByText('10%');

    expect(value).toBeInTheDocument();
  });

  it('If stringValue is true, UI should render accordingly', async () => {
    const data = INITIAL_ROW_METRIC_VALUE.information.map((value) => ({
      ...value,
      latestValue: 'string value',
    }));
    render(<ProfilerLatestValue stringValue information={data} />);
    const value = await screen.findByText('string value');

    expect(value).toBeInTheDocument();
  });

  it('If no data provide nothing should render', async () => {
    act(() => {
      render(<ProfilerLatestValue information={[]} />);
    });
    const container = screen.queryByTestId('data-summary-container');
    const title = screen.queryByTestId('title');

    expect(container).not.toBeInTheDocument();
    expect(title).not.toBeInTheDocument();
  });
});
