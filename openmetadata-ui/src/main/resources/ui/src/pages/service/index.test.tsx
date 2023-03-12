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

import {
  act,
  findByTestId,
  findByText,
  queryByTestId,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getCurrentServiceTab } from '../../utils/ServiceUtils';
import ServicePage from './index';
import {
  CONTAINERS_DATA,
  DASHBOARD_DATA,
  mockData,
  mockDatabase,
  mockTabs,
} from './mocks/servicePage.mock';

let mockParams = {
  serviceFQN: 'bigquery_gcp',
  serviceType: 'BigQuery',
  serviceCategory: 'databaseServices',
  tab: 'databases',
};

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  },
}));

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

jest.mock('rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
        paging: { total: 0 },
      },
    })
  ),
  checkAirflowStatus: jest.fn().mockImplementation(() => {
    Promise.resolve();
  }),
  deployIngestionPipelineById: jest.fn().mockImplementation(() => {
    Promise.resolve();
  }),
  deleteIngestionPipelineById: jest.fn().mockImplementation(() => {
    Promise.resolve();
  }),
  enableDisableIngestionPipelineById: jest.fn().mockImplementation(() => {
    Promise.resolve();
  }),
  triggerIngestionPipelineById: jest.fn().mockImplementation(() => {
    Promise.resolve();
  }),
}));

jest.mock('rest/miscAPI', () => ({
  fetchAirflowConfig: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/mlModelAPI', () => ({
  getMlmodels: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/pipelineAPI', () => ({
  getPipelines: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/topicsAPI', () => ({
  getTopics: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/dashboardAPI', () => ({
  getDashboards: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: DASHBOARD_DATA,
      paging: {
        after: null,
        before: null,
      },
    })
  ),
}));

jest.mock('rest/objectStoreAPI', () => ({
  getContainers: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: CONTAINERS_DATA,
      paging: {
        after: null,
        before: null,
      },
    })
  ),
}));

jest.mock('rest/serviceAPI', () => ({
  getServiceByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockData)),
  updateService: jest.fn().mockImplementation(() => Promise.resolve()),
  TestConnection: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/databaseAPI', () => ({
  getDatabases: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ ...mockDatabase })),
}));

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<div>RichTextEditorPreviewer</div>);
});

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    )),
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="PageContainer">{children}</div>
    ));
});

jest.mock('../../utils/ServiceUtils', () => ({
  getCurrentServiceTab: jest.fn().mockImplementation(() => 1),
  getIsIngestionEnable: jest.fn().mockReturnValue(true),
  servicePageTabs: jest.fn().mockReturnValue([
    {
      name: 'Databases',
      path: 'databases',
      field: 'databases',
    },
    {
      name: 'Ingestions',
      path: 'ingestions',
    },
    {
      name: 'Connection',
      path: 'connection',
    },
  ]),
  getServiceRouteFromServiceType: jest.fn().mockReturnValue('/database'),
  getServiceCategoryFromType: jest.fn().mockReturnValue('databaseServices'),
  getResourceEntityFromServiceCategory: jest
    .fn()
    .mockReturnValue('databaseServices'),
  serviceTypeLogo: jest.fn().mockReturnValue('img/path'),
  isRequiredDetailsAvailableForIngestion: jest.fn().mockReturnValue(true),
  getDeleteEntityMessage: jest.fn().mockReturnValue('Delete message'),
  shouldTestConnection: jest.fn().mockReturnValue(true),
  getCountLabel: jest.fn().mockReturnValue('Dashboards'),
  getServicePageTabs: jest.fn().mockImplementation(() => mockTabs),
}));

jest.mock(
  'components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<div>TitleBreadcrumb</div>);
  }
);

jest.mock('components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<div>Description_component</div>);
});

jest.mock('components/common/TabsPane/TabsPane', () => {
  return jest.fn().mockReturnValue(<div>TabsPane_component</div>);
});

