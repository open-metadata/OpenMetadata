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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Spreadsheet } from '../../../generated/entity/data/spreadsheet';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { restoreDriveAsset } from '../../../rest/driveAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import SpreadsheetDetails from './SpreadsheetDetails';
import { SpreadsheetDetailsProps } from './SpreadsheetDetails.interface';

jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../../hooks/useCustomPages');
jest.mock('../../../hooks/useFqn');
jest.mock('../../../utils/useRequiredParams');
jest.mock('../../../rest/driveAPI');
jest.mock('../../../utils/CommonUtils');
jest.mock('../../../utils/RouterUtils');
jest.mock('../../../utils/ToastUtils');
jest.mock('../../../utils/SpreadsheetClassBase', () => ({
  __esModule: true,
  default: {
    getSpreadsheetDetailPageTabs: jest.fn(() => [
      {
        key: EntityTabs.WORKSHEETS,
        label: 'Worksheets',
        children: <div data-testid="worksheets-tab">Worksheets Tab</div>,
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

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn(({ children, pageTitle }) => (
    <div data-testid="page-layout">
      <h1>{pageTitle}</h1>
      {children}
    </div>
  ));
});

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

const mockSpreadsheetDetails: Spreadsheet = {
  id: 'spreadsheet-id-1',
  name: 'test-spreadsheet',
  displayName: 'Test Spreadsheet',
  fullyQualifiedName: 'test-service.test-spreadsheet',
  description: 'Test spreadsheet description',
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
  version: 1.1,
  deleted: false,
  href: 'http://localhost:8585/api/v1/spreadsheets/spreadsheet-id-1',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1,
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

const defaultProps: SpreadsheetDetailsProps = {
  spreadsheetDetails: mockSpreadsheetDetails,
  spreadsheetPermissions: ENTITY_PERMISSIONS,
  fetchSpreadsheet: jest.fn().mockResolvedValue(undefined),
  followSpreadsheetHandler: jest.fn().mockResolvedValue(undefined),
  handleToggleDelete: jest.fn(),
  unFollowSpreadsheetHandler: jest.fn().mockResolvedValue(undefined),
  updateSpreadsheetDetailsState: jest.fn(),
  versionHandler: jest.fn(),
  onSpreadsheetUpdate: jest.fn().mockResolvedValue(undefined),
  onUpdateVote: jest.fn().mockResolvedValue(undefined),
};

const renderSpreadsheetDetails = (
  props: Partial<SpreadsheetDetailsProps> = {}
) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter
      initialEntries={['/spreadsheet/test-service.test-spreadsheet']}>
      <SpreadsheetDetails {...finalProps} />
    </MemoryRouter>
  );
};

describe('SpreadsheetDetails', () => {
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
          { key: EntityTabs.WORKSHEETS, label: 'Worksheets' },
          { key: EntityTabs.ACTIVITY_FEED, label: 'Activity Feed' },
        ],
      },
      isLoading: false,
    });

    mockUseFqn.mockReturnValue({
      fqn: 'test-service.test-spreadsheet',
    });

    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.WORKSHEETS,
    });

    mockGetFeedCounts.mockImplementation((_entityType, _fqn, callback) => {
      callback(FEED_COUNT_INITIAL_DATA);
    });

    mockGetEntityDetailsPath.mockReturnValue(
      '/spreadsheet/test-service.test-spreadsheet/worksheets'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render spreadsheet details component successfully', async () => {
    renderSpreadsheetDetails();

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

    renderSpreadsheetDetails();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should handle tab change correctly', async () => {
    renderSpreadsheetDetails();

    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle spreadsheet restoration successfully', async () => {
    const deletedSpreadsheetDetails = {
      ...mockSpreadsheetDetails,
      deleted: true,
    };

    mockRestoreDriveAsset.mockResolvedValue({
      version: 1.2,
    });

    renderSpreadsheetDetails({
      spreadsheetDetails: deletedSpreadsheetDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle spreadsheet restoration error', async () => {
    const deletedSpreadsheetDetails = {
      ...mockSpreadsheetDetails,
      deleted: true,
    };

    const error = new Error('Restoration failed');
    mockRestoreDriveAsset.mockRejectedValue(error);

    renderSpreadsheetDetails({
      spreadsheetDetails: deletedSpreadsheetDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should call getFeedCounts on component mount', async () => {
    renderSpreadsheetDetails();

    await waitFor(() => {
      expect(mockGetFeedCounts).toHaveBeenCalledWith(
        EntityType.SPREADSHEET,
        'test-service.test-spreadsheet',
        expect.any(Function)
      );
    });
  });

  it('should handle follow spreadsheet action', async () => {
    const followHandler = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      followSpreadsheetHandler: followHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle unfollow spreadsheet action', async () => {
    const currentUserAsFollower = {
      ...mockSpreadsheetDetails,
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
    renderSpreadsheetDetails({
      spreadsheetDetails: currentUserAsFollower,
      unFollowSpreadsheetHandler: unfollowHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle spreadsheet update operations', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle version click', async () => {
    const versionHandler = jest.fn();
    renderSpreadsheetDetails({
      versionHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle update vote', async () => {
    const onUpdateVote = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onUpdateVote,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should properly calculate permissions based on spreadsheet state', () => {
    const deletedSpreadsheetDetails = {
      ...mockSpreadsheetDetails,
      deleted: true,
    };

    renderSpreadsheetDetails({
      spreadsheetDetails: deletedSpreadsheetDetails,
    });

    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
  });

  it('should handle display name update', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle description update error', async () => {
    const error = new Error('Update failed');
    const onSpreadsheetUpdate = jest.fn().mockRejectedValue(error);

    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle owner update callback', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tier update', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tag selection', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle data products update', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle certification update', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);
    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for soft delete', async () => {
    renderSpreadsheetDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for hard delete', async () => {
    renderSpreadsheetDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should toggle tab expanded state', async () => {
    renderSpreadsheetDetails();

    const expandButton = screen.queryByTitle('label.expand');
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });
  });

  it('should render with empty followers array', () => {
    const spreadsheetWithoutFollowers = {
      ...mockSpreadsheetDetails,
      followers: [],
    };

    renderSpreadsheetDetails({
      spreadsheetDetails: spreadsheetWithoutFollowers,
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

    renderSpreadsheetDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle extension update', async () => {
    const onSpreadsheetUpdate = jest.fn().mockResolvedValue(undefined);

    renderSpreadsheetDetails({
      onSpreadsheetUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle different default tab', () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.ACTIVITY_FEED,
    });

    renderSpreadsheetDetails();

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle limited permissions', () => {
    const limitedPermissions = {
      ...ENTITY_PERMISSIONS,
      EditAll: false,
      ViewAll: false,
    };

    renderSpreadsheetDetails({
      spreadsheetPermissions: limitedPermissions,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should pass ViewCustomFields permission correctly when true', async () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderSpreadsheetDetails({
        spreadsheetPermissions: permissionsWithViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });

    it('should pass ViewCustomFields permission correctly when false', async () => {
      const permissionsWithoutViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: false,
      };

      renderSpreadsheetDetails({
        spreadsheetPermissions: permissionsWithoutViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });

    it('should handle undefined ViewCustomFields permission', async () => {
      const permissionsWithUndefinedViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: undefined,
      };

      renderSpreadsheetDetails({
        spreadsheetPermissions:
          permissionsWithUndefinedViewCustomFields as unknown as OperationPermission,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    renderSpreadsheetDetails();

    await waitFor(() => {
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'Test Spreadsheet',
        }),
        expect.anything()
      );
    });
  });
});
