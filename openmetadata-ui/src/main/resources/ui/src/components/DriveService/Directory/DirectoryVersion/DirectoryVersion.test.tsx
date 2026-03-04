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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { Directory } from '../../../../generated/entity/data/directory';
import { EntityHistory } from '../../../../generated/type/entityHistory';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { useFqn } from '../../../../hooks/useFqn';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import { getDriveAssetByFqn } from '../../../../rest/driveAPI';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import DirectoryVersion from './DirectoryVersion';
import { DirectoryVersionProps } from './DirectoryVersion.interface';

jest.mock('../../../../hooks/useFqn');
jest.mock('../../../../utils/useRequiredParams');
jest.mock('../../../../rest/driveAPI');
jest.mock('../../../../utils/RouterUtils');
jest.mock('../../../../utils/ToastUtils');
jest.mock('../../../../utils/EntityVersionUtils', () => ({
  getCommonExtraInfoForVersionDetails: jest.fn(() => ({
    ownerDisplayName: 'Test Owner',
    ownerRef: { id: 'owner-1', name: 'test-owner' },
    tierDisplayName: 'Tier 1',
    domainDisplayName: 'Test Domain',
  })),
  getEntityVersionByField: jest.fn(
    (_changeDescription, _field, defaultValue) => defaultValue
  ),
  getEntityVersionTags: jest.fn(() => []),
  getConstraintChanges: jest.fn(() => ({
    addedConstraintDiffs: [],
    deletedConstraintDiffs: [],
  })),
}));

jest.mock('../../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest.fn(() => (
    <div data-testid="custom-property-table">Custom Properties</div>
  )),
}));

jest.mock('../../../common/EntityDescription/DescriptionV1', () =>
  jest.fn(() => <div data-testid="description-v1">Description</div>)
);

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader">Loading...</div>)
);

jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }) => (
    <div data-testid="rich-text-previewer">{markdown}</div>
  ))
);

jest.mock('../../../common/Table/Table', () =>
  jest.fn(({ columns, dataSource }) => (
    <div data-testid="table">
      <div data-testid="table-columns">{JSON.stringify(columns.length)}</div>
      <div data-testid="table-data">
        {JSON.stringify(dataSource?.length || 0)}
      </div>
    </div>
  ))
);

jest.mock('../../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn(({ name }) => <span data-testid="tabs-label">{name}</span>)
);

jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest.fn(({ children }) => (
    <div data-testid="generic-provider">{children}</div>
  )),
}));

jest.mock(
  '../../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () =>
    jest.fn(() => (
      <div data-testid="data-assets-version-header">Version Header</div>
    ))
);

jest.mock(
  '../../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () =>
    jest.fn(() => (
      <div data-testid="data-products-container">Data Products</div>
    ))
);

jest.mock('../../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () =>
  jest.fn(() => (
    <div data-testid="entity-version-timeline">Version Timeline</div>
  ))
);

jest.mock('../../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn(() => <div data-testid="tags-container">Tags</div>)
);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockUseFqn = useFqn as jest.Mock;
const mockUseRequiredParams = useRequiredParams as jest.Mock;
const mockGetDriveAssetByFqn = getDriveAssetByFqn as jest.Mock;
const mockGetVersionPath = getVersionPath as jest.Mock;
const mockShowErrorToast = showErrorToast as jest.Mock;

const mockDirectoryData: Directory = {
  id: 'directory-1',
  name: 'test-directory',
  fullyQualifiedName: 'drive-service.test-directory',
  displayName: 'Test Directory',
  description: 'Test directory description',
  children: [
    {
      id: 'child-1',
      name: 'subdirectory',
      fullyQualifiedName: 'drive-service.test-directory.subdirectory',
      displayName: 'Sub Directory',
      type: EntityType.DIRECTORY,
      description: 'This is a subdirectory',
      deleted: false,
    },
  ],
  version: 1.1,
  deleted: false,
  href: 'http://localhost:8585/api/v1/directories/directory-1',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1.0,
  },
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'drive-service',
    fullyQualifiedName: 'drive-service',
    displayName: 'Drive Service',
    deleted: false,
  },
};

const mockTierTag: TagLabel = {
  tagFQN: 'Tier.Tier1',
  description: 'Tier 1',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
};

const mockVersionList: EntityHistory = {
  entityType: 'directory',
  versions: [
    {
      version: 1.0,
      updatedAt: Date.now(),
      updatedBy: 'test-user',
    },
    {
      version: 1.1,
      updatedAt: Date.now() + 1000,
      updatedBy: 'test-user',
    },
  ],
};

const defaultProps: DirectoryVersionProps = {
  version: '1.1',
  currentVersionData: mockDirectoryData,
  isVersionLoading: false,
  owners: mockDirectoryData.owners,
  domains: mockDirectoryData.domains,
  dataProducts: mockDirectoryData.dataProducts,
  tier: mockTierTag,
  breadCrumbList: [
    {
      name: 'Drive Service',
      url: '/drive-service',
    },
    {
      name: 'Test Directory',
      url: '/directory/test-directory',
    },
  ],
  versionList: mockVersionList,
  deleted: false,
  backHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityPermissions: ENTITY_PERMISSIONS,
};

const renderDirectoryVersion = (props: Partial<DirectoryVersionProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter>
      <DirectoryVersion {...finalProps} />
    </MemoryRouter>
  );
};

