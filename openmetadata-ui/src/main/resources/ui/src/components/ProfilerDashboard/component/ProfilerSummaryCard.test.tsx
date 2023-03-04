/*
 *  Copyright 2023 Collate.
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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { ProfilerSummaryCardProps } from '../profilerDashboard.interface';
import ProfilerSummaryCard from './ProfilerSummaryCard';

const mockProps: ProfilerSummaryCardProps = {
  title: 'Profiler Summary Card',
  data: [
    { title: 'test1', value: 20 },
    { title: 'test2', value: 40 },
  ],
};

jest.mock('../../common/TestIndicator/TestIndicator', () => {
  return jest
    .fn()
    .mockImplementation(({ value }) => (
      <span data-testid="test-indicator">{value}</span>
    ));
});

describe('ProfilerSummaryCard test', () => {
  it('Component should render', async () => {
    const firstRecord = mockProps.data[0];
    await act(async () => {
      render(<ProfilerSummaryCard {...mockProps} />);
    });
    const title = await screen.findByTestId('summary-card-title');
    const profileSummaryContainer = await screen.findByTestId(
      'table-profiler-summary'
    );
    const summaryCard = await screen.findAllByTestId('overall-summary-card');

    expect(title).toBeInTheDocument();
    expect(title.textContent).toEqual(mockProps.title);
    expect(profileSummaryContainer).toBeInTheDocument();
    expect(summaryCard).toHaveLength(mockProps.data.length);
    expect(summaryCard[0].textContent).toEqual(
      `${firstRecord.title}${firstRecord.value}`
    );
  });

  it('If showIndicator is true value should display in TestIndicator component', async () => {
    const firstRecord = mockProps.data[0];
    await act(async () => {
      render(<ProfilerSummaryCard showIndicator {...mockProps} />);
      const testIndicator = await screen.findAllByTestId('test-indicator');

      expect(testIndicator).toHaveLength(mockProps.data.length);
      expect(testIndicator[0].textContent).toEqual(`${firstRecord.value}`);
    });
  });
});
