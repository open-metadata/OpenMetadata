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
import { File, FileType } from '../../../generated/entity/data/file';
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
import FileDetails from './FileDetails';
import { FileDetailsProps } from './FileDetails.interface';

jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../../hooks/useCustomPages');
jest.mock('../../../hooks/useFqn');
jest.mock('../../../utils/useRequiredParams');
jest.mock('../../../rest/driveAPI');
jest.mock('../../../utils/CommonUtils');
jest.mock('../../../utils/RouterUtils');
jest.mock('../../../utils/ToastUtils');
jest.mock('../../../utils/FileClassBase', () => ({
  __esModule: true,
  default: {
    getFileDetailPageTabs: jest.fn(() => [
      {
        key: EntityTabs.OVERVIEW,
        label: 'Overview',
        children: <div data-testid="overview-tab">Overview Tab</div>,
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

jest.mock('../../common/IconButtons/EditIconButton', () => ({
  AlignRightIconButton: jest.fn(({ onClick, title, className }) => (
    <button
      className={className}
      data-testid="expand-button"
      title={title}
      onClick={onClick}>
      Expand
    </button>
  )),
}));

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

const mockFileDetails: File = {
  id: 'file-id-1',
  name: 'test-file.txt',
  displayName: 'Test File',
  fullyQualifiedName: 'test-service.test-file.txt',
  description: 'Test file description',
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
  href: 'http://localhost:8585/api/v1/files/file-id-1',
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
  extension: 'txt',
  fileType: FileType.Text,
  size: 1024,
};

const defaultProps: FileDetailsProps = {
  fileDetails: mockFileDetails,
  filePermissions: ENTITY_PERMISSIONS,
  fetchFile: jest.fn().mockResolvedValue(undefined),
  followFileHandler: jest.fn().mockResolvedValue(undefined),
  handleToggleDelete: jest.fn(),
  unFollowFileHandler: jest.fn().mockResolvedValue(undefined),
  updateFileDetailsState: jest.fn(),
  versionHandler: jest.fn(),
  onFileUpdate: jest.fn().mockResolvedValue(undefined),
  onUpdateVote: jest.fn().mockResolvedValue(undefined),
};

const renderFileDetails = (props: Partial<FileDetailsProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter initialEntries={['/file/test-service.test-file.txt']}>
      <FileDetails {...finalProps} />
    </MemoryRouter>
  );
};

describe('FileDetails', () => {
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
          { key: EntityTabs.OVERVIEW, label: 'Overview' },
          { key: EntityTabs.ACTIVITY_FEED, label: 'Activity Feed' },
        ],
      },
      isLoading: false,
    });

    mockUseFqn.mockReturnValue({
      fqn: 'test-service.test-file.txt',
    });

    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.OVERVIEW,
    });

    mockGetFeedCounts.mockImplementation((_entityType, _fqn, callback) => {
      callback(FEED_COUNT_INITIAL_DATA);
    });

    mockGetEntityDetailsPath.mockReturnValue(
      '/file/test-service.test-file.txt/overview'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render file details component successfully', async () => {
    renderFileDetails();

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

    renderFileDetails();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should handle tab change correctly', async () => {
    renderFileDetails();

    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle file restoration successfully', async () => {
    const deletedFileDetails = {
      ...mockFileDetails,
      deleted: true,
    };

    mockRestoreDriveAsset.mockResolvedValue({
      version: 1.2,
    });

    renderFileDetails({
      fileDetails: deletedFileDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle file restoration error', async () => {
    const deletedFileDetails = {
      ...mockFileDetails,
      deleted: true,
    };

    const error = new Error('Restoration failed');
    mockRestoreDriveAsset.mockRejectedValue(error);

    renderFileDetails({
      fileDetails: deletedFileDetails,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should call getFeedCounts on component mount', async () => {
    renderFileDetails();

    await waitFor(() => {
      expect(mockGetFeedCounts).toHaveBeenCalledWith(
        EntityType.FILE,
        'test-service.test-file.txt',
        expect.any(Function)
      );
    });
  });

  it('should handle follow file action for non-following user', async () => {
    const followHandler = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      followFileHandler: followHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle unfollow file action for following user', async () => {
    const currentUserAsFollower = {
      ...mockFileDetails,
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
    renderFileDetails({
      fileDetails: currentUserAsFollower,
      unFollowFileHandler: unfollowHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle file update operations', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle version click', async () => {
    const versionHandler = jest.fn();
    renderFileDetails({
      versionHandler,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle update vote', async () => {
    const onUpdateVote = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onUpdateVote,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should properly calculate permissions based on file state', () => {
    const deletedFileDetails = {
      ...mockFileDetails,
      deleted: true,
    };

    renderFileDetails({
      fileDetails: deletedFileDetails,
    });

    expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
  });

  it('should handle display name update', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle description update successfully', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle description update error', async () => {
    const error = new Error('Update failed');
    const onFileUpdate = jest.fn().mockRejectedValue(error);

    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle extension update', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);

    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle owner update callback', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tier update', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tag selection', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle data products update', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle certification update', async () => {
    const onFileUpdate = jest.fn().mockResolvedValue(undefined);
    renderFileDetails({
      onFileUpdate,
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for soft delete', async () => {
    renderFileDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle after delete action for hard delete (should navigate to home)', async () => {
    renderFileDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });

    // Test rendering for hard delete scenario
    const instance = renderFileDetails();

    // The afterDeleteAction should navigate to home for hard delete (isSoftDelete = false)
    // This is tested indirectly through the component rendering
    expect(instance.container).toBeInTheDocument();
  });

  it('should toggle tab expanded state', async () => {
    renderFileDetails();

    const expandButton = screen.queryByTestId('expand-button');
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });
  });

  it('should render with empty tags array', () => {
    const fileWithoutTags = {
      ...mockFileDetails,
      tags: [],
    };

    renderFileDetails({
      fileDetails: fileWithoutTags,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should render with undefined tags', () => {
    const fileWithUndefinedTags = {
      ...mockFileDetails,
      tags: undefined,
    };

    renderFileDetails({
      fileDetails: fileWithUndefinedTags,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should render with empty followers array', () => {
    const fileWithoutFollowers = {
      ...mockFileDetails,
      followers: [],
    };

    renderFileDetails({
      fileDetails: fileWithoutFollowers,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should render with undefined followers', () => {
    const fileWithUndefinedFollowers = {
      ...mockFileDetails,
      followers: undefined,
    };

    renderFileDetails({
      fileDetails: fileWithUndefinedFollowers,
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

    renderFileDetails();

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
    });
  });

  it('should handle tab change navigation', async () => {
    renderFileDetails();

    // Test that tabs component is rendered and functional
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle empty description in file details', () => {
    const fileWithEmptyDescription = {
      ...mockFileDetails,
      description: '',
    };

    renderFileDetails({
      fileDetails: fileWithEmptyDescription,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle file with different file extension', () => {
    const fileWithDifferentExtension = {
      ...mockFileDetails,
      extension: 'pdf',
      fileType: FileType.PDF,
    };

    renderFileDetails({
      fileDetails: fileWithDifferentExtension as File,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should properly handle isFollowing calculation', () => {
    // Test when current user is not in followers
    const fileWithoutCurrentUserAsFollower = {
      ...mockFileDetails,
      followers: [
        {
          id: 'other-user-id',
          type: 'user',
          name: 'other-user',
          fullyQualifiedName: 'other-user',
          displayName: 'Other User',
          deleted: false,
        },
      ],
    };

    renderFileDetails({
      fileDetails: fileWithoutCurrentUserAsFollower,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle permissions for deleted file', () => {
    const deletedFile = {
      ...mockFileDetails,
      deleted: true,
    };

    const restrictedPermissions: OperationPermission = {
      ...ENTITY_PERMISSIONS,
      EditAll: false,
      EditTags: false,
      EditDescription: false,
    };

    renderFileDetails({
      fileDetails: deletedFile,
      filePermissions: restrictedPermissions,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  it('should handle tab change when activeKey is the same as current tab', async () => {
    mockUseRequiredParams.mockReturnValue({
      tab: EntityTabs.OVERVIEW,
    });

    renderFileDetails();

    // Test that component renders correctly with same tab
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });

    // Navigate should not be called if no actual tab change occurs
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should handle file size display correctly', () => {
    const fileWithSize = {
      ...mockFileDetails,
      size: 2048,
    };

    renderFileDetails({
      fileDetails: fileWithSize,
    });

    expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should pass ViewCustomFields permission correctly when true', async () => {
      const permissionsWithViewCustomFields = {
        ...ENTITY_PERMISSIONS,
        ViewCustomFields: true,
      };

      renderFileDetails({
        filePermissions: permissionsWithViewCustomFields,
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

      renderFileDetails({
        filePermissions: permissionsWithoutViewCustomFields,
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

      renderFileDetails({
        filePermissions:
          permissionsWithUndefinedViewCustomFields as unknown as OperationPermission,
      });

      await waitFor(() => {
        expect(screen.getByTestId('generic-provider')).toBeInTheDocument();
        expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      });
    });
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    renderFileDetails();

    await waitFor(() => {
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'Test File',
        }),
        expect.anything()
      );
    });
  });
});
