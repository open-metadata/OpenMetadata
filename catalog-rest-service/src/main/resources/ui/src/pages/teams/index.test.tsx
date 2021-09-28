/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import TeamsPage from './index';

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
    displayName: 'Cloud Infra',
    href: 'href1',
    id: 'id1',
    name: 'Cloud_Infra',
  },
  {
    description: '',
    displayName: 'Cloud Infra',
    href: 'href1',
    id: 'id1',
    name: 'Cloud_Infra',
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
    .mockImplementation(() => Promise.resolve({ data: mockTeamsData })),
  patchTeamDetail: jest.fn(),
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
  '../../components/containers/PageContainer',
  () =>
    ({
      children,
      leftPanelContent,
    }: {
      children: ReactNode;
      leftPanelContent: ReactNode;
    }) =>
      (
        <div data-testid="PageContainer">
          <div data-testid="left-panel-content">{leftPanelContent}</div>
          {children}
        </div>
      )
);

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

  it('Should have 2 tabs in the page', async () => {
    const { container } = render(<TeamsPage />);

    const tabs = await findByTestId(container, 'tabs');
    const user = await findByTestId(container, 'users');
    const asstes = await findByTestId(container, 'assets');

    expect(tabs.childElementCount).toBe(2);
    expect(user).toBeInTheDocument();
    expect(asstes).toBeInTheDocument();
  });

  it('Description should be in document', async () => {
    const { container } = render(<TeamsPage />);

    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );

    const description = await findByTestId(container, 'description');
    const addDescription = await findByTestId(container, 'add-description');

    expect(descriptionContainer).toBeInTheDocument();
    expect(addDescription).toBeInTheDocument();
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
});
