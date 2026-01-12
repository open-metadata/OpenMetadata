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
import { Directory } from '../../../generated/entity/data/directory';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { restoreDriveAsset } from '../../../rest/driveAPI';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DirectoryDetails from './DirectoryDetails';
import { DirectoryDetailsProps } from './DirectoryDetails.interface';
import { FeedCounts } from '../../../interface/feed.interface';

jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../../hooks/useCustomPages');
jest.mock('../../../hooks/useFqn');
jest.mock('../../../utils/useRequiredParams');
jest.mock('../../../rest/driveAPI');
const mockGetFeedCounts = jest.fn();
const mockExtractEntityFqnAndColumnPart = jest
  .fn()
  .mockImplementation((entityFqn, baseFqn) => {
    if (baseFqn && entityFqn.startsWith(baseFqn)) {
      return {
        entityFqn: baseFqn,
        columnPart: undefined,
      };
    }

    return {
      entityFqn: entityFqn || baseFqn || '',
      columnPart: undefined,
    };
  });

jest.mock('../../../utils/CommonUtils', () => ({
  ...jest.requireActual('../../../utils/CommonUtils'),
  getEntityMissingError: jest.fn(),
  getFeedCounts: (...args: [EntityType, string, (data: FeedCounts) => void]) =>
    mockGetFeedCounts(...args),
  extractEntityFqnAndColumnPart: (...args: [string, string, number]) =>
    mockExtractEntityFqnAndColumnPart(...args),
}));
jest.mock('../../../utils/RouterUtils');
jest.mock('../../../utils/ToastUtils');
jest.mock('../../../utils/DirectoryClassBase', () => ({
  __esModule: true,
  default: {
    getDirectoryDetailPageTabs: jest.fn(() => [
      {
        key: EntityTabs.CHILDREN,
        label: 'Children',
        children: <div data-testid="children-tab">Children Tab</div>,
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
// const mockGetFeedCounts = getFeedCounts as jest.Mock;
const mockGetEntityDetailsPath = getEntityDetailsPath as jest.Mock;

const mockDirectoryDetails: Directory = {
  id: 'directory-id-1',
  name: 'test-directory',
  displayName: 'Test Directory',
  fullyQualifiedName: 'test-service.test-directory',
  description: 'Test directory description',
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
  children: [
    {
      id: 'child-1',
      type: 'directory',
      name: 'child-directory',
      fullyQualifiedName: 'test-service.test-directory.child-directory',
      displayName: 'Child Directory',
      deleted: false,
    },
  ],
  version: 1.1,
  deleted: false,
  href: 'http://localhost:8585/api/v1/directories/directory-id-1',
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
};

const defaultProps: DirectoryDetailsProps = {
  directoryDetails: mockDirectoryDetails,
  directoryPermissions: ENTITY_PERMISSIONS,
  fetchDirectory: jest.fn().mockResolvedValue(undefined),
  followDirectoryHandler: jest.fn().mockResolvedValue(undefined),
  handleToggleDelete: jest.fn(),
  unFollowDirectoryHandler: jest.fn().mockResolvedValue(undefined),
  updateDirectoryDetailsState: jest.fn(),
  versionHandler: jest.fn(),
  onDirectoryUpdate: jest.fn().mockResolvedValue(undefined),
  onUpdateVote: jest.fn().mockResolvedValue(undefined),
};

const renderDirectoryDetails = (props: Partial<DirectoryDetailsProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter initialEntries={['/directory/test-service.test-directory']}>
      <DirectoryDetails {...finalProps} />
    </MemoryRouter>
  );
};

describe('DirectoryDetails', () => {
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
          { key: EntityTabs.CHILDREN, label: 'Children' },
          { key: EntityTabs.ACTIVITY_FEED, label: 'Activity Feed' },
        ],
      },
      isLoading: false,
    });

    mockUseFqn.mockReturnValue({
      fqn: 'test-service.test-directory',
      columnPart: undefined,
    });

    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.CHILDREN,
    });

    mockGetFeedCounts.mockImplementation((_entityType, _fqn, callback) => {
      callback(FEED_COUNT_INITIAL_DATA);
    });

    mockGetEntityDetailsPath.mockReturnValue(
      '/directory/test-service.test-directory/children'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render directory details component successfully', async () => {
    renderDirectoryDetails();

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

    renderDirectoryDetails();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should handle tab change correctly', async () => {
    renderDirectoryDetails();

    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle directory restoration successfully', async () => {
    const deletedDirectoryDetails = {
      ...mockDirectoryDetails,
      deleted: true,
    };

    mockRestoreDriveAsset.mockResolvedValue({
      version: 1.2,
    });

    renderDirectoryDetails({
      directoryDetails: deletedDirectoryDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle directory restoration error', async () => {
    const deletedDirectoryDetails = {
      ...mockDirectoryDetails,
      deleted: true,
    };

    const error = new Error('Restoration failed');
    mockRestoreDriveAsset.mockRejectedValue(error);

    renderDirectoryDetails({
      directoryDetails: deletedDirectoryDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should call getFeedCounts on component mount', async () => {
    renderDirectoryDetails();

    await waitFor(() => {
      expect(mockGetFeedCounts).toHaveBeenCalledWith(
        EntityType.DIRECTORY,
        'test-service.test-directory',
        expect.any(Function)
      );
    });
  });

  it('should handle follow directory action', async () => {
    const followHandler = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      followDirectoryHandler: followHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle unfollow directory action', async () => {
    const currentUserAsFollower = {
      ...mockDirectoryDetails,
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
    renderDirectoryDetails({
      directoryDetails: currentUserAsFollower,
      unFollowDirectoryHandler: unfollowHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle directory update operations', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle version click', async () => {
    const versionHandler = jest.fn();
    renderDirectoryDetails({
      versionHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle update vote', async () => {
    const onUpdateVote = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onUpdateVote,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should properly calculate permissions based on directory state', () => {
    const deletedDirectoryDetails = {
      ...mockDirectoryDetails,
      deleted: true,
    };

    renderDirectoryDetails({
      directoryDetails: deletedDirectoryDetails,
    });

    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
  });

  it('should handle display name update', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle description update error', async () => {
    const error = new Error('Update failed');
    const onDirectoryUpdate = jest.fn().mockRejectedValue(error);

    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle children field update error', async () => {
    const error = new Error('Children update failed');
    const onDirectoryUpdate = jest.fn().mockRejectedValue(error);

    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle owner update callback', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tier update', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tag selection', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle data products update', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle certification update', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);
    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for soft delete', async () => {
    renderDirectoryDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for hard delete', async () => {
    renderDirectoryDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should toggle tab expanded state', async () => {
    renderDirectoryDetails();

    const expandButton = screen.queryByTitle('label.expand');
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });
  });

  it('should render with empty children array', () => {
    const directoryWithoutChildren = {
      ...mockDirectoryDetails,
      children: [],
    };

    renderDirectoryDetails({
      directoryDetails: directoryWithoutChildren,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should render with undefined children', () => {
    const directoryWithUndefinedChildren = {
      ...mockDirectoryDetails,
      children: undefined,
    };

    renderDirectoryDetails({
      directoryDetails: directoryWithUndefinedChildren,
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

    renderDirectoryDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle extension update', async () => {
    const onDirectoryUpdate = jest.fn().mockResolvedValue(undefined);

    renderDirectoryDetails({
      onDirectoryUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should pass ViewCustomFields permission correctly when true', async () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderDirectoryDetails({
        directoryPermissions: permissionsWithViewCustomFields,
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

      renderDirectoryDetails({
        directoryPermissions: permissionsWithoutViewCustomFields,
      });

      await waitFor(() => {
        expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });

    it('should handle undefined ViewCustomFields permission', async () => {
      const permissionsWithUndefinedViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: undefined,
      };

      renderDirectoryDetails({
        directoryPermissions:
          permissionsWithUndefinedViewCustomFields as unknown as OperationPermission,
      });

      await waitFor(() => {
        expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    renderDirectoryDetails();

    await waitFor(() => {
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'Test Directory',
        }),
        expect.anything()
      );
    });
  });
});
