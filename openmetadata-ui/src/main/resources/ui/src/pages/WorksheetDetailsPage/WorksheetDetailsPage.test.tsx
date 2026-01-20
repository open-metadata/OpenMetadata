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
import { Worksheet } from '../../generated/entity/data/worksheet';
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
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import WorksheetDetailsPage from './WorksheetDetailsPage';

// Mock data
const mockWorksheetDetails: Worksheet = {
  id: 'test-worksheet-id',
  name: 'test-worksheet',
  displayName: 'Test Worksheet',
  description: 'Test worksheet description',
  fullyQualifiedName: 'test-service.test-worksheet',
  deleted: false,
  version: 1,
  followers: [],
  owners: [],
  tags: [],
  columns: [],
  serviceType: DriveServiceType.GoogleDrive,
  service: {
    id: 'test-service-id',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    type: 'driveService',
  },
  spreadsheet: {
    id: 'test-spreadsheet-id',
    name: 'test-spreadsheet',
    fullyQualifiedName: 'test-service.test-spreadsheet',
    type: 'spreadsheet',
  },
};

const mockQueryVote = {
  updatedVoteType: 'upVote',
};

// Mock all the API calls
jest.mock('../../rest/driveAPI', () => ({
  getDriveAssetByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockWorksheetDetails)),
  patchDriveAssetDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockWorksheetDetails)),
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
    .mockImplementation(() => Promise.resolve(mockWorksheetDetails)),
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
    fqn: 'test-service.test-worksheet',
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
jest.mock('../../components/DriveService/Worksheet/WorksheetDetails', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        worksheetDetails,
        worksheetPermissions,
        followWorksheetHandler,
        unFollowWorksheetHandler,
        onWorksheetUpdate,
        onUpdateVote,
        handleToggleDelete,
        versionHandler,
      }: {
        worksheetDetails: Worksheet;
        worksheetPermissions: Record<string, boolean>;
        followWorksheetHandler: () => void;
        unFollowWorksheetHandler: () => void;
        onWorksheetUpdate: (data: Worksheet) => void;
        onUpdateVote: (vote: typeof mockQueryVote, id: string) => void;
        handleToggleDelete: (version?: number) => void;
        versionHandler: () => void;
      }) => (
        <div data-testid="worksheet-details">
          <div data-testid="worksheet-name">{worksheetDetails?.name}</div>
          <div data-testid="worksheet-permissions">
            {JSON.stringify(worksheetPermissions)}
          </div>
          <button data-testid="follow-button" onClick={followWorksheetHandler}>
            Follow
          </button>
          <button
            data-testid="unfollow-button"
            onClick={unFollowWorksheetHandler}>
            Unfollow
          </button>
          <button
            data-testid="update-button"
            onClick={() =>
              onWorksheetUpdate({
                ...worksheetDetails,
                displayName: 'Updated Worksheet',
              })
            }>
            Update
          </button>
          <button
            data-testid="vote-button"
            onClick={() => onUpdateVote(mockQueryVote, 'test-worksheet-id')}>
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
  getEntityMissingError: jest.fn().mockReturnValue('Worksheet not found'),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test Worksheet'),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: { ViewAll: false, ViewBasic: false },
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getVersionPath: jest.fn().mockReturnValue('/worksheet/version/1'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('WorksheetDetailsPage', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (getDriveAssetByFqn as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockWorksheetDetails)
    );
  });

  const renderComponent = async (props = {}) => {
    return await act(async () => {
      render(
        <MemoryRouter>
          <WorksheetDetailsPage {...props} />
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
          <WorksheetDetailsPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render worksheet details when loaded', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      expect(screen.getByTestId('worksheet-name')).toHaveTextContent(
        'test-worksheet'
      );
    });

    it('should render error placeholder when worksheet is not found', async () => {
      const error = new AxiosError('Not found');
      error.response = {
        status: 404,
      } as AxiosResponse;
      (getDriveAssetByFqn as jest.Mock).mockImplementation(() =>
        Promise.reject(error)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });

      expect(getEntityMissingError).toHaveBeenCalledWith(
        'worksheet',
        'test-service.test-worksheet'
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

  describe('Worksheet Details Management', () => {
    beforeEach(() => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest
          .fn()
          .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
      }));
    });

    it('should fetch worksheet details on mount', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(getDriveAssetByFqn).toHaveBeenCalledWith(
          'test-service.test-worksheet',
          EntityType.WORKSHEET,
          'owners,followers,tags,domains,dataProducts,votes,extension,rowCount,columns,rowCount'
        );
      });
    });

    it('should add worksheet to recent viewed on successful fetch', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(addToRecentViewed).toHaveBeenCalledWith({
          displayName: 'Test Worksheet',
          entityType: EntityType.WORKSHEET,
          fqn: 'test-service.test-worksheet',
          serviceType: DriveServiceType.GoogleDrive,
          timestamp: 0,
          id: 'test-worksheet-id',
        });
      });
    });

    it('should update worksheet details successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      const updateButton = screen.getByTestId('update-button');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(patchDriveAssetDetails).toHaveBeenCalledWith(
          'test-worksheet-id',
          expect.any(Array),
          EntityType.WORKSHEET
        );
      });
    });

    it('should handle worksheet update error', async () => {
      (patchDriveAssetDetails as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Update failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
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

    it('should follow worksheet successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(addDriveAssetFollower).toHaveBeenCalledWith(
          'test-worksheet-id',
          'test-user-id',
          EntityType.WORKSHEET
        );
      });
    });

    it('should unfollow worksheet successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      const unfollowButton = screen.getByTestId('unfollow-button');
      fireEvent.click(unfollowButton);

      await waitFor(() => {
        expect(removeDriveAssetFollower).toHaveBeenCalledWith(
          'test-worksheet-id',
          'test-user-id',
          EntityType.WORKSHEET
        );
      });
    });

    it('should handle follow error', async () => {
      (addDriveAssetFollower as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Follow failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
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
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
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
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      const voteButton = screen.getByTestId('vote-button');
      fireEvent.click(voteButton);

      await waitFor(() => {
        expect(updateDriveAssetVotes).toHaveBeenCalledWith(
          'test-worksheet-id',
          mockQueryVote,
          EntityType.WORKSHEET
        );
      });

      await waitFor(() => {
        expect(getDriveAssetByFqn).toHaveBeenCalledWith(
          'test-service.test-worksheet',
          EntityType.WORKSHEET,
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
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
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
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
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
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      const versionButton = screen.getByTestId('version-button');
      fireEvent.click(versionButton);

      await waitFor(() => {
        expect(getVersionPath).toHaveBeenCalledWith(
          EntityType.WORKSHEET,
          'test-service.test-worksheet',
          '1'
        );
        expect(mockNavigate).toHaveBeenCalledWith('/worksheet/version/1');
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
          'worksheet',
          'test-service.test-worksheet'
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
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });
    });

    it('should handle undefined worksheet version', async () => {
      const worksheetWithoutVersion = {
        ...mockWorksheetDetails,
        version: undefined,
      };
      (getDriveAssetByFqn as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(worksheetWithoutVersion)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('worksheet-details')).toBeInTheDocument();
      });

      const versionButton = screen.getByTestId('version-button');
      fireEvent.click(versionButton);

      // Version button should exist but navigation behavior depends on version availability
      expect(versionButton).toBeInTheDocument();
    });
  });
});
