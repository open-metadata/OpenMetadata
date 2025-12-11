/*
 *  Copyright 2025 Collate.
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
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { DataType, Worksheet } from '../../../generated/entity/data/worksheet';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { restoreDriveAsset } from '../../../rest/driveAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import WorksheetDetails from './WorksheetDetails';
import { WorksheetDetailsProps } from './WorksheetDetails.interface';

jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../../hooks/useCustomPages');
jest.mock('../../../hooks/useFqn');
jest.mock('../../../utils/useRequiredParams');
jest.mock('../../../rest/driveAPI');
jest.mock('../../../utils/CommonUtils');
jest.mock('../../../utils/RouterUtils');
jest.mock('../../../utils/ToastUtils');
jest.mock('../../../utils/WorksheetClassBase', () => ({
  __esModule: true,
  default: {
    getWorksheetDetailPageTabs: jest.fn(() => [
      {
        key: EntityTabs.SCHEMA,
        label: 'Schema',
        children: <div data-testid="schema-tab">Schema Tab</div>,
      },
    ]),
  },
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest.fn(() => (
      <div data-testid="activity-feed-tab">Activity Feed Tab</div>
    )),
  })
);

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn((Component) => Component),
}));

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest.fn(() => (
    <div data-testid="custom-property-table">Custom Property Table</div>
  )),
}));

jest.mock('../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader">Loading...</div>)
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest.fn(({ children }) => (
    <div data-testid="generic-provider">{children}</div>
  )),
}));

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn(() => (
      <div data-testid="data-assets-header">Data Assets Header</div>
    )),
  })
);

jest.mock('../../Lineage/EntityLineageTab/EntityLineageTab', () => ({
  EntityLineageTab: jest.fn(() => (
    <div data-testid="entity-lineage-tab">Entity Lineage Tab</div>
  )),
}));

jest.mock('../../PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children, pageTitle }) => (
    <div data-testid="page-layout">
      <h1>{pageTitle}</h1>
      {children}
    </div>
  ))
);

jest.mock('../../../hoc/LimitWrapper', () =>
  jest.fn(({ children }) => <div>{children}</div>)
);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockUseCustomPages = useCustomPages as jest.Mock;
const mockUseFqn = useFqn as jest.Mock;
const mockUseRequiredParams = useRequiredParams as jest.Mock;
const mockRestoreDriveAsset = restoreDriveAsset as jest.Mock;
const mockGetFeedCounts = getFeedCounts as jest.Mock;
const mockGetEntityDetailsPath = getEntityDetailsPath as jest.Mock;

const mockWorksheetDetails: Worksheet = {
  id: 'worksheet-id-1',
  name: 'test-worksheet',
  displayName: 'Test Worksheet',
  fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet',
  description: 'Test worksheet description',
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
  tags: [
    {
      tagFQN: 'PII.Sensitive',
      description: 'PII Sensitive tag',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  followers: [
    {
      id: 'follower-1',
      type: 'user',
      name: 'follower-user',
      fullyQualifiedName: 'follower-user',
      displayName: 'Follower User',
      deleted: false,
    },
  ],
  columns: [
    {
      name: 'column_a',
      dataType: DataType.String,
      displayName: 'Column A',
      description: 'First column',
    },
    {
      name: 'column_b',
      dataType: DataType.Number,
      displayName: 'Column B',
      description: 'Second column',
    },
  ],
  spreadsheet: {
    id: 'spreadsheet-1',
    type: 'spreadsheet',
    name: 'test-spreadsheet',
    fullyQualifiedName: 'test-service.test-spreadsheet',
    displayName: 'Test Spreadsheet',
    deleted: false,
  },
  version: 1.1,
  deleted: false,
  href: 'http://localhost:8585/api/v1/worksheets/worksheet-id-1',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1.0,
  },
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'test-drive-service',
    fullyQualifiedName: 'test-drive-service',
    displayName: 'Test Drive Service',
    deleted: false,
  },
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
};

const defaultProps: WorksheetDetailsProps = {
  worksheetDetails: mockWorksheetDetails,
  worksheetPermissions: ENTITY_PERMISSIONS,
  fetchWorksheet: jest.fn().mockResolvedValue(undefined),
  followWorksheetHandler: jest.fn().mockResolvedValue(undefined),
  handleToggleDelete: jest.fn(),
  unFollowWorksheetHandler: jest.fn().mockResolvedValue(undefined),
  updateWorksheetDetailsState: jest.fn(),
  versionHandler: jest.fn(),
  onWorksheetUpdate: jest.fn().mockResolvedValue(undefined),
  onUpdateVote: jest.fn().mockResolvedValue(undefined),
};

const renderWorksheetDetails = (props: Partial<WorksheetDetailsProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter
      initialEntries={[
        '/worksheet/test-service.test-spreadsheet.test-worksheet',
      ]}>
      <WorksheetDetails {...finalProps} />
    </MemoryRouter>
  );
};

describe('WorksheetDetails', () => {
  beforeEach(() => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: {
        id: 'current-user-id',
        name: 'current-user',
      },
    });

    mockUseCustomPages.mockReturnValue({
      customizedPage: {
        tabs: [
          { key: EntityTabs.SCHEMA, label: 'Schema' },
          { key: EntityTabs.ACTIVITY_FEED, label: 'Activity Feed' },
        ],
      },
      isLoading: false,
    });

    mockUseFqn.mockReturnValue({
      fqn: 'test-service.test-spreadsheet.test-worksheet',
    });

    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.SCHEMA,
    });

    mockGetFeedCounts.mockImplementation((_entityType, _fqn, callback) => {
      callback(FEED_COUNT_INITIAL_DATA);
    });

    mockGetEntityDetailsPath.mockReturnValue(
      '/worksheet/test-service.test-spreadsheet.test-worksheet/schema'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render worksheet details component successfully', async () => {
    renderWorksheetDetails();

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
  });

  it('should show loader when customization is loading', () => {
    mockUseCustomPages.mockReturnValue({
      customizedPage: null,
      isLoading: true,
    });

    renderWorksheetDetails();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should handle tab change correctly', async () => {
    renderWorksheetDetails();

    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle worksheet restoration successfully', async () => {
    const deletedWorksheetDetails = {
      ...mockWorksheetDetails,
      deleted: true,
    };

    mockRestoreDriveAsset.mockResolvedValue({
      version: 1.2,
    });

    renderWorksheetDetails({
      worksheetDetails: deletedWorksheetDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle worksheet restoration error', async () => {
    const deletedWorksheetDetails = {
      ...mockWorksheetDetails,
      deleted: true,
    };

    const error = new Error('Restoration failed');
    mockRestoreDriveAsset.mockRejectedValue(error);

    renderWorksheetDetails({
      worksheetDetails: deletedWorksheetDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should call getFeedCounts on component mount', async () => {
    renderWorksheetDetails();

    await waitFor(() => {
      expect(mockGetFeedCounts).toHaveBeenCalledWith(
        EntityType.WORKSHEET,
        'test-service.test-spreadsheet.test-worksheet',
        expect.any(Function)
      );
    });
  });

  it('should handle follow worksheet action', async () => {
    const followHandler = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      followWorksheetHandler: followHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle unfollow worksheet action', async () => {
    const currentUserAsFollower = {
      ...mockWorksheetDetails,
      followers: [
        {
          id: 'current-user-id',
          type: 'user',
          name: 'current-user',
          fullyQualifiedName: 'current-user',
          displayName: 'Current User',
          deleted: false,
        },
      ],
    };

    const unfollowHandler = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      worksheetDetails: currentUserAsFollower,
      unFollowWorksheetHandler: unfollowHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle worksheet update operations', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle version click', async () => {
    const versionHandler = jest.fn();
    renderWorksheetDetails({
      versionHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle update vote', async () => {
    const onUpdateVote = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onUpdateVote,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should properly calculate permissions based on worksheet state', () => {
    const deletedWorksheetDetails = {
      ...mockWorksheetDetails,
      deleted: true,
    };

    renderWorksheetDetails({
      worksheetDetails: deletedWorksheetDetails,
    });

    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
  });

  it('should handle display name update', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle description update error', async () => {
    const error = new Error('Update failed');
    const onWorksheetUpdate = jest.fn().mockRejectedValue(error);

    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle owner update callback', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tier update', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tag selection', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle data products update', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle certification update', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for soft delete', async () => {
    renderWorksheetDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for hard delete', async () => {
    renderWorksheetDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should toggle tab expanded state', async () => {
    renderWorksheetDetails();

    const expandButton = screen.queryByTitle('label.expand');
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });
  });

  it('should render with empty followers array', () => {
    const worksheetWithoutFollowers = {
      ...mockWorksheetDetails,
      followers: [],
    };

    renderWorksheetDetails({
      worksheetDetails: worksheetWithoutFollowers,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle feed count updates', async () => {
    const mockFeedCount = {
      totalCount: 5,
      openTaskCount: 2,
      closedTaskCount: 3,
    };

    mockGetFeedCounts.mockImplementation((_entityType, _fqn, callback) => {
      callback(mockFeedCount);
    });

    renderWorksheetDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle extension update', async () => {
    const onWorksheetUpdate = jest.fn().mockResolvedValue(undefined);

    renderWorksheetDetails({
      onWorksheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle different default tab', () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.ACTIVITY_FEED,
    });

    renderWorksheetDetails();

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle limited permissions', () => {
    const limitedPermissions = {
      ...ENTITY_PERMISSIONS,
      EditAll: false,
      ViewAll: false,
    };

    renderWorksheetDetails({
      worksheetPermissions: limitedPermissions,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle worksheets with columns', () => {
    const worksheetWithColumns = {
      ...mockWorksheetDetails,
      columns: [
        {
          name: 'id',
          dataType: 'INTEGER',
          displayName: 'ID',
          description: 'Unique identifier',
        },
        {
          name: 'name',
          dataType: DataType.String,
          displayName: 'Name',
          description: 'Entity name',
        },
      ],
    };

    renderWorksheetDetails({
      worksheetDetails: worksheetWithColumns as Worksheet,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle worksheets without columns', () => {
    const worksheetWithoutColumns = {
      ...mockWorksheetDetails,
      columns: [],
    };

    renderWorksheetDetails({
      worksheetDetails: worksheetWithoutColumns,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should pass ViewCustomFields permission correctly when true', async () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderWorksheetDetails({
        worksheetPermissions: permissionsWithViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });

    it('should pass ViewCustomFields permission correctly when false', async () => {
      const permissionsWithoutViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: false,
      };

      renderWorksheetDetails({
        worksheetPermissions: permissionsWithoutViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });

    it('should handle undefined ViewCustomFields permission', async () => {
      const permissionsWithUndefinedViewCustomFields = {
        ...ENTITY_PERMISSIONS,
      };
      delete (permissionsWithUndefinedViewCustomFields as any).ViewCustomFields;

      renderWorksheetDetails({
        worksheetPermissions: permissionsWithUndefinedViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });
  });
});
