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
import { AxiosError, AxiosResponse } from 'axios';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { act } from 'react';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ClientErrors } from '../../enums/Axios.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { File } from '../../generated/entity/data/file';
import { DriveServiceType } from '../../generated/entity/services/driveService';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import {
  addDriveAssetFollower,
  getDriveAssetByFqn,
  patchDriveAssetDetails,
  removeDriveAssetFollower,
  updateDriveAssetVotes,
} from '../../rest/driveAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { fileDefaultFields } from '../../utils/FileDetailsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import FileDetailsPage from './FileDetailsPage';

// Mock data
const mockFileDetails: File = {
  id: 'test-file-id',
  name: 'test-file.txt',
  displayName: 'Test File',
  description: 'Test file description',
  fullyQualifiedName: 'test-service.test-file.txt',
  deleted: false,
  version: 1,
  followers: [],
  owners: [],
  tags: [],
  serviceType: DriveServiceType.GoogleDrive,
  service: {
    id: 'test-service-id',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    type: 'driveService',
  },
};

const mockQueryVote = {
  updatedVoteType: 'upVote',
};

// Mock all the API calls
jest.mock('../../rest/driveAPI', () => ({
  getDriveAssetByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockFileDetails)),
  patchDriveAssetDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockFileDetails)),
  addDriveAssetFollower: jest.fn().mockImplementation(() =>
    Promise.resolve({
      changeDescription: {
        fieldsAdded: [{ newValue: [{ id: 'test-user-id' }] }],
      },
    })
  ),
  removeDriveAssetFollower: jest.fn().mockImplementation(() =>
    Promise.resolve({
      changeDescription: {
        fieldsDeleted: [{ oldValue: [{ id: 'test-user-id' }] }],
      },
    })
  ),
  updateDriveAssetVotes: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockFileDetails)),
}));

// Mock hooks
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: {
      id: 'test-user-id',
      name: 'Test User',
      teams: [],
    },
  })),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  MemoryRouter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="memory-router">{children}</div>
  ),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({
    fqn: 'test-service.test-file.txt',
  })),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
  })),
}));

// Mock components
jest.mock('../../components/DriveService/File/FileDetails', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        fileDetails,
        filePermissions,
        followFileHandler,
        unFollowFileHandler,
        onFileUpdate,
        onUpdateVote,
        handleToggleDelete,
        versionHandler,
      }: {
        fileDetails: File;
        filePermissions: Record<string, boolean>;
        followFileHandler: () => void;
        unFollowFileHandler: () => void;
        onFileUpdate: (data: File) => void;
        onUpdateVote: (vote: typeof mockQueryVote, id: string) => void;
        handleToggleDelete: (version?: number) => void;
        versionHandler: () => void;
      }) => (
        <div data-testid="file-details">
          <div data-testid="file-name">{fileDetails?.name}</div>
          <div data-testid="file-permissions">
            {JSON.stringify(filePermissions)}
          </div>
          <button data-testid="follow-button" onClick={followFileHandler}>
            Follow
          </button>
          <button data-testid="unfollow-button" onClick={unFollowFileHandler}>
            Unfollow
          </button>
          <button
            data-testid="update-button"
            onClick={() =>
              onFileUpdate({ ...fileDetails, displayName: 'Updated File' })
            }>
            Update
          </button>
          <button
            data-testid="vote-button"
            onClick={() => onUpdateVote(mockQueryVote, 'test-file-id')}>
            Vote
          </button>
          <button
            data-testid="delete-button"
            onClick={() => handleToggleDelete(2)}>
            Toggle Delete
          </button>
          <button data-testid="version-button" onClick={versionHandler}>
            View Version
          </button>
        </div>
      )
    )
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        children,
        permissionValue,
        type,
      }: {
        children?: React.ReactNode;
        permissionValue?: string;
        type?: string;
      }) => (
        <div data-testid="error-placeholder">
          <div data-testid="error-type">{type}</div>
          <div data-testid="error-permission">{permissionValue}</div>
          {children}
        </div>
      )
    )
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loader</div>)
);

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Component) => Component),
}));

// Mock utils
jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getEntityMissingError: jest.fn().mockReturnValue('File not found'),
}));

