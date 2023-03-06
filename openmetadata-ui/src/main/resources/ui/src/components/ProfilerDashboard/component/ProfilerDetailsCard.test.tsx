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

import { queryByAttribute, render, screen } from '@testing-library/react';
import { MOCK_CHART_COLLECTION_DATA } from 'mocks/TestSuite.mock';
import React from 'react';
import { ProfilerDetailsCardProps } from '../profilerDashboard.interface';
import ProfilerDetailsCard from './ProfilerDetailsCard';

const mockProps: ProfilerDetailsCardProps = {
  chartCollection: MOCK_CHART_COLLECTION_DATA,
  name: 'rowCount',
};

jest.mock('./ProfilerLatestValue', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ProfilerLatestValue</div>;
  });
});
jest.mock('../../common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ErrorPlaceHolder</div>;
  });
});

describe('ProfilerDetailsCard Test', () => {
  it('Component should render', async () => {
    const { container } = render(<ProfilerDetailsCard {...mockProps} />);

    expect(
      await screen.findByTestId('profiler-details-card-container')
    ).toBeInTheDocument();
    expect(
      queryByAttribute('id', container, `${mockProps.name}_graph`)
    ).toBeInTheDocument();
  });

  it('No data should be rendered', async () => {
    render(
      <ProfilerDetailsCard
        {...mockProps}
        chartCollection={{
          data: [],
          information: [],
        }}
      />
    );

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });
});
