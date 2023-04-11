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
import userEvent from '@testing-library/user-event';
import React from 'react';
import EntitySummaryPanel from './EntitySummaryPanel.component';
import { mockDashboardEntityDetails } from './mocks/DashboardSummary.mock';
import { mockMlModelEntityDetails } from './mocks/MlModelSummary.mock';
import { mockPipelineEntityDetails } from './mocks/PipelineSummary.mock';
import { mockTableEntityDetails } from './mocks/TableSummary.mock';
import { mockTopicEntityDetails } from './mocks/TopicSummary.mock';

const mockHandleClosePanel = jest.fn();

jest.mock('./TableSummary/TableSummary.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="TableSummary">TableSummary</div>
    ))
);

jest.mock('./TopicSummary/TopicSummary.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="TopicSummary">TopicSummary</div>
    ))
);

jest.mock('./DashboardSummary/DashboardSummary.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="DashboardSummary">DashboardSummary</div>
    ))
);

jest.mock('./PipelineSummary/PipelineSummary.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="PipelineSummary">PipelineSummary</div>
    ))
);

jest.mock('./MlModelSummary/MlModelSummary.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="MlModelSummary">MlModelSummary</div>
    ))
);

jest.mock(
  'components/common/table-data-card-v2/TableDataCardTitle.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="table-data-card-title">TableDataCardTitle</div>
      ))
);

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ tab: 'table' })),
}));

describe('EntitySummaryPanel component tests', () => {
  it('TableSummary should render for table data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: mockTableEntityDetails,
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    const tableDataCardTitle = screen.getByText('TableDataCardTitle');
    const tableSummary = screen.getByTestId('TableSummary');
    const closeIcon = screen.getByTestId('summary-panel-close-icon');

    expect(tableDataCardTitle).toBeInTheDocument();
    expect(tableSummary).toBeInTheDocument();
    expect(closeIcon).toBeInTheDocument();

    await act(async () => {
      userEvent.click(closeIcon);
    });

    expect(mockHandleClosePanel).toHaveBeenCalledTimes(1);
  });

  it('TopicSummary should render for topics data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: mockTopicEntityDetails,
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    const topicSummary = screen.getByTestId('TopicSummary');
    const closeIcon = screen.getByTestId('summary-panel-close-icon');

    expect(topicSummary).toBeInTheDocument();
    expect(closeIcon).toBeInTheDocument();

    await act(async () => {
      userEvent.click(closeIcon);
    });

    expect(mockHandleClosePanel).toHaveBeenCalledTimes(1);
  });

  it('DashboardSummary should render for dashboard data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: mockDashboardEntityDetails,
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    const dashboardSummary = screen.getByTestId('DashboardSummary');
    const closeIcon = screen.getByTestId('summary-panel-close-icon');

    expect(dashboardSummary).toBeInTheDocument();
    expect(closeIcon).toBeInTheDocument();

    await act(async () => {
      userEvent.click(closeIcon);
    });

    expect(mockHandleClosePanel).toHaveBeenCalledTimes(1);
  });

  it('PipelineSummary should render for pipeline data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: mockPipelineEntityDetails,
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    const pipelineSummary = screen.getByTestId('PipelineSummary');
    const closeIcon = screen.getByTestId('summary-panel-close-icon');

    expect(pipelineSummary).toBeInTheDocument();
    expect(closeIcon).toBeInTheDocument();

    await act(async () => {
      userEvent.click(closeIcon);
    });

    expect(mockHandleClosePanel).toHaveBeenCalledTimes(1);
  });

  it('MlModelSummary should render for mlModel data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: { ...mockMlModelEntityDetails, entityType: 'mlmodel' },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    const mlModelSummary = screen.getByTestId('MlModelSummary');
    const closeIcon = screen.getByTestId('summary-panel-close-icon');

    expect(mlModelSummary).toBeInTheDocument();
    expect(closeIcon).toBeInTheDocument();

    await act(async () => {
      userEvent.click(closeIcon);
    });

    expect(mockHandleClosePanel).toHaveBeenCalledTimes(1);
  });
});
