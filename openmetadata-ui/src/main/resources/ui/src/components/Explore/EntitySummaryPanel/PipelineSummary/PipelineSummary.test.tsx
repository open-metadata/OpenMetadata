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
import { mockPipelineEntityDetails } from '../mocks/PipelineSummary.mock';
import PipelineSummary from './PipelineSummary.component';

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

describe('PipelineSummary component tests', () => {
  it('Component should render properly', () => {
    render(<PipelineSummary entityDetails={mockPipelineEntityDetails} />, {
      wrapper: MemoryRouter,
    });

    const pipelineTitle = screen.getByTestId('TableDataCardTitle');
    const pipelineUrlLabel = screen.getByTestId('pipeline-url-label');
    const pipelineUrlValue = screen.getByTestId('pipeline-link-name');
    const tasksHeader = screen.getByTestId('tasks-header');
    const summaryList = screen.getByTestId('SummaryList');

    expect(pipelineTitle).toBeInTheDocument();
    expect(pipelineUrlLabel).toBeInTheDocument();
    expect(pipelineUrlValue).toContainHTML(mockPipelineEntityDetails.name);
    expect(tasksHeader).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });

  it('If the pipeline url is not present in pipeline details, "-" should be displayed as pipeline url value', () => {
    render(
      <PipelineSummary
        entityDetails={{ ...mockPipelineEntityDetails, pipelineUrl: undefined }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const pipelineUrlValue = screen.getByTestId('pipeline-url-value');

    expect(pipelineUrlValue).toContainHTML('-');
  });
});
