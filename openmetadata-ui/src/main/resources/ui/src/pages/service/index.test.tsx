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
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ServicePage from './index';

const mockData = {
  description: '',
  href: 'link',
  id: 'd3b225a2-e4a2-4f4e-834e-b1c03112f139',
  jdbc: {
    connectionUrl:
      'postgresql+psycopg2://awsuser:focguC-kaqqe5-nepsok@redshift-cluster-1.clot5cqn1cnb.us-west-2.redshift.amazonaws.com:5439/warehouse',
    driverClass: 'jdbc',
  },
  name: 'aws_redshift',
  serviceType: 'Redshift',
};

const mockDatabase = {
  data: [
    {
      description: ' ',
      fullyQualifiedName: 'aws_redshift.information_schema',
      href: 'http://localhost:8585/api/v1/databases/c86f4fed-f259-43d8-b031-1ce0b7dd4e41',
      id: 'c86f4fed-f259-43d8-b031-1ce0b7dd4e41',
      name: 'information_schema',
      service: {
        description: '',
        href: 'http://localhost:8585/api/v1/services/databaseServices/d3b225a2-e4a2-4f4e-834e-b1c03112f139',
        id: 'd3b225a2-e4a2-4f4e-834e-b1c03112f139',
        name: 'aws_redshift',
        type: 'databaseService',
      },
      usageSummary: {
        date: '2021-08-04',
        dailyStats: { count: 0, percentileRank: 0 },
        monthlyStats: { count: 0, percentileRank: 0 },
        weeklyStats: { count: 0, percentileRank: 0 },
      },
    },
  ],
  paging: {
    after: null,
    before: null,
  },
};

jest.mock('../../axiosAPIs/serviceAPI', () => ({
  getServiceByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
  updateService: jest.fn(),
}));

jest.mock('../../axiosAPIs/databaseAPI', () => ({
  getDatabases: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockDatabase })),
  updateService: jest.fn(),
}));

jest.mock(
  '../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

jest.mock('../../utils/ServiceUtils', () => ({
  getFrequencyTime: jest.fn().mockReturnValue('FrequencyTime'),
  getServiceCategoryFromType: jest.fn().mockReturnValue('databaseServices'),
  serviceTypeLogo: jest.fn().mockReturnValue('img/path'),
}));

jest.mock(
  '../../components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<div>TitleBreadcrumb</div>);
  }
);

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<p>ModalWithMarkdownEditor</p>),
  })
);

describe('Test ServicePage Component', () => {
  it('Component should render', async () => {
    const { container } = render(<ServicePage />, {
      wrapper: MemoryRouter,
    });
    const servicePage = await findByTestId(container, 'service-page');
    const titleBreadcrumb = await findByText(container, /TitleBreadcrumb/i);
    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const descriptionData = await findByTestId(container, 'description-data');
    const descriptionEdit = await findByTestId(container, 'description-edit');

    expect(servicePage).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(descriptionData).toBeInTheDocument();
    expect(descriptionEdit).toBeInTheDocument();
  });

  it('Table should be visible if data is available', async () => {
    const { container } = render(<ServicePage />, {
      wrapper: MemoryRouter,
    });
    const tableContainer = await findByTestId(container, 'table-container');

    expect(tableContainer).toBeInTheDocument();
    expect(
      queryByText(container, /does not have any databases/i)
    ).not.toBeInTheDocument();
  });

  it('Number of column should be same as data received', async () => {
    const { container } = render(<ServicePage />, {
      wrapper: MemoryRouter,
    });
    const column = await findAllByTestId(container, 'column');

    expect(column.length).toBe(1);
  });

  it('on click of edit description icon ModalWithMarkdownEditor should open', async () => {
    const { container } = render(<ServicePage />, {
      wrapper: MemoryRouter,
    });

    const editIcon = await findByTestId(container, 'description-edit');

    fireEvent.click(editIcon);

    expect(
      await findByText(container, /ModalWithMarkdownEditor/i)
    ).toBeInTheDocument();
  });
});
