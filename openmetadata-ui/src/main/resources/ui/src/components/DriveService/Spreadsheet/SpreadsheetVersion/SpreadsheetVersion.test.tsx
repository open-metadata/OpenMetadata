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
import { Spreadsheet } from '../../../../generated/entity/data/spreadsheet';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { useFqn } from '../../../../hooks/useFqn';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import { getDriveAssetByFqn } from '../../../../rest/driveAPI';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import SpreadsheetVersion from './SpreadsheetVersion';
import { SpreadsheetVersionProps } from './SpreadsheetVersion.interface';

jest.mock('../../../../hooks/useFqn');
jest.mock('../../../../utils/useRequiredParams');
jest.mock('../../../../rest/driveAPI');
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
jest.mock('../../../../utils/ToastUtils');
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
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }) => (
    <div data-testid="rich-text-preview">{markdown}</div>
  ))
);
jest.mock('../../../common/Table/Table', () =>
  jest.fn(({ dataSource }) => (
    <div data-testid="spreadsheet-children-table">
      {dataSource?.map((worksheet: { name: string }, index: number) => (
        <div data-testid={`worksheet-row-${index}`} key={index}>
          {worksheet.name}
        </div>
      ))}
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

const mockUseFqn = useFqn as jest.Mock;
const mockUseRequiredParams = useRequiredParams as jest.Mock;
const mockGetDriveAssetByFqn = getDriveAssetByFqn as jest.Mock;
const mockGetVersionPath = getVersionPath as jest.Mock;

const mockSpreadsheetData: Spreadsheet = {
  id: 'spreadsheet-id-1',
  name: 'test-spreadsheet',
  displayName: 'Test Spreadsheet',
  fullyQualifiedName: 'test-service.test-spreadsheet',
  description: 'Test spreadsheet description',
  version: 1.1,
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'displayName',
        newValue: 'Test Spreadsheet',
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
  worksheets: [
    {
      id: 'worksheet-1',
      name: 'Sheet1',
      fullyQualifiedName: 'test-service.test-spreadsheet.Sheet1',
      displayName: 'Sheet 1',
      deleted: false,
      type: 'worksheet',
    },
    {
      id: 'worksheet-2',
      name: 'Sheet2',
      fullyQualifiedName: 'test-service.test-spreadsheet.Sheet2',
      displayName: 'Sheet 2',
      deleted: false,
      type: 'worksheet',
    },
  ],
  deleted: false,
  href: 'http://localhost:8585/api/v1/spreadsheets/spreadsheet-id-1',
};

const mockVersionList = {
  entityType: EntityType.SPREADSHEET,
  versions: ['1.0', '1.1'],
};

const defaultProps: SpreadsheetVersionProps = {
  version: '1.1',
  currentVersionData: mockSpreadsheetData,
  isVersionLoading: false,
  owners: mockSpreadsheetData.owners,
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
      name: 'Test Spreadsheet',
      url: '/spreadsheet/test-service.test-spreadsheet',
    },
  ],
  versionList: mockVersionList,
  deleted: false,
  backHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityPermissions: ENTITY_PERMISSIONS,
};

const renderSpreadsheetVersion = (
  props: Partial<SpreadsheetVersionProps> = {}
) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter
      initialEntries={[
        '/spreadsheet/test-service.test-spreadsheet/versions/1.1',
      ]}>
      <SpreadsheetVersion {...finalProps} />
    </MemoryRouter>
  );
};

