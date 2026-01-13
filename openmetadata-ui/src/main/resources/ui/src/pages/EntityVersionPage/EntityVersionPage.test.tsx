/*
 *  Copyright 2022 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import EntityVersionPage from './EntityVersionPage.component';

let mockParams = {
  entityType: 'table',
  version: '0.1',
  fqn: 'bigquery_gcp.shopify.raw_product_catalog',
};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParams),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock(
  '../../components/Database/TableVersion/TableVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>TableVersion component</div>);
  }
);
jest.mock(
  '../../components/Dashboard/DashboardVersion/DashboardVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>DashboardVersion component</div>);
  }
);
jest.mock(
  '../../components/Pipeline/PipelineVersion/PipelineVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>PipelineVersion component</div>);
  }
);
jest.mock('../../components/Topic/TopicVersion/TopicVersion.component', () => {
  return jest.fn().mockReturnValue(<div>TopicVersion component</div>);
});
jest.mock(
  '../../components/MlModel/MlModelVersion/MlModelVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>MlModelVersion component</div>);
  }
);
jest.mock(
  '../../components/Container/ContainerVersion/ContainerVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>ContainerVersion component</div>);
  }
);

jest.mock(
  '../../components/Dashboard/DataModel/DataModelVersion/DataModelVersion.component',
  () => {
    return jest.fn().mockReturnValue(<div>DataModelVersion component</div>);
  }
);

jest.mock('../../rest/dashboardAPI', () => ({
  getDashboardByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  getDashboardVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getDashboardVersions: jest.fn().mockImplementation(() => Promise.resolve({})),
}));
jest.mock('../../rest/pipelineAPI', () => ({
  getPipelineByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  getPipelineVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getPipelineVersions: jest.fn().mockImplementation(() => Promise.resolve({})),
}));
jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
  getTableVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getTableVersions: jest.fn().mockImplementation(() => Promise.resolve({})),
}));
jest.mock('../../rest/topicsAPI', () => ({
  getTopicByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  getTopicVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getTopicVersions: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../rest/mlModelAPI', () => ({
  getMlModelByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
  getMlModelVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getMlModelVersions: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../rest/storageAPI', () => ({
  getContainerByName: jest.fn().mockImplementation(() => Promise.resolve({})),
  getContainerVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getContainerVersions: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('../../rest/dataModelsAPI', () => ({
  getDataModelByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  getDataModelVersion: jest.fn().mockImplementation(() => Promise.resolve({})),
  getDataModelVersionsList: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => ENTITY_PERMISSIONS),
  })),
}));

describe('Test EntityVersionPage component', () => {
  it('Checks if the TableVersion component renderst if respective data pass', async () => {
    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const tableVersion = await screen.findByText(/TableVersion component/i);

    expect(tableVersion).toBeInTheDocument();
  });

  it('Checks if the DashboardVersion component render if respective data pass', async () => {
    mockParams = {
      entityType: 'dashboard',
      version: '0.2',
      fqn: 'sample_superset.forecast_sales_performance',
    };

    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const DashboardVersion = await screen.findByText(
      /DashboardVersion component/i
    );

    expect(DashboardVersion).toBeInTheDocument();
  });

  it('Checks if the PipelineVersion component render if respective data pass', async () => {
    mockParams = {
      entityType: 'pipeline',
      version: '0.1',
      fqn: 'sample_airflow.snowflake_etl',
    };

    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const PipelineVersion = await screen.findByText(
      /PipelineVersion component/i
    );

    expect(PipelineVersion).toBeInTheDocument();
  });

  it('Checks if the TopicVersion component render if respective data pass', async () => {
    mockParams = {
      entityType: 'topic',
      version: '0.1',
      fqn: 'sample_kafka.sales',
    };

    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const TopicVersion = await screen.findByText(/TopicVersion component/i);

    expect(TopicVersion).toBeInTheDocument();
  });

  it('Should render the mlModel Version Component', async () => {
    mockParams = {
      entityType: 'mlmodel',
      version: '0.1',
      fqn: 'mlflow_svc.eta_predictions',
    };

    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const MlModelVersion = await screen.findByText(/MlModelVersion component/i);

    expect(MlModelVersion).toBeInTheDocument();
  });

  it('Should render the container Version Component', async () => {
    mockParams = {
      entityType: 'container',
      version: '0.1',
      fqn: 's3_storage_sample.transactions',
    };

    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const ContainerVersion = await screen.findByText(
      /ContainerVersion component/i
    );

    expect(ContainerVersion).toBeInTheDocument();
  });

  it('Should render the DataModel Version Component', async () => {
    mockParams = {
      entityType: 'dashboardDataModel',
      version: '0.1',
      fqn: 'data_model.sales',
    };

    await act(async () => {
      render(<EntityVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const ContainerVersion = await screen.findByText(
      /DataModelVersion component/i
    );

    expect(ContainerVersion).toBeInTheDocument();
  });
});
