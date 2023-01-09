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
import { MemoryRouter } from 'react-router-dom';
import {
  mockMlModelEntityDetails,
  mockMlModelEntityDetails1,
} from '../mocks/MlModelSummary.mock';
import MlModelSummary from './MlModelSummary.component';

jest.mock(
  '../../../common/table-data-card-v2/TableDataCardTitle.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="TableDataCardTitle">TableDataCardTitle</div>
      ))
);

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

describe('MlModelSummary component tests', () => {
  it('Component should render properly', () => {
    render(<MlModelSummary entityDetails={mockMlModelEntityDetails} />, {
      wrapper: MemoryRouter,
    });

    const mlModelTitle = screen.getByTestId('TableDataCardTitle');
    const algorithmLabel = screen.getByTestId('algorithm-label');
    const targetLabel = screen.getByTestId('target-label');
    const serverLabel = screen.getByTestId('server-label');
    const dashboardLabel = screen.getByTestId('dashboard-label');
    const algorithmValue = screen.getByTestId('algorithm-value');
    const targetValue = screen.getByTestId('target-value');
    const serverValue = screen.getByTestId('server-value');
    const dashboardValue = screen.getByTestId('dashboard-value');

    expect(mlModelTitle).toBeInTheDocument();
    expect(algorithmLabel).toBeInTheDocument();
    expect(targetLabel).toBeInTheDocument();
    expect(serverLabel).toBeInTheDocument();
    expect(dashboardLabel).toBeInTheDocument();
    expect(algorithmValue).toContainHTML('Neural Network');
    expect(targetValue).toContainHTML('ETA_time');
    expect(serverValue).toContainHTML('http://my-server.ai');
    expect(dashboardValue).toBeInTheDocument();
  });

  it('Fields with no data should display "-" in value', () => {
    render(<MlModelSummary entityDetails={mockMlModelEntityDetails1} />, {
      wrapper: MemoryRouter,
    });

    const algorithmLabel = screen.getByTestId('algorithm-label');
    const targetLabel = screen.queryByTestId('target-label');
    const serverLabel = screen.queryByTestId('server-label');
    const dashboardLabel = screen.queryByTestId('dashboard-label');
    const algorithmValue = screen.getByTestId('algorithm-value');
    const targetValue = screen.getByTestId('target-value');
    const serverValue = screen.getByTestId('server-value');
    const dashboardValue = screen.getByTestId('dashboard-value');

    expect(algorithmLabel).toBeInTheDocument();
    expect(targetLabel).toBeInTheDocument();
    expect(serverLabel).toBeInTheDocument();
    expect(dashboardLabel).toBeInTheDocument();
    expect(algorithmValue).toContainHTML('Time Series');
    expect(targetValue).toContainHTML('-');
    expect(serverValue).toContainHTML('-');
    expect(dashboardValue).toContainHTML('-');
  });
});
