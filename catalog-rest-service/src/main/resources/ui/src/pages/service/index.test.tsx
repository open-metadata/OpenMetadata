import {
  findAllByTestId,
  findByTestId,
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

describe('Test ServicePage Component', () => {
  it('Component should render', async () => {
    const { container } = render(<ServicePage />, {
      wrapper: MemoryRouter,
    });
    const servicePage = await findByTestId(container, 'service-page');

    expect(servicePage).toBeInTheDocument();
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
});
