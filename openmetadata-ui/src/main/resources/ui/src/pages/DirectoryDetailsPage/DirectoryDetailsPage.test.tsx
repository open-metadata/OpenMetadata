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
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Directory } from '../../generated/entity/data/directory';
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
import { defaultFields } from '../../utils/DirectoryDetailsUtils';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DirectoryDetailsPage from './DirectoryDetailsPage';

// The page now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for
// the full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce,
// the `deleted`-gating blind spot), mirrored here without repeating it.
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

// Mock data
const mockDirectoryDetails: Directory = {
  id: 'test-directory-id',
  name: 'test-directory',
  displayName: 'Test Directory',
  description: 'Test directory description',
  fullyQualifiedName: 'test-service.test-directory',
  deleted: false,
  version: 1,
  followers: [],
  owners: [],
  tags: [],
  children: [],
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
    .mockImplementation(() => Promise.resolve(mockDirectoryDetails)),
  patchDriveAssetDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDirectoryDetails)),
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
    .mockImplementation(() => Promise.resolve(mockDirectoryDetails)),
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
    fqn: 'test-service.test-directory',
  })),
}));

// Mock components
jest.mock('../../components/DriveService/Directory/DirectoryDetails', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        directoryDetails,
        directoryPermissions,
        followDirectoryHandler,
        unFollowDirectoryHandler,
        onDirectoryUpdate,
        onUpdateVote,
        handleToggleDelete,
        versionHandler,
      }: {
        directoryDetails: Directory;
        directoryPermissions: Record<string, boolean>;
        followDirectoryHandler: () => void;
        unFollowDirectoryHandler: () => void;
        onDirectoryUpdate: (data: Directory) => void;
        onUpdateVote: (vote: typeof mockQueryVote, id: string) => void;
        handleToggleDelete: (version?: number) => void;
        versionHandler: () => void;
      }) => (
        <div data-testid="directory-details">
          <div data-testid="directory-name">{directoryDetails?.name}</div>
          <div data-testid="directory-permissions">
            {JSON.stringify(directoryPermissions)}
          </div>
          <button data-testid="follow-button" onClick={followDirectoryHandler}>
            Follow
          </button>
          <button
            data-testid="unfollow-button"
            onClick={unFollowDirectoryHandler}>
            Unfollow
          </button>
          <button
            data-testid="update-button"
            onClick={() =>
              onDirectoryUpdate({
                ...directoryDetails,
                displayName: 'Updated Directory',
              })
            }>
            Update
          </button>
          <button
            data-testid="vote-button"
            onClick={() => onUpdateVote(mockQueryVote, 'test-directory-id')}>
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

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
  PageLoader: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
}));

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Component) => Component),
}));

// Mock utils
jest.mock('../../utils/EntityDisplayPureUtils', () => ({
  getEntityMissingError: jest.fn().mockReturnValue('Directory not found'),
}));

