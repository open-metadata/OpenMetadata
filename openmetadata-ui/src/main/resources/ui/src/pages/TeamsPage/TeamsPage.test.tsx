/*
 *  Copyright 2024 Collate.
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

import { act, render, screen } from '@testing-library/react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TeamType } from '../../generated/entity/teams/team';
import { Include } from '../../generated/type/include';
import { mockUserData } from '../../mocks/MyDataPage.mock';
import { MOCK_CURRENT_TEAM, MOCK_TABLE_DATA } from '../../mocks/Teams.mock';
import { searchQuery } from '../../rest/searchAPI';
import { getTeamByName, getTeams } from '../../rest/teamsAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import TeamsPage from './TeamsPage';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('./AddTeamForm', () => {
  return jest.fn().mockImplementation(() => <p>AddTeamForm</p>);
});

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <p>testTagsContainerV2</p>);
});

const mockOnShowDeletedTeamChange = jest.fn();

jest.mock('../../components/Settings/Team/TeamDetails/TeamDetailsV1', () => {
  return jest.fn().mockImplementation(({ onShowDeletedTeamChange }) => {
    mockOnShowDeletedTeamChange.mockImplementation(onShowDeletedTeamChange);

    return <p>TeamDetailsV1</p>;
  });
});

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest
      .fn()
      .mockImplementation(({ type }) => (
        <p>
          {type === ERROR_PLACEHOLDER_TYPE.PERMISSION
            ? 'Permission_Error_Placeholder'
            : 'No_Data_Error_Placeholder'}
        </p>
      ));
  }
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getTeamsWithFqnPath: jest.fn(),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityReferenceFromEntity: jest.fn(),
}));

jest.mock('../../rest/userAPI', () => ({
  updateUserDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_CURRENT_TEAM)),
  createTeam: jest.fn().mockImplementation(() => Promise.resolve()),
  getTeams: jest.fn().mockImplementation(() => Promise.resolve()),
  patchTeamDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { total: { value: 0 } } }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test' }),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
}));

describe('Test Teams Page', () => {
  it('should render loader initially', async () => {
    render(<TeamsPage />);

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should fetch getEntityPermissionByFqn on initial load', async () => {
    render(<TeamsPage />);

    expect(mockEntityPermissionByFqn).toHaveBeenCalledWith(
      ResourceEntity.TEAM,
      'test'
    );
  });

  it('should render permission_errorPlaceholder if not having viewBasic or viewAll permission', async () => {
    await act(async () => {
      render(<TeamsPage />);
    });

    expect(
      screen.getByText('Permission_Error_Placeholder')
    ).toBeInTheDocument();
  });

  it('should fetch getTeamByName and loadAdvancedDetails if having viewBasic or viewAll permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    const mockGetTeamByName = getTeamByName as jest.Mock;

    await act(async () => {
      render(<TeamsPage />);
    });

    expect(mockGetTeamByName.mock.calls[0]).toEqual([
      'test',
      {
        fields: ['userCount', 'parents', 'profile', 'owners'],
        include: 'all',
      },
    ]);
    expect(mockGetTeamByName.mock.calls[1]).toEqual([
      'test',
      {
        fields: [
          'users',
          'userCount',
          'defaultRoles',
          'policies',
          'childrenCount',
          'domains',
        ],
        include: 'all',
      },
    ]);
  });

  it('should render component data', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<TeamsPage />);
    });

    expect(screen.getByText('TeamDetailsV1')).toBeInTheDocument();
  });

  it('should render errorPlaceholder if getTeamByName api failed', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTeamByName as jest.Mock).mockImplementation(() => Promise.reject());

    await act(async () => {
      render(<TeamsPage />);
    });

    expect(screen.getByText('No_Data_Error_Placeholder')).toBeInTheDocument();

    (getTeamByName as jest.Mock).mockReset();
  });

  it('should fetchAssetCount on page load', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTeamByName as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ...MOCK_CURRENT_TEAM, teamType: TeamType.Group })
    );

    await act(async () => {
      render(<TeamsPage />);
    });

    expect(searchQuery).toHaveBeenCalledWith({
      query: '',
      pageNumber: 0,
      pageSize: 0,
      queryFilter: {
        query: {
          bool: {
            must: [
              {
                term: {
                  'owners.id': 'f9578f16-363a-4788-80fb-d05816c9e169',
                },
              },
            ],
          },
        },
      },
      searchIndex: 'all',
    });
  });

  it('should not fetchAssetCount on page load if TeamType is not Group', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTeamByName as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ...MOCK_CURRENT_TEAM, teamType: TeamType.BusinessUnit })
    );

    await act(async () => {
      render(<TeamsPage />);
    });

    expect(searchQuery).not.toHaveBeenCalled();

    (getTeamByName as jest.Mock).mockReset();
  });

  describe('Test getTeams - Tests for fetching teams with flags', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (getTeamByName as jest.Mock).mockImplementation(() =>
        Promise.resolve(MOCK_CURRENT_TEAM)
      );
      (getTeams as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: MOCK_TABLE_DATA })
      );
    });

    it('should fetch non-deleted teams when showDeletedTeam is false (default)', async () => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest.fn().mockImplementation(() => ({
          ViewBasic: true,
        })),
      }));

      await act(async () => {
        render(<TeamsPage />);
      });

      expect(getTeams).toHaveBeenCalledWith(
        expect.objectContaining({
          include: Include.NonDeleted,
        })
      );
    });

    it('should fetch deleted teams when showDeletedTeam is toggled to true', async () => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest.fn().mockImplementation(() => ({
          ViewBasic: true,
        })),
      }));

      await act(async () => {
        render(<TeamsPage />);
      });

      (getTeams as jest.Mock).mockClear();

      await act(async () => {
        mockOnShowDeletedTeamChange();
      });

      expect(getTeams).toHaveBeenCalledWith(
        expect.objectContaining({
          include: Include.Deleted,
        })
      );
    });

    it('should fetch non-deleted teams when showDeletedTeam is toggled back to false', async () => {
      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: jest.fn().mockImplementation(() => ({
          ViewBasic: true,
        })),
      }));

      await act(async () => {
        render(<TeamsPage />);
      });

      await act(async () => {
        mockOnShowDeletedTeamChange();
      });

      (getTeams as jest.Mock).mockClear();

      await act(async () => {
        mockOnShowDeletedTeamChange();
      });

      expect(getTeams).toHaveBeenCalledWith(
        expect.objectContaining({
          include: Include.NonDeleted,
        })
      );
    });
  });
});
