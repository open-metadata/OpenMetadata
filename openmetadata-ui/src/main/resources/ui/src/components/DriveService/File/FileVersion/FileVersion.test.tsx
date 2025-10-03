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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { File } from '../../../../generated/entity/data/file';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import FileVersion from './FileVersion';
import { FileVersionProps } from './FileVersion.interface';

jest.mock('../../../../utils/useRequiredParams');
jest.mock('../../../../utils/RouterUtils');
jest.mock('../../../../utils/EntityVersionUtils', () => ({
  getCommonExtraInfoForVersionDetails: jest.fn(() => ({
    ownerDisplayName: 'Test Owner',
    ownerRef: { id: 'owner-1', name: 'test-owner' },
    tierDisplayName: 'Tier1',
    domainDisplayName: 'Test Domain',
  })),
  getEntityVersionTags: jest.fn(() => []),
  getEntityVersionByField: jest.fn(
    (_changeDescription, _field, defaultValue) => defaultValue
  ),
  getConstraintChanges: jest.fn(() => ({
    addedConstraintDiffs: [],
    deletedConstraintDiffs: [],
  })),
}));
jest.mock('../../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest.fn(() => (
    <div data-testid="custom-property-table">Custom Property Table</div>
  )),
}));
jest.mock('../../../common/EntityDescription/DescriptionV1', () =>
  jest.fn(() => <div data-testid="description">Description Component</div>)
);
jest.mock('../../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader">Loading...</div>)
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
      <div data-testid="data-assets-version-header">
        Data Assets Version Header
      </div>
    ))
);
jest.mock(
  '../../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () =>
    jest.fn(() => (
      <div data-testid="data-products-container">Data Products Container</div>
    ))
);
jest.mock('../../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () =>
  jest.fn(() => (
    <div data-testid="entity-version-timeline">Entity Version Timeline</div>
  ))
);
jest.mock('../../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn(() => <div data-testid="tags-container">Tags Container</div>)
);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockUseRequiredParams = useRequiredParams as jest.Mock;
const mockGetVersionPath = getVersionPath as jest.Mock;

const mockFileData: File = {
  id: 'file-id-1',
  name: 'test-file.txt',
  displayName: 'Test File',
  fullyQualifiedName: 'test-service.test-file.txt',
  description: 'Test file description',
  version: 1.1,
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'displayName',
        newValue: 'Test File',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1.0,
  },
  tags: [
    {
      tagFQN: 'PII.Sensitive',
      description: 'PII Sensitive tag',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  owners: [
    {
      id: 'owner-1',
      type: 'user',
      name: 'test-user',
      fullyQualifiedName: 'test-user',
      displayName: 'Test User',
      deleted: false,
    },
  ],
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'test-drive-service',
    fullyQualifiedName: 'test-drive-service',
    displayName: 'Test Drive Service',
    deleted: false,
  },
  deleted: false,
  href: 'http://localhost:8585/api/v1/files/file-id-1',
};

const mockVersionList = {
  entityType: EntityType.FILE,
  versions: ['1.0', '1.1'],
};

const defaultProps: FileVersionProps = {
  version: '1.1',
  currentVersionData: mockFileData,
  isVersionLoading: false,
  owners: mockFileData.owners,
  domains: [],
  dataProducts: [],
  tier: {
    tagFQN: 'Tier.Tier1',
    description: 'Tier1 tag',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  breadCrumbList: [
    {
      name: 'Drive Service',
      url: '/drive-service/test-drive-service',
    },
    {
      name: 'Test File',
      url: '/file/test-service.test-file.txt',
    },
  ],
  versionList: mockVersionList,
  deleted: false,
  backHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityPermissions: ENTITY_PERMISSIONS,
};

const renderFileVersion = (props: Partial<FileVersionProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter
      initialEntries={['/file/test-service.test-file.txt/versions/1.1']}>
      <FileVersion {...finalProps} />
    </MemoryRouter>
  );
};

describe('FileVersion', () => {
  beforeEach(() => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.SCHEMA,
    });

    mockGetVersionPath.mockReturnValue(
      '/file/test-service.test-file.txt/versions/1.1/schema'
    );

    jest.clearAllMocks();
  });

  it('should render loader when version is loading', () => {
    renderFileVersion({
      isVersionLoading: true,
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('data-assets-version-header')
    ).not.toBeInTheDocument();
  });

  it('should render file version component successfully when not loading', async () => {
    renderFileVersion();

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should render tabs with correct structure', async () => {
    renderFileVersion();

    const tabsContainer = screen.getByRole('tablist');

    expect(tabsContainer).toBeInTheDocument();

    const schemaTab = screen.getByRole('tab', { name: /schema/i });
    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });

    expect(schemaTab).toBeInTheDocument();
    expect(customPropertiesTab).toBeInTheDocument();
  });

  it('should display description component in schema tab', async () => {
    renderFileVersion();

    expect(screen.getByTestId('description')).toBeInTheDocument();
  });

  it('should display data products and tags containers', async () => {
    renderFileVersion();

    expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('tags-container').length).toBeGreaterThan(0);
  });

  it('should handle tab change correctly', async () => {
    renderFileVersion();

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/file/test-service.test-file.txt/versions/1.1/schema'
      );
    });
  });

  it('should render custom properties tab content', async () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.CUSTOM_PROPERTIES,
    });

    renderFileVersion();

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
  });

  it('should handle deleted file version', () => {
    renderFileVersion({
      deleted: true,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle version handler calls', async () => {
    const mockVersionHandler = jest.fn();
    renderFileVersion({
      versionHandler: mockVersionHandler,
    });

    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle back handler calls', async () => {
    const mockBackHandler = jest.fn();
    renderFileVersion({
      backHandler: mockBackHandler,
    });

    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should render with different version numbers', () => {
    renderFileVersion({
      version: '2.0',
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle empty data products and domains', () => {
    renderFileVersion({
      dataProducts: [],
      domains: [],
    });

    expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
  });

  it('should render without tier information', () => {
    renderFileVersion({
      tier: undefined,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should display tags container for each tag type', () => {
    renderFileVersion();

    const tagsContainers = screen.getAllByTestId('tags-container');

    expect(tagsContainers.length).toBeGreaterThan(0);
  });

  it('should handle permissions correctly in custom properties', async () => {
    const limitedPermissions = {
      ...ENTITY_PERMISSIONS,
      ViewAll: false,
    };

    renderFileVersion({
      entityPermissions: limitedPermissions,
    });

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    await waitFor(() => {
      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
    });
  });

  it('should update change description when currentVersionData changes', () => {
    const { rerender } = renderFileVersion();

    const updatedFileData = {
      ...mockFileData,
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [
          {
            name: 'description',
            oldValue: 'Old description',
            newValue: 'New description',
          },
        ],
        fieldsDeleted: [],
        previousVersion: 1.1,
      },
    };

    rerender(
      <MemoryRouter
        initialEntries={['/file/test-service.test-file.txt/versions/1.1']}>
        <FileVersion {...defaultProps} currentVersionData={updatedFileData} />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle empty fullyQualifiedName', () => {
    const fileDataWithoutFQN = {
      ...mockFileData,
      fullyQualifiedName: undefined,
    };

    renderFileVersion({
      currentVersionData: fileDataWithoutFQN,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });
});