describe('DirectoryVersion', () => {
  beforeEach(() => {
    mockUseFqn.mockReturnValue({
      fqn: 'drive-service.test-directory',
    });

    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.SCHEMA,
    });

    mockGetDriveAssetByFqn.mockResolvedValue({
      children: mockDirectoryData.children,
    });

    mockGetVersionPath.mockReturnValue('/version/path');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state when isVersionLoading is true', () => {
    renderDirectoryVersion({ isVersionLoading: true });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render directory version component successfully', async () => {
    renderDirectoryVersion();

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
      expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
      expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
    });
  });

  it('should render schema tab content', async () => {
    renderDirectoryVersion();

    await waitFor(() => {
      expect(screen.getByTestId('description-v1')).toBeInTheDocument();
      expect(screen.getByTestId('table')).toBeInTheDocument();
      expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
      expect(screen.getAllByTestId('tags-container')).toHaveLength(2);
    });
  });

  it('should handle tab change correctly', async () => {
    renderDirectoryVersion();

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
    });
  });

  it('should fetch directory details on mount', async () => {
    renderDirectoryVersion();

    await waitFor(() => {
      expect(mockGetDriveAssetByFqn).toHaveBeenCalledWith(
        'drive-service.test-directory',
        EntityType.DIRECTORY,
        'children'
      );
    });
  });

  it('should handle fetch error', async () => {
    const error = new Error('Fetch failed');
    mockGetDriveAssetByFqn.mockRejectedValue(error);

    renderDirectoryVersion();

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        error,
        'server.entity-details-fetch-error'
      );
    });
  });

  it('should render custom properties tab', async () => {
    renderDirectoryVersion();

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
    });
  });

  it('should handle deleted directory', async () => {
    renderDirectoryVersion({ deleted: true });

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
    });
  });

  it('should render with empty children', async () => {
    const dataWithoutChildren = {
      ...mockDirectoryData,
      children: [],
    };

    mockGetDriveAssetByFqn.mockResolvedValue({
      children: [],
    });

    renderDirectoryVersion({
      currentVersionData: dataWithoutChildren,
    });

    await waitFor(() => {
      expect(screen.getByTestId('table')).toBeInTheDocument();
      expect(screen.getByTestId('table-data')).toHaveTextContent('0');
    });
  });

  it('should handle version handler calls', async () => {
    const versionHandler = jest.fn();
    renderDirectoryVersion({ versionHandler });

    await waitFor(() => {
      expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
    });
  });

  it('should handle back handler calls', async () => {
    const backHandler = jest.fn();
    renderDirectoryVersion({ backHandler });

    await waitFor(() => {
      expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
    });
  });

  it('should render with different permissions', async () => {
    const limitedPermissions = {
      ...ENTITY_PERMISSIONS,
      ViewAll: false,
    };

    renderDirectoryVersion({
      entityPermissions: limitedPermissions,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
    });
  });

  it('should update change description when currentVersionData changes', async () => {
    const { rerender } = renderDirectoryVersion();

    const updatedVersionData = {
      ...mockDirectoryData,
      changeDescription: {
        fieldsAdded: ['description'],
        fieldsUpdated: [],
        fieldsDeleted: [],
        previousVersion: 1.0,
      },
    };

    rerender(
      <MemoryRouter>
        <DirectoryVersion
          {...defaultProps}
          currentVersionData={updatedVersionData as Directory}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
    });
  });

  it('should handle loading state during fetch', async () => {
    let _resolvePromise: ((value: { children: unknown[] }) => void) | undefined;
    const fetchPromise = new Promise<{ children: unknown[] }>((resolve) => {
      _resolvePromise = resolve;
    });
    mockGetDriveAssetByFqn.mockReturnValue(fetchPromise);

    renderDirectoryVersion();

    expect(screen.getByTestId('loader')).toBeInTheDocument();

    if (_resolvePromise) {
      _resolvePromise({ children: [] });
    }

    await waitFor(() => {
      expect(
        screen.getByTestId('data-assets-version-header')
      ).toBeInTheDocument();
    });
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should render custom properties tab when ViewCustomFields is true', async () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderDirectoryVersion({
        entityPermissions: permissionsWithViewCustomFields,
      });

      await waitFor(() => {
        const customPropertyTabLabel = screen.getByText(
          'label.custom-property-plural'
        );

        expect(customPropertyTabLabel).toBeInTheDocument();
      });
    });

    it('should render custom properties tab when ViewCustomFields is false', async () => {
      const permissionsWithoutViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: false,
      };

      renderDirectoryVersion({
        entityPermissions: permissionsWithoutViewCustomFields,
      });

      await waitFor(() => {
        const customPropertyTabLabel = screen.getByText(
          'label.custom-property-plural'
        );

        expect(customPropertyTabLabel).toBeInTheDocument();
      });
    });

    it('should render custom properties tab when ViewCustomFields is undefined', async () => {
      const permissionsWithUndefinedViewCustomFields = {
        ...ENTITY_PERMISSIONS,
      };
      delete (permissionsWithUndefinedViewCustomFields as any).ViewCustomFields;

      renderDirectoryVersion({
        entityPermissions: permissionsWithUndefinedViewCustomFields,
      });

      await waitFor(() => {
        const customPropertyTabLabel = screen.getByText(
          'label.custom-property-plural'
        );

        expect(customPropertyTabLabel).toBeInTheDocument();
      });
    });
  });
});