describe('SpreadsheetVersion', () => {
  beforeEach(() => {
    mockUseFqn.mockReturnValue({
      fqn: 'test-service.test-spreadsheet',
    });

    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.SCHEMA,
    });

    mockGetVersionPath.mockReturnValue(
      '/spreadsheet/test-service.test-spreadsheet/versions/1.1/schema'
    );

    mockGetDriveAssetByFqn.mockResolvedValue({
      worksheets: mockSpreadsheetData.worksheets,
    });

    jest.clearAllMocks();
  });

  it('should render loader when version is loading', () => {
    renderSpreadsheetVersion({
      isVersionLoading: true,
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('data-assets-version-header')
    ).not.toBeInTheDocument();
  });

  it('should render loader while fetching spreadsheet details', async () => {
    mockGetDriveAssetByFqn.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ worksheets: [] }), 100)
        )
    );

    renderSpreadsheetVersion();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render spreadsheet version component successfully when not loading', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should render tabs with correct structure', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    const tabsContainer = screen.getByRole('tablist');

    expect(tabsContainer).toBeInTheDocument();

    const schemaTab = screen.getByRole('tab', { name: /schema/i });
    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });

    expect(schemaTab).toBeInTheDocument();
    expect(customPropertiesTab).toBeInTheDocument();
  });

  it('should display description component and worksheets table in schema tab', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('description')).toBeInTheDocument();
    expect(
      screen.getByTestId('spreadsheet-children-table')
    ).toBeInTheDocument();
  });

  it('should display worksheets data in the table', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('worksheet-row-0')).toHaveTextContent('Sheet1');
    expect(screen.getByTestId('worksheet-row-1')).toHaveTextContent('Sheet2');
  });

  it('should display data products and tags containers', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('tags-container').length).toBeGreaterThan(0);
  });

  it('should handle tab change correctly', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/spreadsheet/test-service.test-spreadsheet/versions/1.1/schema'
      );
    });
  });

  it('should render custom properties tab content', async () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.CUSTOM_PROPERTIES,
    });

    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
  });

  it('should fetch spreadsheet details on mount', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(mockGetDriveAssetByFqn).toHaveBeenCalledWith(
        'test-service.test-spreadsheet',
        EntityType.SPREADSHEET,
        'worksheets'
      );
    });
  });

  it('should handle error when fetching spreadsheet details', async () => {
    const error = new Error('Fetch failed');
    mockGetDriveAssetByFqn.mockRejectedValue(error);

    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle deleted spreadsheet version', async () => {
    renderSpreadsheetVersion({
      deleted: true,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle version handler calls', async () => {
    const mockVersionHandler = jest.fn();
    renderSpreadsheetVersion({
      versionHandler: mockVersionHandler,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle back handler calls', async () => {
    const mockBackHandler = jest.fn();
    renderSpreadsheetVersion({
      backHandler: mockBackHandler,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should render with different version numbers', async () => {
    renderSpreadsheetVersion({
      version: '2.0',
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle empty worksheets array', async () => {
    mockGetDriveAssetByFqn.mockResolvedValue({
      worksheets: [],
    });

    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('spreadsheet-children-table')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('worksheet-row-0')).not.toBeInTheDocument();
  });

  it('should handle empty data products and domains', async () => {
    renderSpreadsheetVersion({
      dataProducts: [],
      domains: [],
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
  });

  it('should render without tier information', async () => {
    renderSpreadsheetVersion({
      tier: undefined,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should display tags container for each tag type', async () => {
    renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    const tagsContainers = screen.getAllByTestId('tags-container');

    expect(tagsContainers.length).toBeGreaterThan(0);
  });

  it('should handle permissions correctly in custom properties', async () => {
    const limitedPermissions = {
      ...ENTITY_PERMISSIONS,
      ViewAll: false,
    };

    renderSpreadsheetVersion({
      entityPermissions: limitedPermissions,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    await waitFor(() => {
      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
    });
  });

  it('should update change description when currentVersionData changes', async () => {
    const { rerender } = renderSpreadsheetVersion();

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    const updatedSpreadsheetData = {
      ...mockSpreadsheetData,
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
        initialEntries={[
          '/spreadsheet/test-service.test-spreadsheet/versions/1.1',
        ]}>
        <SpreadsheetVersion
          {...defaultProps}
          currentVersionData={updatedSpreadsheetData}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle empty fullyQualifiedName', async () => {
    const spreadsheetDataWithoutFQN = {
      ...mockSpreadsheetData,
      fullyQualifiedName: undefined,
    };

    renderSpreadsheetVersion({
      currentVersionData: spreadsheetDataWithoutFQN,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should render custom properties tab when ViewCustomFields is true', async () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderSpreadsheetVersion({
        entityPermissions: permissionsWithViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });

      expect(customPropertiesTab).toBeInTheDocument();
    });

    it('should render custom properties tab when ViewCustomFields is false', async () => {
      const permissionsWithoutViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: false,
      };

      renderSpreadsheetVersion({
        entityPermissions: permissionsWithoutViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });

      expect(customPropertiesTab).toBeInTheDocument();
    });

    it('should render custom properties tab when ViewCustomFields is undefined', async () => {
      const permissionsWithUndefinedViewCustomFields = {
        ...ENTITY_PERMISSIONS,
      };
      delete (permissionsWithUndefinedViewCustomFields as any).ViewCustomFields;

      renderSpreadsheetVersion({
        entityPermissions: permissionsWithUndefinedViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });

      expect(customPropertiesTab).toBeInTheDocument();
    });
  });
});