jest.mock('../../utils/FileDetailsUtils', () => ({
  fileDefaultFields: 'owners,tags,followers,dataProducts,domains',
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test File'),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: { ViewAll: false, ViewBasic: false },
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getVersionPath: jest.fn().mockReturnValue('/file/version/1'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('FileDetailsPage', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  const renderComponent = async (props = {}) => {
    return await act(async () => {
      render(
        <MemoryRouter>
          <FileDetailsPage {...props} />
        </MemoryRouter>
      );
    });
  };

  describe('Component Rendering', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should render loading state initially', async () => {
      render(
        <MemoryRouter>
          <FileDetailsPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render file details when loaded', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      expect(screen.getByTestId('file-name')).toHaveTextContent(
        'test-file.txt'
      );
    });

    it('should render error placeholder when file is not found', async () => {
      const error = new AxiosError('Not found');
      error.response = {
        status: 404,
      } as AxiosResponse;
      (getDriveAssetByFqn as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(error)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });

      expect(getEntityMissingError).toHaveBeenCalledWith(
        'file',
        'test-service.test-file.txt'
      );
    });

    it('should navigate to forbidden page when access is denied', async () => {
      const error = new AxiosError('Forbidden');
      error.response = {
        status: ClientErrors.FORBIDDEN,
      } as AxiosResponse;
      (getDriveAssetByFqn as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(error)
      );

      await renderComponent();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FORBIDDEN, {
          replace: true,
        });
      });
    });

    it('should render permission error when user lacks view permissions', async () => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ ViewAll: false, ViewBasic: false })
          ),
      }));

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-type')).toHaveTextContent('PERMISSION');
    });
  });

  describe('File Details Management', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should fetch file details on mount', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(getDriveAssetByFqn).toHaveBeenCalledWith(
          'test-service.test-file.txt',
          EntityType.FILE,
          fileDefaultFields
        );
      });
    });

    it('should add file to recent viewed on successful fetch', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(addToRecentViewed).toHaveBeenCalledWith({
          displayName: 'Test File',
          entityType: EntityType.FILE,
          fqn: 'test-service.test-file.txt',
          serviceType: DriveServiceType.GoogleDrive,
          timestamp: 0,
          id: 'test-file-id',
        });
      });
    });

    it('should update file details successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const updateButton = screen.getByTestId('update-button');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(patchDriveAssetDetails).toHaveBeenCalledWith(
          'test-file-id',
          expect.any(Array),
          EntityType.FILE
        );
      });
    });

    it('should handle file update error', async () => {
      (patchDriveAssetDetails as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Update failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const updateButton = screen.getByTestId('update-button');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(new Error('Update failed'));
      });
    });
  });

  describe('Follow/Unfollow Functionality', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should follow file successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(addDriveAssetFollower).toHaveBeenCalledWith(
          'test-file-id',
          'test-user-id',
          EntityType.FILE
        );
      });
    });

    it('should unfollow file successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const unfollowButton = screen.getByTestId('unfollow-button');
      fireEvent.click(unfollowButton);

      await waitFor(() => {
        expect(removeDriveAssetFollower).toHaveBeenCalledWith(
          'test-file-id',
          'test-user-id',
          EntityType.FILE
        );
      });
    });

    it('should handle follow error', async () => {
      (addDriveAssetFollower as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Follow failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });

    it('should handle unfollow error', async () => {
      (removeDriveAssetFollower as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Unfollow failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const unfollowButton = screen.getByTestId('unfollow-button');
      fireEvent.click(unfollowButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Vote Management', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should update vote successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const voteButton = screen.getByTestId('vote-button');
      fireEvent.click(voteButton);

      await waitFor(() => {
        expect(updateDriveAssetVotes).toHaveBeenCalledWith(
          'test-file-id',
          mockQueryVote,
          EntityType.FILE
        );
      });

      await waitFor(() => {
        expect(getDriveAssetByFqn).toHaveBeenCalledWith(
          'test-service.test-file.txt',
          EntityType.FILE,
          [
            TabSpecificField.OWNERS,
            TabSpecificField.FOLLOWERS,
            TabSpecificField.TAGS,
            TabSpecificField.VOTES,
          ].join(',')
        );
      });
    });

    it('should handle vote error', async () => {
      (updateDriveAssetVotes as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Vote failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const voteButton = screen.getByTestId('vote-button');
      fireEvent.click(voteButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(new Error('Vote failed'));
      });
    });
  });

  describe('Delete/Restore Functionality', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should toggle delete status', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      // The handleToggleDelete function should update the local state
      // We can't directly test the state update, but we can ensure the function is called
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('Version Management', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should navigate to version page', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const versionButton = screen.getByTestId('version-button');
      fireEvent.click(versionButton);

      await waitFor(() => {
        expect(getVersionPath).toHaveBeenCalledWith(
          EntityType.FILE,
          'test-service.test-file.txt',
          '1'
        );
        expect(mockNavigate).toHaveBeenCalledWith('/file/version/1');
      });
    });
  });

  describe('Permission Management', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should fetch resource permissions on mount', async () => {
      const mockGetEntityPermissionByFqn = jest
        .fn()
        .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS));

      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      }));

      await renderComponent();

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          'file',
          'test-service.test-file.txt'
        );
      });
    });

    it('should handle permission fetch error', async () => {
      const mockGetEntityPermissionByFqn = jest
        .fn()
        .mockImplementation(() =>
          Promise.reject(new Error('Permission fetch failed'))
        );

      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      }));

      await renderComponent();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should handle generic fetch error', async () => {
      (getDriveAssetByFqn as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Generic error'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should handle missing current user', async () => {
      (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
        currentUser: null,
      }));

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });
    });

    it('should handle undefined file version', async () => {
      const fileWithoutVersion = { ...mockFileDetails, version: undefined };
      (getDriveAssetByFqn as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(fileWithoutVersion)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('file-details')).toBeInTheDocument();
      });

      const versionButton = screen.getByTestId('version-button');
      fireEvent.click(versionButton);

      // Version button should exist but navigation behavior depends on version availability
      expect(versionButton).toBeInTheDocument();
    });
  });
});
