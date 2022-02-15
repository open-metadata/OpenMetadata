import { act, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import EntityVersionPage from './EntityVersionPage.component';

let mockParams = {
  entityType: 'table',
  version: '0.1',
  entityFQN: 'bigquery_gcp.shopify.raw_product_catalog',
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../components/DatasetVersion/DatasetVersion.component', () => {
  return jest.fn().mockReturnValue(<div>DatasetVersion component</div>);
});
jest.mock(
  '../../components/DashboardVersion/DashboardVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>DashboardVersion component</div>);
  }
);
jest.mock('../../components/PipelineVersion/PipelineVersion.component', () => {
  return jest.fn().mockReturnValue(<div>PipelineVersion component</div>);
});
jest.mock('../../components/TopicVersion/TopicVersion.component', () => {
  return jest.fn().mockReturnValue(<div>TopicVersion component</div>);
});

jest.mock('../../axiosAPIs/dashboardAPI', () => ({
  getDashboardByFqn: jest.fn().mockImplementation(() => Promise.resolve()),
  getDashboardVersion: jest.fn().mockImplementation(() => Promise.resolve()),
  getDashboardVersions: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../axiosAPIs/pipelineAPI', () => ({
  getPipelineByFqn: jest.fn().mockImplementation(() => Promise.resolve()),
  getPipelineVersion: jest.fn().mockImplementation(() => Promise.resolve()),
  getPipelineVersions: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../axiosAPIs/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
  getTableVersion: jest.fn().mockImplementation(() => Promise.resolve()),
  getTableVersions: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../axiosAPIs/topicsAPI', () => ({
  getTopicByFqn: jest.fn().mockImplementation(() => Promise.resolve()),
  getTopicVersion: jest.fn().mockImplementation(() => Promise.resolve()),
  getTopicVersions: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test EntityVersionPage component', () => {
  it('Checks if the DatasetVersion component renderst if respective data pass', () => {
    const { container } = render(<EntityVersionPage />, {
      wrapper: MemoryRouter,
    });

    act(async () => {
      const datasetVersion = await findByText(
        container,
        /DatasetVersion component/i
      );

      expect(datasetVersion).toBeInTheDocument();
    });
  });

  it('Checks if the DashboardVersion component renderst if respective data pass', () => {
    mockParams = {
      entityType: 'dashboard',
      version: '0.2',
      entityFQN: 'sample_superset.forecast_sales_performance',
    };

    const { container } = render(<EntityVersionPage />, {
      wrapper: MemoryRouter,
    });

    act(async () => {
      const DashboardVersion = await findByText(
        container,
        /DashboardVersion component/i
      );

      expect(DashboardVersion).toBeInTheDocument();
    });
  });

  it('Checks if the PipelineVersion component renderst if respective data pass', () => {
    mockParams = {
      entityType: 'pipeline',
      version: '0.1',
      entityFQN: 'sample_airflow.snowflake_etl',
    };

    const { container } = render(<EntityVersionPage />, {
      wrapper: MemoryRouter,
    });

    act(async () => {
      const PipelineVersion = await findByText(
        container,
        /PipelineVersion component/i
      );

      expect(PipelineVersion).toBeInTheDocument();
    });
  });

  it('Checks if the TopicVersion component renderst if respective data pass', () => {
    mockParams = {
      entityType: 'topic',
      version: '0.1',
      entityFQN: 'sample_kafka.sales',
    };

    const { container } = render(<EntityVersionPage />, {
      wrapper: MemoryRouter,
    });

    act(async () => {
      const TopicVersion = await findByText(
        container,
        /TopicVersion component/i
      );

      expect(TopicVersion).toBeInTheDocument();
    });
  });
});