jest.mock(
  'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<div>ModalWithMarkdownEditor</div>),
  })
);

jest.mock('components/common/EntitySummaryDetails/EntitySummaryDetails', () =>
  jest.fn().mockReturnValue(<div>EntitySummaryDetails</div>)
);

jest.mock('components/ServiceConfig/ServiceConfig', () => {
  return jest.fn().mockReturnValue(<div>ServiceConfig</div>);
});

jest.mock('components/common/entityPageInfo/ManageButton/ManageButton', () => {
  return jest.fn().mockReturnValue(<div>ManageButton</div>);
});
jest.mock('components/Ingestion/Ingestion.component', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="ingestions">Ingestion</div>);
});

jest.mock(
  'components/ServiceConnectionDetails/ServiceConnectionDetails.component',
  () => {
    return jest
      .fn()
      .mockReturnValue(
        <div data-testid="service-connections">ServiceConnectionDetails</div>
      );
  }
);

jest.mock('components/Tag/TagsViewer/tags-viewer', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="tag-viewer">Tag Viewer</div>);
});

jest.mock('components/common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(({ name }) => {
    return <div data-testid={`${name}-profile`}>{name}</div>;
  });
});

jest.mock('../../utils/TableUtils', () => ({
  getEntityLink: jest.fn(),
  getUsagePercentile: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('Test ServicePage Component', () => {
  it('Component should render', async () => {
    const { container } = render(<ServicePage />, {
      wrapper: MemoryRouter,
    });

    await act(async () => {
      const servicePage = await findByTestId(container, 'service-page');
      const titleBreadcrumb = await findByText(container, /TitleBreadcrumb/i);
      const descriptionContainer = await findByTestId(
        container,
        'description-container'
      );
      const description = await findByText(container, /Description_component/i);
      const tabPane = await findByText(container, /TabsPane_component/i);
      const tableContainer = await findByTestId(container, 'table-container');

      expect(servicePage).toBeInTheDocument();
      expect(titleBreadcrumb).toBeInTheDocument();
      expect(descriptionContainer).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(tabPane).toBeInTheDocument();
      expect(tableContainer).toBeInTheDocument();
    });
  });

  it('Should render the service children table rows', async () => {
    render(<ServicePage />, {
      wrapper: MemoryRouter,
    });
    const tableContainer = await screen.findByTestId('service-children-table');

    expect(tableContainer).toBeInTheDocument();

    const rows = await screen.findAllByTestId('row');

    expect(rows).toHaveLength(1);
  });

  it('Should render the owner name and profile pic if child has owner', async () => {
    render(<ServicePage />, {
      wrapper: MemoryRouter,
    });
    const tableContainer = await screen.findByTestId('service-children-table');

    expect(tableContainer).toBeInTheDocument();

    const rows = await screen.findAllByTestId('row');

    const firstRow = rows[0];

    const ownerData = await findByTestId(firstRow, 'owner-data');

    expect(ownerData).toBeInTheDocument();

    // owner profile pic
    expect(
      await findByTestId(ownerData, 'Compute-profile')
    ).toBeInTheDocument();

    // owner name
    expect(
      await findByTestId(ownerData, 'Compute-owner-name')
    ).toBeInTheDocument();
  });

  it('Should render the ingestion component', async () => {
    mockParams = { ...mockParams, tab: 'ingestions' };

    (getCurrentServiceTab as jest.Mock).mockImplementationOnce(() => 2);

    await act(async () => {
      render(<ServicePage />, {
        wrapper: MemoryRouter,
      });
    });

    const ingestionContainer = await screen.findByText(
      'message.airflow-guide-message'
    );

    expect(ingestionContainer).toBeInTheDocument();
  });

  it('Should render the connection component', async () => {
    mockParams = { ...mockParams, tab: 'connection' };

    (getCurrentServiceTab as jest.Mock).mockImplementationOnce(() => 3);

    await act(async () => {
      render(<ServicePage />, {
        wrapper: MemoryRouter,
      });
    });

    const connectionContainer = await screen.findByTestId(
      'service-connections'
    );

    const editButton = await screen.findByTestId('edit-connection-button');
    const testButton = screen.queryByTestId('test-connection-button');

    expect(connectionContainer).toBeInTheDocument();

    expect(editButton).toBeInTheDocument();

    expect(testButton).not.toBeInTheDocument();
  });

  it('Should render the dashboards and child components', async () => {
    mockParams = {
      serviceFQN: 'sample_superset',
      serviceType: 'Superset',
      serviceCategory: 'dashboardServices',
      tab: 'dashboards',
    };

    await act(async () => {
      render(<ServicePage />, {
        wrapper: MemoryRouter,
      });
    });

    const tableContainer = await screen.findByTestId('service-children-table');

    expect(tableContainer).toBeInTheDocument();

    const rows = await screen.findAllByTestId('row');

    expect(rows).toHaveLength(3);

    const firstRow = rows[0];
    const secondRow = rows[1];

    // first row test
    const ownerData = await findByTestId(firstRow, 'owner-data');

    expect(ownerData).toBeInTheDocument();

    // owner profile pic
    expect(
      await findByTestId(ownerData, 'Compute-profile')
    ).toBeInTheDocument();

    // owner name
    expect(
      await findByTestId(ownerData, 'Compute-owner-name')
    ).toBeInTheDocument();

    const tagContainer = await findByTestId(firstRow, 'record-tags');

    expect(tagContainer).toBeInTheDocument();

    // should render tag viewer as it has tags
    expect(await findByTestId(tagContainer, 'tag-viewer')).toBeInTheDocument();

    // second row test

    const noOwnerData = await findByTestId(secondRow, 'no-owner-text');

    expect(noOwnerData).toBeInTheDocument();

    const secondRowTagContainer = await findByTestId(secondRow, 'record-tags');

    expect(secondRowTagContainer).toBeInTheDocument();

    // should not render tag viewer as it does not have tags
    expect(queryByTestId(secondRowTagContainer, 'tag-viewer')).toBeNull();
  });

  it('Should render the containers and child components', async () => {
    mockParams = {
      serviceFQN: 's3_object_store_sample',
      serviceType: 'S3',
      serviceCategory: 'objectstoreServices',
      tab: 'containers',
    };

    await act(async () => {
      render(<ServicePage />, {
        wrapper: MemoryRouter,
      });
    });

    const tableContainer = await screen.findByTestId('service-children-table');

    expect(tableContainer).toBeInTheDocument();

    const rows = await screen.findAllByTestId('row');

    expect(rows).toHaveLength(7);

    const firstRow = rows[0];
    const secondRow = rows[1];

    // first row test
    const ownerData = await findByTestId(firstRow, 'owner-data');

    expect(ownerData).toBeInTheDocument();

    // owner profile pic
    expect(
      await findByTestId(ownerData, 'Compute-profile')
    ).toBeInTheDocument();

    // owner name
    expect(
      await findByTestId(ownerData, 'Compute-owner-name')
    ).toBeInTheDocument();

    const tagContainer = await findByTestId(firstRow, 'record-tags');

    expect(tagContainer).toBeInTheDocument();

    // should render tag viewer as it has tags
    expect(await findByTestId(tagContainer, 'tag-viewer')).toBeInTheDocument();

    // second row test

    const noOwnerData = await findByTestId(secondRow, 'no-owner-text');

    expect(noOwnerData).toBeInTheDocument();

    const secondRowTagContainer = await findByTestId(secondRow, 'record-tags');

    expect(secondRowTagContainer).toBeInTheDocument();

    // should not render tag viewer as it does not have tags
    expect(queryByTestId(secondRowTagContainer, 'tag-viewer')).toBeNull();
  });
});
