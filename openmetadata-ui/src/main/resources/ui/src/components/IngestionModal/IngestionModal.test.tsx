/*
 *  Copyright 2021 Collate
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

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { PipelineType } from '../../generated/operations/pipelines/airflowPipeline';
import IngestionModal from './IngestionModal.component';

const mockFunction = jest.fn();
const mockServiceList = [
  {
    name: 'aws_redshift',
    serviceType: 'Redshift',
  },
];

jest.mock('../IngestionStepper/IngestionStepper.component', () => {
  return jest.fn().mockReturnValue(<p>IngestionStepper</p>);
});

describe('Test Ingestion modal component', () => {
  it('Component Should render', async () => {
    const { container } = render(
      <IngestionModal
        header="Add Ingestion"
        ingestionList={[]}
        ingestionTypes={[]}
        serviceList={mockServiceList}
        onCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const ingestionModalContainer = await findByTestId(
      container,
      'ingestion-modal-container'
    );
    const ingestionModalTitle = await findByTestId(container, 'modal-title');
    const closeSvgButton = await findByTestId(container, 'close-modal');
    const modalBody = await findByTestId(container, 'modal-body');
    const modalFooter = await findByTestId(container, 'modal-footer');
    const nextButton = await findByTestId(container, 'next-button');
    const previousButton = await findByTestId(container, 'previous-button');

    expect(ingestionModalContainer).toBeInTheDocument();
    expect(ingestionModalTitle).toBeInTheDocument();
    expect(closeSvgButton).toBeInTheDocument();
    expect(modalBody).toBeInTheDocument();
    expect(modalFooter).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(previousButton).toHaveClass('tw-invisible');
    expect(
      await findByText(container, /IngestionStepper/i)
    ).toBeInTheDocument();
  });

  it('Ingestion journey', async () => {
    const { container } = render(
      <IngestionModal
        addIngestion={mockFunction}
        header="Add Ingestion"
        ingestionList={[]}
        ingestionTypes={['metadata', 'queryUsage'] as PipelineType[]}
        service="bigquery_gcp"
        serviceList={[]}
        onCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    // Step 1
    const nextButton = await findByTestId(container, 'next-button');
    const previousButton = await findByTestId(container, 'previous-button');

    const name = await findByTestId(container, 'name');

    expect(name).toBeInTheDocument();
    expect(name).toHaveValue('bigquery_gcp_metadata'); // service name + 1st value of ingestionType

    const ingestionType = await findByTestId(container, 'ingestion-type');

    expect(ingestionType).toBeInTheDocument();
    expect(ingestionType).toHaveValue('metadata'); // 1st value of ingestionType

    const tableIncludeFilterPattern = await findByTestId(
      container,
      'table-include-filter-pattern'
    );
    fireEvent.change(tableIncludeFilterPattern, {
      target: { value: 'table-include-filter-pattern' },
    });

    expect(tableIncludeFilterPattern).toBeInTheDocument();
    expect(tableIncludeFilterPattern).toHaveValue(
      'table-include-filter-pattern'
    );

    const tableExcludeFilterPattern = await findByTestId(
      container,
      'table-exclude-filter-pattern'
    );
    fireEvent.change(tableExcludeFilterPattern, {
      target: { value: 'table-exclude-filter-pattern' },
    });

    expect(tableExcludeFilterPattern).toBeInTheDocument();
    expect(tableExcludeFilterPattern).toHaveValue(
      'table-exclude-filter-pattern'
    );

    const schemaIncludeFilterPattern = await findByTestId(
      container,
      'schema-include-filter-pattern'
    );
    fireEvent.change(schemaIncludeFilterPattern, {
      target: { value: 'schema-include-filter-pattern' },
    });

    expect(schemaIncludeFilterPattern).toBeInTheDocument();
    expect(schemaIncludeFilterPattern).toHaveValue(
      'schema-include-filter-pattern'
    );

    const schemaExcludeFilterPattern = await findByTestId(
      container,
      'schema-exclude-filter-pattern'
    );
    fireEvent.change(schemaExcludeFilterPattern, {
      target: { value: 'schema-exclude-filter-pattern' },
    });

    expect(schemaExcludeFilterPattern).toBeInTheDocument();
    expect(schemaExcludeFilterPattern).toHaveValue(
      'schema-exclude-filter-pattern'
    );

    const includeViews = await findByTestId(container, 'include-views');
    fireEvent.click(includeViews);

    expect(includeViews).toBeInTheDocument();
    expect(includeViews).not.toHaveClass('open');

    const dataProfiler = await findByTestId(container, 'data-profiler');
    fireEvent.click(dataProfiler);

    expect(dataProfiler).toBeInTheDocument();
    expect(dataProfiler).toHaveClass('open');

    const ingestSampleData = await findByTestId(
      container,
      'ingest-sample-data'
    );
    fireEvent.click(ingestSampleData);

    expect(ingestSampleData).toBeInTheDocument();
    expect(ingestSampleData).not.toHaveClass('open');

    fireEvent.click(nextButton);

    // Step 2
    expect(previousButton).toBeInTheDocument();

    const scheduleInterval = await findByTestId(container, 'schedule-interval');

    expect(scheduleInterval).toBeInTheDocument();

    const startDate = await findByTestId(container, 'start-date');
    const endDate = await findByTestId(container, 'end-date');

    expect(startDate).toBeInTheDocument();
    expect(endDate).toBeInTheDocument();

    fireEvent.click(nextButton);

    // Steps 4
    const preview = await findByTestId(container, 'preview-section');
    const deployButton = await findByTestId(container, 'deploy-button');

    expect(preview).toBeInTheDocument();
    expect(deployButton).toBeInTheDocument();

    fireEvent.click(deployButton);

    expect(mockFunction).toBeCalled();
  });
});
