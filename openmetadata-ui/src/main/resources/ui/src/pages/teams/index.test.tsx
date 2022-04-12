/*
 *  Copyright 2021 Collate
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
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { createTeam, getTeamByName, getTeams } from '../../axiosAPIs/teamsAPI';
import jsonData from '../../jsons/en';
import TeamsPage from './index';

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

const mockTeamsData = [
  {
    description: '',
    displayName: 'Cloud Infra',
    href: 'href1',
    id: 'id1',
    name: 'Cloud_Infra',
  },
  {
    description: '',
    displayName: 'Cloud Infra 2',
    href: 'href2',
    id: 'id2',
    name: 'Cloud_Infra 2',
  },
  {
    description: '',
    displayName: 'Cloud Infra 3',
    href: 'href3',
    id: 'id3',
    name: 'Cloud_Infra 3',
  },
];

const mockDataTeamByName = {
  description: '',
  displayName: 'Customer Support',
  href: 'http://localhost:8585/api/v1/teams/f6b906cc-005b-4d68-b7f7-62d591a8d9dd',
  id: 'f6b906cc-005b-4d68-b7f7-62d591a8d9dd',
  name: 'Customer_Support',
  owns: [
    {
      description: 'Robert Mitchell',
      href: 'href',
      id: 'id1',
      name: 'robert_mitchell6',
      type: 'user',
    },
    {
      description: 'Shane Davis',
      href: 'href',
      id: 'id2',
      name: 'shane_davis8',
      type: 'user',
    },
  ],
  users: [
    {
      description: 'Robert Mitchell',
      href: 'href',
      id: 'id1',
      name: 'robert_mitchell6',
      type: 'user',
    },
    {
      description: 'Shane Davis',
      href: 'href',
      id: 'id2',
      name: 'shane_davis8',
      type: 'user',
    },
  ],
};

jest.mock('../../axiosAPIs/teamsAPI', () => ({
  createTeam: jest.fn(),
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockDataTeamByName })),
  getTeams: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: { data: mockTeamsData } })
    ),
  patchTeamDetail: jest.fn(),
  deleteTeam: jest.fn(),
}));

jest.mock(
  '../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

jest.mock('../../components/Modals/FormModal', () => {
  return jest.fn().mockReturnValue(<p data-testid="form-modal">FormModal</p>);
});

jest.mock(
  '../../components/containers/PageContainerV1',
  () =>
    ({ children }: { children: ReactNode }) =>
      <div data-testid="PageContainer">{children}</div>
);

jest.mock(
  '../../components/containers/PageLayout',
  () =>
    ({ children, leftPanel }: { children: ReactNode; leftPanel: ReactNode }) =>
      (
        <div data-testid="page-layout">
          <div data-testid="left-panel-content">{leftPanel}</div>
          {children}
        </div>
      )
);

jest.mock('react-router-dom', () => ({
  Link: jest.fn(({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  )),
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({ team: 'team' }),
}));

jest.mock('./AddUsersModal', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="add-user-modal">AddUsersModal</p>);
});

jest.mock('../../components/common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest.fn(),
  })
);

jest.mock('./UserCard', () => {
  return jest.fn().mockReturnValue(<div>UserCard</div>);
});

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<div>Description</div>);
});

jest.mock('../../components/ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<div>ManageTab</div>);
});

describe('Test Teams page', () => {
  it('Component should render', async () => {
    const { container } = render(<TeamsPage />);
    const teamComponent = await findByTestId(container, 'team-container');
    const leftPanelContent = await findByTestId(
      container,
      'left-panel-content'
    );
    const header = await findByTestId(container, 'header');
    const userCard = await findByTestId(container, 'user-card-container');

    expect(teamComponent).toBeInTheDocument();
    expect(leftPanelContent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(userCard).toBeInTheDocument();
  });

  it('OnClick of assets tab, assets tab should display', async () => {
    const { container } = render(<TeamsPage />);
    const assets = await findByTestId(container, 'assets');

    fireEvent.click(
      assets,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(await findByTestId(container, 'dataset-card')).toBeInTheDocument();
  });

  it('OnClick of add new user, AddUsersModal should display', async () => {
    const { container } = render(<TeamsPage />);
    const addNewUser = await findByTestId(container, 'add-new-user-button');

    expect(addNewUser).toBeInTheDocument();

    fireEvent.click(
      addNewUser,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(await findByTestId(container, 'add-user-modal')).toBeInTheDocument();
  });

  it('Should have 4 tabs in the page', async () => {
    const { container } = render(<TeamsPage />);

    const tabs = await findByTestId(container, 'tabs');
    const user = await findByTestId(container, 'users');
    const asstes = await findByTestId(container, 'assets');
    const roles = await findByTestId(container, 'roles');
    const manage = await findByTestId(container, 'manage');

    expect(tabs.childElementCount).toBe(4);
    expect(user).toBeInTheDocument();
    expect(asstes).toBeInTheDocument();
    expect(roles).toBeInTheDocument();
    expect(manage).toBeInTheDocument();
  });

  it('Description should be in document', async () => {
    const { container } = render(<TeamsPage />);

    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const description = await findByText(container, /Description/i);

    expect(descriptionContainer).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('onClick of add team button, FormModal should open', async () => {
    const { container } = render(<TeamsPage />);

    const addButton = await findByTestId(container, 'add-teams');

    expect(addButton).toBeInTheDocument();

    fireEvent.click(
      addButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(await findByTestId(container, 'form-modal')).toBeInTheDocument();
  });

  it('onClick of delete team button, delete modal should open', async () => {
    const { container } = render(<TeamsPage />);

    const deleteTeamButton = await findByTestId(
      container,
      'delete-team-button'
    );

    expect(deleteTeamButton).toBeInTheDocument();

    fireEvent.click(
      deleteTeamButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    const confirmationModal = await findByTestId(
      container,
      'confirmation-modal'
    );

    expect(confirmationModal).toBeInTheDocument();
  });

  it('OnClick of manage tab, manage tab content should render', async () => {
    const { container } = render(<TeamsPage />);
    const manage = await findByTestId(container, 'manage');

    expect(manage).toBeInTheDocument();

    fireEvent.click(
      manage,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(await findByText(container, /ManageTab/i)).toBeInTheDocument();
  });
});

describe('Test Teams page sad path', () => {
  it('Should render error placeholder if getTeamByName api fails', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message:
              jsonData['api-error-messages']['unexpected-server-response'],
          },
        },
      })
    );
    const { container } = render(<TeamsPage />);

    const errorPlaceHolder = await findByTestId(container, 'error');

    expect(errorPlaceHolder).toBeInTheDocument();
  });

  it('Should render error placeholder if getTeams api fails', async () => {
    (getTeams as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: jsonData['api-error-messages']['fetch-teams-error'],
          },
        },
      })
    );
    const { container } = render(<TeamsPage />);

    const errorPlaceHolder = await findByTestId(container, 'error');

    expect(errorPlaceHolder).toBeInTheDocument();
  });

  it('Should render component if createTeam api fails', async () => {
    (createTeam as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: jsonData['api-error-messages']['fetch-teams-error'],
          },
        },
      })
    );
    const { container } = render(<TeamsPage />);

    const teamComponent = await findByTestId(container, 'team-container');

    expect(teamComponent).toBeInTheDocument();
  });
});
