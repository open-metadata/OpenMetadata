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
import { DRAWER_NAVIGATION_OPTIONS } from 'utils/EntityUtils';
import { mockPipelineEntityDetails } from '../mocks/PipelineSummary.mock';
import PipelineSummary from './PipelineSummary.component';

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

describe('PipelineSummary component tests', () => {
  it('Component should render properly,  when loaded in the Explore page.', () => {
    render(<PipelineSummary entityDetails={mockPipelineEntityDetails} />, {
      wrapper: MemoryRouter,
    });

    const pipelineUrlLabel = screen.getByTestId('pipeline-url-label');
    const pipelineUrlValue = screen.getByTestId('pipeline-link-name');
    const tasksHeader = screen.getByTestId('tasks-header');
    const summaryList = screen.getByTestId('SummaryList');

    expect(pipelineUrlLabel).toBeInTheDocument();
    expect(pipelineUrlValue).toContainHTML(mockPipelineEntityDetails.name);
    expect(tasksHeader).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });

  it('Component should render properly, when loaded in the Lineage page.', async () => {
    const labels = [
      'pipeline-url-label',
      'label.pipeline label.url-uppercase-value',
      'label.service-label',
      'label.tier-label',
    ];

    const values = [
      'label.service-value',
      'label.owner-value',
      'label.tier-value',
    ];
    render(
      <PipelineSummary
        componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
        entityDetails={mockPipelineEntityDetails}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const schemaHeader = screen.getAllByTestId('schema-header');
    const tags = screen.getByText('label.tag-plural');
    const noTags = screen.getByText('label.no-tags-added');
    const pipelineName = screen.getAllByTestId('pipeline-link-name');

    const viewerContainer = screen.getByTestId('viewer-container');
    const summaryList = screen.getByTestId('SummaryList');
    const ownerLabel = screen.queryByTestId('label.owner-label');

    labels.forEach((label) =>
      expect(screen.getByTestId(label)).toBeInTheDocument()
    );
    values.forEach((value) =>
      expect(screen.getByTestId(value)).toBeInTheDocument()
    );

    expect(ownerLabel).not.toBeInTheDocument();

    expect(schemaHeader[0]).toBeInTheDocument();
    expect(tags).toBeInTheDocument();
    expect(pipelineName[0]).toBeInTheDocument();
    expect(noTags).toBeInTheDocument();

    expect(summaryList).toBeInTheDocument();
    expect(viewerContainer).toBeInTheDocument();
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

    const pipelineUrlValue = screen.getByTestId(
      'label.pipeline label.url-uppercase-value'
    );

    expect(pipelineUrlValue).toContainHTML('-');
  });
});
