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
import {
  Constraint,
  DataType,
  Worksheet,
} from '../../../../generated/entity/data/worksheet';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import WorksheetVersion from './WorksheetVersion';
import { WorksheetVersionProps } from './WorksheetVersion.interface';

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
  getColumnsDataWithVersionChanges: jest.fn(
    (_changeDescription, columns) => columns
  ),
}));
jest.mock('../../../../utils/CommonUtils', () => ({
  getPartialNameFromTableFQN: jest.fn(() => 'Column'),
}));
jest.mock('../../../../utils/TableUtils', () => ({
  pruneEmptyChildren: jest.fn((columns) => columns),
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
jest.mock('../../../Entity/VersionTable/VersionTable.component', () =>
  jest.fn(() => <div data-testid="version-table">Version Table</div>)
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

const mockWorksheetData: Worksheet = {
  id: 'worksheet-id-1',
  name: 'test-worksheet',
  displayName: 'Test Worksheet',
  fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet',
  description: 'Test worksheet description',
  spreadsheet: {
    id: 'spreadsheet-1',
    type: 'spreadsheet',
    name: 'test-spreadsheet',
    fullyQualifiedName: 'test-service.test-spreadsheet',
    displayName: 'Test Spreadsheet',
    deleted: false,
  },
  version: 1.1,
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'displayName',
        newValue: 'Test Worksheet',
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
  columns: [
    {
      name: 'id',
      fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet.id',
      displayName: 'ID',
      dataType: DataType.Int,
      description: 'Unique identifier',
      constraint: Constraint.PrimaryKey,
    },
    {
      name: 'name',
      fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet.name',
      displayName: 'Name',
      dataType: DataType.String,
      description: 'Entity name',
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
  href: 'http://localhost:8585/api/v1/worksheets/worksheet-id-1',
};

const mockVersionList = {
  entityType: EntityType.WORKSHEET,
  versions: ['1.0', '1.1'],
};

const defaultProps: WorksheetVersionProps = {
  version: '1.1',
  currentVersionData: mockWorksheetData,
  isVersionLoading: false,
  owners: mockWorksheetData.owners,
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
    {
      name: 'Test Worksheet',
      url: '/worksheet/test-service.test-spreadsheet.test-worksheet',
    },
  ],
  versionList: mockVersionList,
  deleted: false,
  backHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityPermissions: ENTITY_PERMISSIONS,
};

const renderWorksheetVersion = (props: Partial<WorksheetVersionProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter
      initialEntries={[
        '/worksheet/test-service.test-spreadsheet.test-worksheet/versions/1.1',
      ]}>
      <WorksheetVersion {...finalProps} />
    </MemoryRouter>
  );
};

describe('WorksheetVersion', () => {
  beforeEach(() => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.SCHEMA,
    });

    mockGetVersionPath.mockReturnValue(
      '/worksheet/test-service.test-spreadsheet.test-worksheet/versions/1.1/schema'
    );

    jest.clearAllMocks();
  });

  it('should render loader when version is loading', () => {
    renderWorksheetVersion({
      isVersionLoading: true,
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('data-assets-version-header')
    ).not.toBeInTheDocument();
  });

  it('should render worksheet version component successfully when not loading', async () => {
    renderWorksheetVersion();

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should render tabs with correct structure', async () => {
    renderWorksheetVersion();

    const tabsContainer = screen.getByRole('tablist');

    expect(tabsContainer).toBeInTheDocument();

    const schemaTab = screen.getByRole('tab', { name: /schema/i });
    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });

    expect(schemaTab).toBeInTheDocument();
    expect(customPropertiesTab).toBeInTheDocument();
  });

  it('should display description component and version table in schema tab', async () => {
    renderWorksheetVersion();

    expect(screen.getByTestId('description')).toBeInTheDocument();
    expect(screen.getByTestId('version-table')).toBeInTheDocument();
  });

  it('should display data products and tags containers', async () => {
    renderWorksheetVersion();

    expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('tags-container').length).toBeGreaterThan(0);
  });

  it('should handle tab change correctly', async () => {
    renderWorksheetVersion();

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/worksheet/test-service.test-spreadsheet.test-worksheet/versions/1.1/schema'
      );
    });
  });

  it('should render custom properties tab content', async () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.CUSTOM_PROPERTIES,
    });

    renderWorksheetVersion();

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
  });

  it('should handle deleted worksheet version', () => {
    renderWorksheetVersion({
      deleted: true,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle version handler calls', async () => {
    const mockVersionHandler = jest.fn();
    renderWorksheetVersion({
      versionHandler: mockVersionHandler,
    });

    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle back handler calls', async () => {
    const mockBackHandler = jest.fn();
    renderWorksheetVersion({
      backHandler: mockBackHandler,
    });

    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should render with different version numbers', () => {
    renderWorksheetVersion({
      version: '2.0',
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-version-timeline')).toBeInTheDocument();
  });

  it('should handle empty data products and domains', () => {
    renderWorksheetVersion({
      dataProducts: [],
      domains: [],
    });

    expect(screen.getByTestId('data-products-container')).toBeInTheDocument();
  });

  it('should render without tier information', () => {
    renderWorksheetVersion({
      tier: undefined,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should display tags container for each tag type', () => {
    renderWorksheetVersion();

    const tagsContainers = screen.getAllByTestId('tags-container');

    expect(tagsContainers.length).toBeGreaterThan(0);
  });

  it('should handle permissions correctly in custom properties', async () => {
    const limitedPermissions = {
      ...ENTITY_PERMISSIONS,
      ViewAll: false,
    };

    renderWorksheetVersion({
      entityPermissions: limitedPermissions,
    });

    const customPropertiesTab = screen.getByRole('tab', { name: /custom/i });
    fireEvent.click(customPropertiesTab);

    await waitFor(() => {
      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
    });
  });

  it('should update change description when currentVersionData changes', () => {
    const { rerender } = renderWorksheetVersion();

    const updatedWorksheetData = {
      ...mockWorksheetData,
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
          '/worksheet/test-service.test-spreadsheet.test-worksheet/versions/1.1',
        ]}>
        <WorksheetVersion
          {...defaultProps}
          currentVersionData={updatedWorksheetData}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle empty fullyQualifiedName', () => {
    const worksheetDataWithoutFQN = {
      ...mockWorksheetData,
      fullyQualifiedName: undefined,
    };

    renderWorksheetVersion({
      currentVersionData: worksheetDataWithoutFQN as Worksheet,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle worksheets with columns', () => {
    const worksheetWithColumns = {
      ...mockWorksheetData,
      columns: [
        {
          name: 'column1',
          fullyQualifiedName:
            'test-service.test-spreadsheet.test-worksheet.column1',
          dataType: DataType.String,
          description: 'First column',
        },
        {
          name: 'column2',
          fullyQualifiedName:
            'test-service.test-spreadsheet.test-worksheet.column2',
          dataType: DataType.Int,
          description: 'Second column',
        },
      ],
    };

    renderWorksheetVersion({
      currentVersionData: worksheetWithColumns as Worksheet,
    });

    expect(screen.getByTestId('version-table')).toBeInTheDocument();
  });

  it('should handle worksheets without columns', () => {
    const worksheetWithoutColumns = {
      ...mockWorksheetData,
      columns: [],
    };

    renderWorksheetVersion({
      currentVersionData: worksheetWithoutColumns as Worksheet,
    });

    expect(screen.getByTestId('version-table')).toBeInTheDocument();
  });

  it('should handle worksheets with complex column structures', () => {
    const worksheetWithComplexColumns = {
      ...mockWorksheetData,
      columns: [
        {
          name: 'nested_column',
          fullyQualifiedName:
            'test-service.test-spreadsheet.test-worksheet.nested_column',
          dataType: 'RECORD',
          description: 'Complex nested column',
          children: [
            {
              name: 'child_field',
              fullyQualifiedName:
                'test-service.test-spreadsheet.test-worksheet.nested_column.child_field',
              dataType: DataType.String,
              description: 'Child field',
            },
          ],
        },
      ],
    };

    renderWorksheetVersion({
      currentVersionData: worksheetWithComplexColumns as Worksheet,
    });

    expect(screen.getByTestId('version-table')).toBeInTheDocument();
  });

  it('should handle constraint changes in columns', () => {
    renderWorksheetVersion();

    expect(screen.getByTestId('version-table')).toBeInTheDocument();
  });

  it('should handle worksheet with no service information', () => {
    const worksheetWithoutService = {
      ...mockWorksheetData,
      service: undefined,
    };

    renderWorksheetVersion({
      currentVersionData: worksheetWithoutService as unknown as Worksheet,
    });

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle different tab types', () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.ACTIVITY_FEED,
    });

    renderWorksheetVersion();

    expect(
      screen.getByTestId('data-assets-version-header')
    ).toBeInTheDocument();
  });

  it('should handle worksheets with tags', () => {
    const worksheetWithTags = {
      ...mockWorksheetData,
      tags: [
        {
          tagFQN: 'PII.Sensitive',
          description: 'PII Sensitive tag',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Quality.Verified',
          description: 'Quality verified tag',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
    };

    renderWorksheetVersion({
      currentVersionData: worksheetWithTags as Worksheet,
    });

    expect(screen.getAllByTestId('tags-container').length).toBeGreaterThan(0);
  });

  it('should handle worksheets without tags', () => {
    const worksheetWithoutTags = {
      ...mockWorksheetData,
      tags: [],
    };

    renderWorksheetVersion({
      currentVersionData: worksheetWithoutTags as Worksheet,
    });

    expect(screen.getAllByTestId('tags-container').length).toBeGreaterThan(0);
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should render custom properties tab when ViewCustomFields is true', () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderWorksheetVersion({
        entityPermissions: permissionsWithViewCustomFields,
      });

      const customPropertyTabLabel = screen.getByText(
        'label.custom-property-plural'
      );

      expect(customPropertyTabLabel).toBeInTheDocument();
    });

    it('should render custom properties tab when ViewCustomFields is false', () => {
      const permissionsWithoutViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: false,
      };

      renderWorksheetVersion({
        entityPermissions: permissionsWithoutViewCustomFields,
      });

      const customPropertyTabLabel = screen.getByText(
        'label.custom-property-plural'
      );

      expect(customPropertyTabLabel).toBeInTheDocument();
    });

    it('should render custom properties tab when ViewCustomFields is undefined', () => {
      const permissionsWithUndefinedViewCustomFields = {
        ...ENTITY_PERMISSIONS,
      };
      delete (permissionsWithUndefinedViewCustomFields as any).ViewCustomFields;

      renderWorksheetVersion({
        entityPermissions: permissionsWithUndefinedViewCustomFields,
      });

      const customPropertyTabLabel = screen.getByText(
        'label.custom-property-plural'
      );

      expect(customPropertyTabLabel).toBeInTheDocument();
    });
  });
});
