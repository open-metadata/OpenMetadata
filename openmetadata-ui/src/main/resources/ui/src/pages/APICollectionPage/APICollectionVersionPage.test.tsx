/*
 *  Copyright 2026 Collate.
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
import { useParams } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { getApiCollectionByFQN } from '../../rest/apiCollectionsAPI';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import APICollectionVersionPage from './APICollectionVersionPage';

const ERROR_PLACEHOLDER = 'ErrorPlaceHolder';
const LOADER = 'Loader';
const DATA_ASSET_VERSION_HEADER = 'DataAssetsVersionHeader';
const ENTITY_VERSION_TIMELINE = 'EntityVersionTimeLine';
const API_ENDPOINTS_TAB = 'APIEndpointsTab';
const CUSTOM_PROPERTY_TABLE = 'CustomPropertyTable';
const MOCK_FQN = 'sample_data.api.collection';

// This page fetches its own permissions (Task 8 Batch 9) via useEntityPermissions rather
// than an imperative usePermissionProvider().getEntityPermissionByFqn call — mock the hook
// directly, mirroring APICollectionPage.test.tsx's (the non-version sibling, converted
// earlier) setMockPermissions helper.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
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

jest.mock('../../rest/apiCollectionsAPI', () => ({
  getApiCollectionByFQN: jest.fn().mockResolvedValue({
    id: 'collection-id',
    fullyQualifiedName: 'sample_data.api.collection',
    service: { fullyQualifiedName: 'sample_data' },
  }),
  getApiCollectionVersion: jest.fn().mockResolvedValue({}),
  getApiCollectionVersions: jest
    .fn()
    .mockResolvedValue({ entityType: 'apiCollection', versions: [] }),
}));

jest.mock('../../rest/apiEndpointsAPI', () => ({
  getApiEndPoints: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'sample_data.api.collection' }),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    paging: {},
    pageSize: 10,
    currentPage: 1,
    handlePagingChange: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: false,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
  useParams: jest.fn().mockReturnValue({ version: '0.2', tab: 'apiEndpoint' }),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>{ERROR_PLACEHOLDER}</div>)
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>{LOADER}</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () =>
    jest
      .fn()
      .mockImplementation(({ onVersionClick }) => (
        <button onClick={onVersionClick}>{DATA_ASSET_VERSION_HEADER}</button>
      ))
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () =>
    jest
      .fn()
      .mockImplementation(({ versionHandler }) => (
        <button onClick={versionHandler}>{ENTITY_VERSION_TIMELINE}</button>
      ))
);

jest.mock(
  '../../components/DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => jest.fn().mockImplementation(() => <div>DataProductsContainer</div>)
);

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest
    .fn()
    .mockImplementation(({ name }: { name: string }) => <div>{name}</div>)
);

jest.mock('../../components/common/EntityDescription/Description', () =>
  jest.fn().mockImplementation(() => <div>Description</div>)
);

const mockCustomPropertyTable = jest.fn();
jest.mock(
  '../../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({
    CustomPropertyTable: (props: { hasPermission: boolean }) => {
      mockCustomPropertyTable(props);

      return <div>{CUSTOM_PROPERTY_TABLE}</div>;
    },
  })
);

jest.mock('./APIEndpointsTab', () =>
  jest.fn().mockImplementation(() => <div>{API_ENDPOINTS_TAB}</div>)
);

jest.mock(
  '../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    GenericProvider: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../utils/EntityVersionUtilsPure', () => ({
  getBasicEntityInfoFromVersionData: jest.fn().mockReturnValue({}),
  getCommonDiffsFromVersionData: jest.fn().mockReturnValue({}),
  getCommonExtraInfoForVersionDetails: jest.fn().mockReturnValue({}),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('APICollectionVersionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ViewAll: true, ViewCustomFields: true });
  });

  it('should call useEntityPermissions with the API_COLLECTION resource and current fqn', async () => {
    await act(async () => {
      render(<APICollectionVersionPage />);
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.API_COLLECTION,
      MOCK_FQN,
      expect.objectContaining({ enabled: true })
    );
    expect(getApiCollectionByFQN).toHaveBeenCalled();
  });

  it('should render the version page when view access is granted', async () => {
    await act(async () => {
      render(<APICollectionVersionPage />);
    });

    expect(
      await screen.findByText(DATA_ASSET_VERSION_HEADER)
    ).toBeInTheDocument();
    expect(screen.getByText(ENTITY_VERSION_TIMELINE)).toBeInTheDocument();
    expect(screen.getByText(API_ENDPOINTS_TAB)).toBeInTheDocument();
  });

  it('should show ErrorPlaceHolder and skip fetching the collection when there is no view permission', async () => {
    setMockPermissions({});

    await act(async () => {
      render(<APICollectionVersionPage />);
    });

    expect(await screen.findByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
    expect(getApiCollectionByFQN).not.toHaveBeenCalled();
  });

  it('should show the Loader while permissions are still loading', async () => {
    setMockPermissions({}, { isLoading: true });

    await act(async () => {
      render(<APICollectionVersionPage />);
    });

    expect(screen.getByText(LOADER)).toBeInTheDocument();
    expect(getApiCollectionByFQN).not.toHaveBeenCalled();
  });

  it('should gate the CustomPropertyTable view access on canViewCustomFields', async () => {
    // canViewCustomFields is prioritized (field-specific ViewCustomFields wins over the
    // bare ViewAll used for the page-level view gate) — ViewAll true but ViewCustomFields
    // explicitly false must still deny the custom-properties tab's hasPermission prop.
    setMockPermissions({ ViewAll: true, ViewCustomFields: false });
    // mockReturnValue (not mockReturnValueOnce): useRequiredParams/useParams is read on
    // every render, not just the first — a "once" override reverts to the base
    // ('apiEndpoint') mock on the second render and the custom-properties pane never
    // becomes active.
    (useParams as jest.Mock).mockReturnValue({
      version: '0.2',
      tab: 'custom_properties',
    });

    await act(async () => {
      render(<APICollectionVersionPage />);
    });

    expect(await screen.findByText(CUSTOM_PROPERTY_TABLE)).toBeInTheDocument();
    expect(mockCustomPropertyTable).toHaveBeenCalledWith(
      expect.objectContaining({ hasPermission: false })
    );

    (useParams as jest.Mock).mockReturnValue({
      version: '0.2',
      tab: 'apiEndpoint',
    });
  });
});
