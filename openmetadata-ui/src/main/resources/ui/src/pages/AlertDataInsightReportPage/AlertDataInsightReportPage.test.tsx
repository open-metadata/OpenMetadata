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
import { render, screen } from '@testing-library/react';
import React from 'react';
import AlertDataInsightReportPage from './AlertDataInsightReportPage';

describe('Test Alert Data Insights Report Page', () => {
  it('Should render the Loader Component', () => {
    render(<AlertDataInsightReportPage />);

    expect(
      screen.getByText('DataInsights Report Alert [WIP]')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Alert Received on the DataInsights are controlled with this.'
      )
    ).toBeInTheDocument();

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-info')).toBeInTheDocument();
    expect(screen.getByTestId('destination')).toBeInTheDocument();
    expect(screen.getByTestId('destination-card')).toBeInTheDocument();
  });
});
