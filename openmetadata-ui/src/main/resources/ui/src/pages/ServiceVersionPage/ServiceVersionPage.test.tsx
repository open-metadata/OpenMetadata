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
import { useParams } from 'react-router-dom';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import {
  MOCK_DATABASE_SERVICE,
  MOCK_VERSIONS_LIST,
} from '../../mocks/Service.mock';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import ServiceVersionPage from './ServiceVersionPage';

const mockParams = {
  serviceCategory: 'databaseServices',
  version: '1.2',
  fqn: 'sample_data',
};
const mockNavigate = jest.fn();
const mockOtherData = { data: [], paging: {} };

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockImplementation(() => mockParams),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: '/service/databaseServices/sample_data/versions/1.2',
    search: '',
    hash: '',
    state: null,
  })),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ))
);

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  EmptyPlaceholder: jest
    .fn()
    .mockImplementation(() => <div>ErrorPlaceHolder</div>),
}));

jest.mock(
  '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockImplementation(() => <div>DataAssetsVersionHeader</div>)
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () =>
    jest.fn().mockImplementation(({ versionHandler, onBack }) => (
      <div>
        EntityVersionTimeLine
        <div role="presentation" onClick={() => versionHandler('0.7')}>
          versionHandler
        </div>
        <div role="presentation" onClick={onBack}>
          onBack
        </div>
      </div>
    ))
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('./ServiceVersionMainTabContent', () =>
  jest.fn().mockImplementation(() => <div>ServiceVersionMainTabContent</div>)
);

// The resource-level `permissions.database`/`permissions.dashboard` reads (used to decide
// whether to request USAGE_SUMMARY for the listed sibling entities) are untouched by this
// conversion — still sourced from usePermissionProvider(). Only the service entity's own
// view-version permission moves to useEntityPermissions (Task 8 Batch 10); mock the hook
// directly, mirroring DataModelPage.test.tsx's approach.
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      database: { ViewAll: true, EditAll: true },
      dashboard: { ViewAll: true, EditAll: true },
    },
  })),
}));

const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = ENTITY_PERMISSIONS,
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

// Sticky base default (granted), established before any test renders — individual tests
// below override it explicitly via setMockPermissions(...) where they need a different
// value.
setMockPermissions();

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockImplementation(() => MOCK_DATABASE_SERVICE),
  getServiceVersionData: jest
    .fn()
    .mockImplementation(() => MOCK_DATABASE_SERVICE),
  getServiceVersions: jest.fn().mockImplementation(() => MOCK_VERSIONS_LIST),
}));

jest.mock('../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn().mockImplementation(() => mockOtherData),
}));

jest.mock('../../rest/databaseAPI', () => ({
  getDatabases: jest.fn().mockImplementation(() => mockOtherData),
}));

jest.mock('../../rest/mlModelAPI', () => ({
  getMlModels: jest.fn().mockImplementation(() => mockOtherData),
}));

jest.mock('../../rest/pipelineAPI', () => ({
  getPipelines: jest.fn().mockImplementation(() => mockOtherData),
}));

jest.mock('../../rest/storageAPI', () => ({
  getContainers: jest.fn().mockImplementation(() => mockOtherData),
}));

jest.mock('../../rest/topicsAPI', () => ({
  getTopics: jest.fn().mockImplementation(() => mockOtherData),
}));

describe('ServiceVersionPage tests', () => {
  // Old code used mockImplementationOnce for the deny-permission tests, which automatically
  // reverted to the granted base after that ONE getEntityPermissionByFqn call. The mocked
  // hook here is called on every render (and twice per render is not the shape, but many
  // times across a test's lifetime), so setMockPermissions' sticky mockReturnValue would
  // otherwise leak a deny override into later tests — reset to granted before each test.
  beforeEach(() => {
    setMockPermissions();
  });

  it('Component should render properly for databaseServices while having view permissions', async () => {
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      screen.getByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(screen.getByText('EntityVersionTimeLine')).toBeInTheDocument();
  });

  it('Correct version should reflect in the URL while changing versions form EntityVersionTimeline', async () => {
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    const versionHandler = await screen.findByText('versionHandler');

    versionHandler.click();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/service/databaseServices/sample_data/versions/0.7'
    );
  });

  it('Closing the version page should redirect to the service details page', async () => {
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    const onBack = await screen.findByText('onBack');

    onBack.click();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/service/databaseServices/sample_data'
    );
  });

  it('Component should render properly in case of only ViewBasic permissions', async () => {
    setMockPermissions({ ViewAll: false, ViewBasic: true });

    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });

  it('Error placeholder should be displayed in case of no view permissions', async () => {
    setMockPermissions({ ViewAll: false, ViewBasic: false });

    render(<ServiceVersionPage />);

    // No synchronous "still loading" assertion here (unlike the other tests): with a denied
    // view permission, fetchVersionsList never runs, so nothing keeps `isLoading` true past
    // the mocked hook's own (synchronous) resolution — the old imperative fetch had a real
    // microtask gap the mock doesn't reproduce (Task 8 Batch 7 TeamsPage precedent). The
    // denied-permission behavior itself is still fully covered by the assertion below.
    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('Component should render properly for messagingServices', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      ...mockParams,
      serviceCategory: 'messagingServices',
    }));
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });

  it('Component should render properly for dashboardServices', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      ...mockParams,
      serviceCategory: 'dashboardServices',
    }));
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });

  it('Component should render properly for pipelineServices', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      version: '1.2',
      fqn: 'sample_data',
      serviceCategory: 'pipelineServices',
    }));
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });

  it('Component should render properly for storageServices', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      version: '1.2',
      fqn: 'sample_data',
      serviceCategory: 'storageServices',
    }));
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });

  it('Component should render properly for mlmodelServices', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      version: '1.2',
      fqn: 'sample_data',
      serviceCategory: 'mlmodelServices',
    }));
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ServiceVersionMainTabContent')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });

  it('Only basic information should be rendered for metadataServices', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      version: '1.2',
      fqn: 'sample_data',
      serviceCategory: 'metadataServices',
    }));
    render(<ServiceVersionPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();

    expect(
      await screen.findByText('DataAssetsVersionHeader')
    ).toBeInTheDocument();
    expect(screen.queryByText('ServiceVersionMainTabContent')).toBeNull();
    expect(
      await screen.findByText('EntityVersionTimeLine')
    ).toBeInTheDocument();
  });
});
