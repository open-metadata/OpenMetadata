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
import { mockIngestionListTableProps } from '../../mocks/IngestionListTable.mock';
import IngestionListTable from './IngestionListTable.component';

jest.mock('../../components/common/next-previous/NextPrevious', () =>
  jest.fn().mockImplementation(() => <div>nextPrevious</div>)
);
jest.mock('../../components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>loader</div>)
);
jest.mock('./PipelineActions.component', () =>
  jest.fn().mockImplementation(() => <div>pipelineActions</div>)
);
jest.mock('./IngestionRecentRun/IngestionRecentRuns.component', () => ({
  IngestionRecentRuns: jest
    .fn()
    .mockImplementation(() => <div>ingestionRecentRuns</div>),
}));

describe('IngestionListTable tests', () => {
  it('Should display the loader if the isLoading is true', async () => {
    render(<IngestionListTable {...mockIngestionListTableProps} isLoading />);

    const loader = await screen.findByTestId('skeleton-table');

    expect(loader).toBeInTheDocument();
  });

  it('Should not display the loader if the isLoading is false', () => {
    render(
      <IngestionListTable {...mockIngestionListTableProps} isLoading={false} />
    );

    const ingestionListTable = screen.getByTestId('ingestion-list-table');
    const loader = screen.queryByText('loader');

    expect(ingestionListTable).toBeInTheDocument();
    expect(loader).toBeNull();
  });

  it('Should not display the loader if the isLoading is undefined', () => {
    render(
      <IngestionListTable
        {...mockIngestionListTableProps}
        isLoading={undefined}
      />
    );

    const ingestionListTable = screen.getByTestId('ingestion-list-table');
    const loader = screen.queryByText('loader');

    expect(ingestionListTable).toBeInTheDocument();
    expect(loader).toBeNull();
  });

  it('Should display NexPrevious component for list size more than 10 and paging object has after field', () => {
    render(
      <IngestionListTable
        {...mockIngestionListTableProps}
        paging={{
          total: 16,
          after: 'after',
        }}
      />
    );

    const nextPrevious = screen.getByText('nextPrevious');

    expect(nextPrevious).toBeInTheDocument();
  });

  it('Should not display NexPrevious component for list size less than 10', () => {
    render(
      <IngestionListTable
        {...mockIngestionListTableProps}
        paging={{
          total: 4,
        }}
      />
    );

    const nextPrevious = screen.queryByText('nextPrevious');

    expect(nextPrevious).toBeNull();
  });

  it('Should render the ingestion link if airflowEndpoint is provided', () => {
    render(<IngestionListTable {...mockIngestionListTableProps} />);

    const ingestionDagLink = screen.getByTestId('ingestion-dag-link');

    expect(ingestionDagLink).toBeInTheDocument();
  });

  it('Should not render the ingestion link if airflowEndpoint is not provided', () => {
    render(
      <IngestionListTable {...mockIngestionListTableProps} airflowEndpoint="" />
    );

    const ingestionDagLink = screen.queryByTestId('ingestion-dag-link');

    expect(ingestionDagLink).toBeNull();
  });
});
