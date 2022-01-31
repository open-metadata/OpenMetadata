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
import { AirflowPipeline } from '../../generated/operations/pipelines/airflowPipeline';
import { mockIngestionWorkFlow } from '../../pages/IngestionPage/IngestionPage.mock';
import Ingestion from './Ingestion.component';

const mockPaging = {
  after: 'after',
  before: 'befor',
  total: 1,
};

const mockFunction = jest.fn();
const mockPaginghandler = jest.fn();
const mockDeleteIngestion = jest.fn();
const mockTriggerIngestion = jest
  .fn()
  .mockImplementation(() => Promise.resolve());

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock('../containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock('../common/searchbar/Searchbar', () => {
  return jest.fn().mockImplementation(() => <div>Searchbar</div>);
});

jest.mock('../common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});

jest.mock('../IngestionModal/IngestionModal.component', () => {
  return jest.fn().mockImplementation(() => <div>IngestionModal</div>);
});

jest.mock('../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockImplementation(() => <div>ConfirmationModal</div>);
});

describe('Test Ingestion page', () => {
  it('Page Should render', async () => {
    const { container } = render(
      <Ingestion
        addIngestion={mockFunction}
        deleteIngestion={mockDeleteIngestion}
        ingestionList={
          mockIngestionWorkFlow.data.data as unknown as AirflowPipeline[]
        }
        isRequiredDetailsAvailable={false}
        paging={mockPaging}
        pagingHandler={mockPaginghandler}
        serviceList={[]}
        triggerIngestion={mockTriggerIngestion}
        updateIngestion={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const ingestionPageContainer = await findByTestId(
      container,
      'ingestion-container'
    );
    const searchBox = await findByText(container, /Searchbar/i);
    const addIngestionButton = await findByTestId(
      container,
      'add-new-ingestion-button'
    );
    const ingestionTable = await findByTestId(container, 'ingestion-table');

    expect(ingestionPageContainer).toBeInTheDocument();
    expect(searchBox).toBeInTheDocument();
    expect(addIngestionButton).toBeInTheDocument();
    expect(ingestionTable).toBeInTheDocument();
  });

  it('Table should render necessary fields', async () => {
    const { container } = render(
      <Ingestion
        addIngestion={mockFunction}
        deleteIngestion={mockDeleteIngestion}
        ingestionList={
          mockIngestionWorkFlow.data.data as unknown as AirflowPipeline[]
        }
        isRequiredDetailsAvailable={false}
        paging={mockPaging}
        pagingHandler={mockPaginghandler}
        serviceList={[]}
        triggerIngestion={mockTriggerIngestion}
        updateIngestion={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const ingestionTable = await findByTestId(container, 'ingestion-table');
    const tableHeaderContainer = await findByTestId(container, 'table-header');
    const runButton = await findByTestId(container, 'run');
    const editButton = await findByTestId(container, 'edit');
    const deleteButton = await findByTestId(container, 'delete');
    const tableHeaders: string[] = [];

    tableHeaderContainer.childNodes.forEach(
      (node) => node.textContent && tableHeaders.push(node.textContent)
    );

    expect(ingestionTable).toBeInTheDocument();
    expect(tableHeaderContainer).toBeInTheDocument();
    expect(tableHeaders.length).toBe(6);
    expect(tableHeaders).toStrictEqual([
      'Name',
      'Type',
      'Service',
      'Schedule',
      'Recent Runs',
      'Actions',
    ]);
    expect(runButton).toBeInTheDocument();
    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('Pagination should be render if paging is provided', async () => {
    const mockPagingAfter = {
      after: 'afterKey',
      before: 'beforeKey',
    };
    const { container } = render(
      <Ingestion
        addIngestion={mockFunction}
        deleteIngestion={mockDeleteIngestion}
        ingestionList={
          mockIngestionWorkFlow.data.data as unknown as AirflowPipeline[]
        }
        isRequiredDetailsAvailable={false}
        paging={mockPagingAfter}
        pagingHandler={mockPaginghandler}
        serviceList={[]}
        triggerIngestion={mockTriggerIngestion}
        updateIngestion={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const nextPrevious = await findByText(container, /NextPrevious/i);

    expect(nextPrevious).toBeInTheDocument();
  });

  it('CTA should work', async () => {
    const mockPagingAfter = {
      after: 'afterKey',
      before: 'beforeKey',
    };

    const { container } = render(
      <Ingestion
        addIngestion={mockFunction}
        deleteIngestion={mockDeleteIngestion}
        ingestionList={
          mockIngestionWorkFlow.data.data as unknown as AirflowPipeline[]
        }
        isRequiredDetailsAvailable={false}
        paging={mockPagingAfter}
        pagingHandler={mockPaginghandler}
        serviceList={[]}
        triggerIngestion={mockTriggerIngestion}
        updateIngestion={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    // on click of add ingestion
    const addIngestionButton = await findByTestId(
      container,
      'add-new-ingestion-button'
    );
    fireEvent.click(addIngestionButton);

    expect(await findByText(container, /IngestionModal/i)).toBeInTheDocument();

    (await findByText(container, /IngestionModal/i)).remove();

    // on click of run button

    const runButton = await findByTestId(container, 'run');
    fireEvent.click(runButton);

    expect(mockTriggerIngestion).toBeCalled();

    // on click of edit button

    const editButton = await findByTestId(container, 'edit');
    fireEvent.click(editButton);

    expect(await findByText(container, /IngestionModal/i)).toBeInTheDocument();

    (await findByText(container, /IngestionModal/i)).remove();

    // on click of delete button

    const deleteButton = await findByTestId(container, 'delete');
    fireEvent.click(deleteButton);

    expect(
      await findByText(container, /ConfirmationModal/i)
    ).toBeInTheDocument();

    (await findByText(container, /ConfirmationModal/i)).remove();
  });
});
