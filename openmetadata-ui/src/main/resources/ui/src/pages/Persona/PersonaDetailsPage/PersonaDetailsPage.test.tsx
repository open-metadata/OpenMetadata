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
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getPersonaByName, updatePersona } from '../../../rest/PersonaAPI';
import { PersonaDetailsPage } from './PersonaDetailsPage';

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>DescriptionV1.component</div>);
});
jest.mock(
  '../../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => {
    return jest
      .fn()
      .mockImplementation(({ afterDeleteAction, onEditDisplayName }) => (
        <div>
          ManageButton.component
          <button data-testid="delete-btn" onClick={afterDeleteAction}>
            Delete
          </button>
          <button
            data-testid="display-name-btn"
            onClick={() => onEditDisplayName({ displayName: 'Updated Name' })}>
            Update Display Name
          </button>
        </div>
      ));
  }
);
jest.mock(
  '../../../components/common/UserSelectableList/UserSelectableList.component',
  () => {
    return {
      UserSelectableList: jest
        .fn()
        .mockImplementation(({ children, onUpdate }) => (
          <div
            data-testid="user-selectable-list"
            onClick={() => onUpdate({ id: 'ID', type: 'user' })}>
            {children}
          </div>
        )),
    };
  }
);
const mockPersona = {
  id: '3cd223f3-fe1f-4ed8-9d74-dc80f5f91838',
  name: 'testPersona',
  fullyQualifiedName: 'testPersona',
  displayName: 'Test Persona',
  users: [
    {
      id: '1496d0c6-ebb2-453c-a8cc-b275c553f61f',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
    },
  ],
};
jest.mock('../../../rest/PersonaAPI', () => {
  return {
    getPersonaByName: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockPersona)),
    updatePersona: jest.fn().mockImplementation(() => Promise.resolve()),
  };
});
jest.mock('../../../hooks/useFqn', () => {
  return { useFqn: jest.fn().mockReturnValue({ fqn: 'fqn' }) };
});
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  return {
    useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  };
});
jest.mock(
  '../../../components/common/ErrorWithPlaceholder/NoDataPlaceholder',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>NoDataPlaceholder.component</div>);
  }
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <p>TitleBreadcrumb.component</p>)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

jest.mock(
  '../../../components/Settings/Users/UsersTab/UsersTabs.component',
  () => ({
    UsersTab: jest
      .fn()
      .mockImplementation(() => <div>UsersTabs.component</div>),
  })
);

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Persona'),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock(
  '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => jest.fn().mockImplementation(() => <div>EntityHeaderTitle</div>)
);

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '', hash: '' }));
});

describe('PersonaDetailsPage', () => {
  it('Component should render', async () => {
    render(<PersonaDetailsPage />), { wrapper: MemoryRouter };

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(screen.getByText('EntityHeaderTitle')).toBeInTheDocument();
    expect(screen.getByText('TitleBreadcrumb.component')).toBeInTheDocument();
    expect(
      await screen.findByText('ManageButton.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('DescriptionV1.component')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-persona-button')).toBeInTheDocument();
  });

  it('NoDataPlaceholder', async () => {
    (getPersonaByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    render(<PersonaDetailsPage />, { wrapper: MemoryRouter });

    expect(
      await screen.findByText('NoDataPlaceholder.component')
    ).toBeInTheDocument();
  });

  it('handleAfterDeleteAction should call after delete', async () => {
    render(<PersonaDetailsPage />, { wrapper: MemoryRouter });

    const deleteBtn = await screen.findByTestId('delete-btn');

    fireEvent.click(deleteBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/settings/persona');
  });

  it('handleDisplayNameUpdate should call after updating displayName', async () => {
    const mockUpdatePersona = updatePersona as jest.Mock;
    render(<PersonaDetailsPage />, { wrapper: MemoryRouter });

    const updateName = await screen.findByTestId('display-name-btn');

    fireEvent.click(updateName);

    expect(mockUpdatePersona).toHaveBeenCalledWith(mockPersona.id, [
      { op: 'replace', path: '/displayName', value: 'Updated Name' },
    ]);
  });

  it('add user should work', async () => {
    const mockUpdatePersona = updatePersona as jest.Mock;
    render(<PersonaDetailsPage />, { wrapper: MemoryRouter });

    const addUser = await screen.findByTestId('user-selectable-list');

    fireEvent.click(addUser);

    expect(mockUpdatePersona).toHaveBeenCalledWith(mockPersona.id, [
      {
        op: 'replace',
        path: '/users',
        value: {
          id: 'ID',
          type: 'user',
        },
      },
    ]);
  });
});
