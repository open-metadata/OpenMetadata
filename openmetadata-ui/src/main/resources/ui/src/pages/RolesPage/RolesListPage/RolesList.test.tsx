/*
 *  Copyright 2022 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { ROLES_LIST } from '../Roles.mock';
import RolesList from './RolesList';

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, to, ...res }) => (
    <a href={to} {...res}>
      {children}
    </a>
  )),
}));

jest.mock('components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="delete-modal">DeletWdigetModal</div>)
);

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('data'),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  LIST_CAP: 1,
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getPolicyWithFqnPath: jest.fn(),
  getRoleWithFqnPath: jest.fn(),
}));

const mockFetchRoles = jest.fn();

const mockProps = {
  roles: ROLES_LIST,
  fetchRoles: mockFetchRoles,
};

describe('Test Roles List Component', () => {
  it('Should render the list component', async () => {
    render(<RolesList {...mockProps} />);

    const container = await screen.findByTestId('roles-list-table');

    expect(container).toBeInTheDocument();
  });

  it('Should render all table columns', async () => {
    render(<RolesList {...mockProps} />);

    const container = await screen.findByTestId('roles-list-table');

    const nameCol = await screen.findByText('Name');
    const descriptionCol = await screen.findByText('Description');
    const policiesCol = await screen.findByText('Policies');
    const actionsCol = await screen.findByText('Actions');

    expect(container).toBeInTheDocument();
    expect(nameCol).toBeInTheDocument();
    expect(descriptionCol).toBeInTheDocument();
    expect(policiesCol).toBeInTheDocument();
    expect(actionsCol).toBeInTheDocument();
  });

  it('Should render all table rows', async () => {
    render(<RolesList {...mockProps} />);

    const container = await screen.findByTestId('roles-list-table');

    const nameRows = await screen.findAllByTestId('role-name');
    const descriptionRows = await screen.findAllByTestId('previewer');
    const policiesRows = await screen.findAllByTestId('policy-link');
    const actionsRows = await screen.findAllByTestId('delete-action-data');

    expect(container).toBeInTheDocument();
    expect(nameRows).toHaveLength(3);
    expect(descriptionRows).toHaveLength(3);
    expect(policiesRows).toHaveLength(3);
    expect(actionsRows).toHaveLength(3);
  });
});
