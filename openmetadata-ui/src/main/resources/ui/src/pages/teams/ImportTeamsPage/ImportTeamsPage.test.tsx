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
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { MOCK_CURRENT_TEAM } from 'mocks/Teams.mock';
import React from 'react';
import { getTeamByName, importTeam } from 'rest/teamsAPI';
import ImportTeamsPage from './ImportTeamsPage';

jest.mock('components/common/EntityImport/EntityImport.component', () => ({
  EntityImport: jest.fn().mockImplementation(({ children, onImport }) => {
    return (
      <div data-testid="entity-import">
        {children}{' '}
        <button data-testid="import" onClick={onImport}>
          import
        </button>
      </div>
    );
  }),
}));
jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ErrorPlaceHolder</div>;
  });
});
jest.mock(
  'components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => {
      return <div>TitleBreadcrumb</div>;
    });
  }
);
jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => {
    return <div>Loader</div>;
  });
});
jest.mock('components/TeamImportResult/TeamImportResult.component', () => ({
  TeamImportResult: jest.fn().mockImplementation(() => {
    return <div>TeamImportResult</div>;
  }),
}));
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => ({ fqn: 'Organization' })),
}));
jest.mock('rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_CURRENT_TEAM })),
  importTeam: jest.fn(),
}));
jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
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
});