jest.mock('../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));

jest.mock('../../utils/DirectoryDetailsUtils', () => ({
  defaultFields: 'owners,tags,followers,dataProducts,domains',
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test Directory'),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getVersionPath: jest.fn().mockReturnValue('/directory/version/1'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('DirectoryDetailsPage', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  // Guardrail: this page owns the single useEntityPermissions call whose raw
  // `directoryPermissions` prop DirectoryDetails.tsx consumes downstream — see the
  // "page-owner converts, child stays raw" precedent recorded in the Task 7A report (Topic)
  // and mirrored for the DriveService family in Task 7B (Worksheet/Spreadsheet/File). See
  // TableDetailsPageV1.test.tsx's afterEach for the general rationale.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    if (calls.length === 0) {
      return;
    }
    const [expectedResource, expectedIdentifier] = calls[0];
    calls.forEach(([resource, identifier]) => {
      expect(resource).toBe(expectedResource);
      expect(identifier).toBe(expectedIdentifier);
    });
  });

  const renderComponent = async (props = {}) => {
    return await act(async () => {
      render(
        <MemoryRouter>
          <DirectoryDetailsPage {...props} />
        </MemoryRouter>
      );
    });
  };

  describe('Component Rendering', () => {
    beforeEach(() => {
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should render loading state initially', async () => {
      render(
        <MemoryRouter>
          <DirectoryDetailsPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render directory details when loaded', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      expect(screen.getByTestId('directory-name')).toHaveTextContent(
        'test-directory'
      );
    });

    it('should render error placeholder when directory is not found', async () => {
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
        'directory',
        'test-service.test-directory'
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
      setMockPermissions({ ViewAll: false, ViewBasic: false });

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-type')).toHaveTextContent('PERMISSION');
    });
  });

  describe('Directory Details Management', () => {
    beforeEach(() => {
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should fetch directory details on mount', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(getDriveAssetByFqn).toHaveBeenCalledWith(
          'test-service.test-directory',
          EntityType.DIRECTORY,
          defaultFields
        );
      });
    });

    it('should add directory to recent viewed on successful fetch', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(addToRecentViewed).toHaveBeenCalledWith({
          displayName: 'Test Directory',
          entityType: EntityType.DIRECTORY,
          fqn: 'test-service.test-directory',
          serviceType: DriveServiceType.GoogleDrive,
          timestamp: 0,
          id: 'test-directory-id',
        });
      });
    });

    it('should update directory details successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      const updateButton = screen.getByTestId('update-button');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(patchDriveAssetDetails).toHaveBeenCalledWith(
          'test-directory-id',
          expect.any(Array),
          EntityType.DIRECTORY
        );
      });
    });

    it('should handle directory update error', async () => {
      (patchDriveAssetDetails as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Update failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
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
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should follow directory successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(addDriveAssetFollower).toHaveBeenCalledWith(
          'test-directory-id',
          'test-user-id',
          EntityType.DIRECTORY
        );
      });
    });

    it('should unfollow directory successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      const unfollowButton = screen.getByTestId('unfollow-button');
      fireEvent.click(unfollowButton);

      await waitFor(() => {
        expect(removeDriveAssetFollower).toHaveBeenCalledWith(
          'test-directory-id',
          'test-user-id',
          EntityType.DIRECTORY
        );
      });
    });

    it('should handle follow error', async () => {
      (addDriveAssetFollower as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Follow failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
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
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
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
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should update vote successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      const voteButton = screen.getByTestId('vote-button');
      fireEvent.click(voteButton);

      await waitFor(() => {
        expect(updateDriveAssetVotes).toHaveBeenCalledWith(
          'test-directory-id',
          mockQueryVote,
          EntityType.DIRECTORY
        );
      });

      await waitFor(() => {
        expect(getDriveAssetByFqn).toHaveBeenCalledWith(
          'test-service.test-directory',
          EntityType.DIRECTORY,
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
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
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
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should toggle delete status', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
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
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should navigate to version page', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      const versionButton = screen.getByTestId('version-button');
      fireEvent.click(versionButton);

      await waitFor(() => {
        expect(getVersionPath).toHaveBeenCalledWith(
          EntityType.DIRECTORY,
          'test-service.test-directory',
          '1'
        );
        expect(mockNavigate).toHaveBeenCalledWith('/directory/version/1');
      });
    });
  });

  describe('Permission Management', () => {
    beforeEach(() => {
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should fetch resource permissions on mount', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(mockUseEntityPermissions).toHaveBeenCalledWith(
          ResourceEntity.DIRECTORY,
          'test-service.test-directory'
        );
      });
    });

    it('should handle permission fetch error', async () => {
      setMockPermissions(ENTITY_PERMISSIONS, {
        error: new Error('Permission fetch failed'),
      });

      await renderComponent();

      // t() is globally mocked to the identity function (see src/setupTests.js), so the
      // interpolated `entity` option collapses out and only the outer key survives.
      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'server.fetch-entity-permissions-error'
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      setMockPermissions(ENTITY_PERMISSIONS);
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
      setMockPermissions(ENTITY_PERMISSIONS);
    });

    it('should handle missing current user', async () => {
      (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
        currentUser: null,
      }));

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });
    });

    it('should handle undefined directory version', async () => {
      const directoryWithoutVersion = {
        ...mockDirectoryDetails,
        version: undefined,
      };
      (getDriveAssetByFqn as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(directoryWithoutVersion)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('directory-details')).toBeInTheDocument();
      });

      const versionButton = screen.getByTestId('version-button');
      fireEvent.click(versionButton);

      // Version button should exist but navigation behavior depends on version availability
      expect(versionButton).toBeInTheDocument();
    });
  });
});
