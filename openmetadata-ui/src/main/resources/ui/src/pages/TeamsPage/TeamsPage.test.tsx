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
import { mockUserData } from '../../mocks/MyDataPage.mock';
import { MOCK_CURRENT_TEAM } from '../../mocks/Teams.mock';
import { searchData } from '../../rest/miscAPI';
import { getTeamByName } from '../../rest/teamsAPI';
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

jest.mock('../../components/Settings/Team/TeamDetails/TeamDetailsV1', () => {
  return jest.fn().mockImplementation(() => <p>TeamDetailsV1</p>);
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

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
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

    expect(searchData).toHaveBeenCalledWith(
      '',
      0,
      0,
      'owners.id:f9578f16-363a-4788-80fb-d05816c9e169',
      '',
      '',
      'all'
    );
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

    expect(searchData).not.toHaveBeenCalled();

    (getTeamByName as jest.Mock).mockReset();
  });
});
