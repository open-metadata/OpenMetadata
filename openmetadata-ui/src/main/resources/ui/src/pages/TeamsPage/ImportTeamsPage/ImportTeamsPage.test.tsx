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
import {
  act,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import React from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  MOCK_CURRENT_TEAM,
  MOCK_MARKETING_TEAM,
} from '../../../mocks/Teams.mock';
import {
  getTeamByName,
  importTeam,
  importUserInTeam,
} from '../../../rest/teamsAPI';
import { getTeamsWithFqnPath } from '../../../utils/RouterUtils';
import ImportTeamsPage from './ImportTeamsPage';

jest.mock(
  '../../../components/common/EntityImport/EntityImport.component',
  () => ({
    EntityImport: jest
      .fn()
      .mockImplementation(({ children, onImport, onCancel }) => {
        return (
          <div data-testid="entity-import">
            {children}{' '}
            <button data-testid="import" onClick={onImport}>
              import
            </button>
            <button data-testid="cancel" onClick={onCancel}>
              cancel
            </button>
          </div>
        );
      }),
  })
);
jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(({ children }) => {
      return (
        <div>
          ErrorPlaceHolder
          <div>{children}</div>
        </div>
      );
    });
  }
);
jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => {
      return <div>TitleBreadcrumb</div>;
    });
  }
);
jest.mock('../../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => {
    return <div>Loader</div>;
  });
});
jest.mock(
  '../../../components/Settings/Team/TeamImportResult/TeamImportResult.component',
  () => ({
    TeamImportResult: jest.fn().mockImplementation(() => {
      return <div>TeamImportResult</div>;
    }),
  })
);
jest.mock(
  '../../../components/Settings/Team/UserImportResult/UserImportResult.component',
  () => ({
    UserImportResult: jest.fn().mockImplementation(() => {
      return <div>UserImportResult</div>;
    }),
  })
);

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => {
    return <div>{children}</div>;
  });
});

const mockParams = {
  fqn: 'Organization',
};
const mockLocation = {
  search: '?type=teams',
};
const mockHistory = {
  push: jest.fn(),
};
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => mockHistory),
  useParams: jest.fn().mockImplementation(() => mockParams),
  useLocation: jest.fn().mockImplementation(() => mockLocation),
}));
jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_CURRENT_TEAM)),
  importTeam: jest.fn(),
  importUserInTeam: jest.fn(),
}));
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
      EditAll: true,
    }),
  }),
}));

describe('ImportTeamsPage', () => {
  it('Component should render', async () => {
    act(() => {
      render(<ImportTeamsPage />);
    });

    expect(await screen.findByTestId('import-teams')).toBeInTheDocument();
    expect(await screen.findByTestId('title')).toBeInTheDocument();
    expect(await screen.findByTestId('cancel')).toBeInTheDocument();
    expect(await screen.findByTestId('entity-import')).toBeInTheDocument();
  });

  it('No permission Placeholder should visible, if there is no create permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementation(() =>
        Promise.resolve({
          Create: false,
        })
      ),
    }));
    act(() => {
      render(<ImportTeamsPage />);
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('ErrorPlaceHolder should be visible if teams API fail', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() => Promise.reject());
    act(() => {
      render(<ImportTeamsPage />);
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('Loader should visible is data is loading', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() => Promise.reject());
    act(() => {
      render(<ImportTeamsPage />);
    });
    // To check if loader was rendered when the loading state was true and then removed after loading is false
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('TeamImportResult should visible', async () => {
    (importTeam as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          dryRun: true,
          status: 'success',
          numberOfRowsProcessed: 1,
          numberOfRowsPassed: 1,
          numberOfRowsFailed: 0,
          importResultsCsv:
            'status,details,name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies\r\nsuccess,Entity updated,Applications,,,Group,Engineering,,true,,\r\n',
        },
      })
    );
    act(() => {
      render(<ImportTeamsPage />);
    });
    const importBtn = await screen.findByTestId('import');
    await act(async () => {
      fireEvent.click(importBtn);
    });

    expect(await screen.findByText('TeamImportResult')).toBeInTheDocument();
  });

  it('If team type is group and import type is team, Error placeholder should visible', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_MARKETING_TEAM)
    );
    act(() => {
      render(<ImportTeamsPage />);
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'message.group-type-team-not-allowed-to-have-sub-team'
      )
    ).toBeInTheDocument();
  });

  it('Should redirect to team tab of teams page on clicking of cancel', async () => {
    act(() => {
      render(<ImportTeamsPage />);
    });
    const cancelBtn = await screen.findByTestId('cancel');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockHistory.push).toHaveBeenCalledWith({
      pathname: getTeamsWithFqnPath(MOCK_CURRENT_TEAM.fullyQualifiedName),
      search: 'activeTab=teams',
    });
  });

  // keep user import related test below this
  it('UserImportResult should visible', async () => {
    mockLocation.search = '?type=users';
    (importUserInTeam as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          dryRun: true,
          status: 'success',
          numberOfRowsProcessed: 1,
          numberOfRowsPassed: 1,
          numberOfRowsFailed: 0,
          importResultsCsv:
            // eslint-disable-next-line max-len
            'status,details,name*,displayName,description,email*,timezone,isAdmin,teams*,Roles\r\nsuccess,Entity updated,aaron_johnson0,Aaron Johnson,,aaron_johnson0@gmail.com,,false,Applications,DataSteward\r\n',
        },
      })
    );
    act(() => {
      render(<ImportTeamsPage />);
    });
    const importBtn = await screen.findByTestId('import');
    await act(async () => {
      fireEvent.click(importBtn);
    });

    expect(await screen.findByText('UserImportResult')).toBeInTheDocument();
  });

  it('Should redirect to users tab of teams page on clicking of cancel', async () => {
    mockLocation.search = '?type=users';
    act(() => {
      render(<ImportTeamsPage />);
    });
    const cancelBtn = await screen.findByTestId('cancel');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockHistory.push).toHaveBeenCalledWith({
      pathname: getTeamsWithFqnPath(MOCK_CURRENT_TEAM.fullyQualifiedName),
      search: 'activeTab=users',
    });
  });
});
