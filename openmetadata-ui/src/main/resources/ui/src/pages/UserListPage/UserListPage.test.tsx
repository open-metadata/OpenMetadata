import {
  act,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { deleteUser } from '../../axiosAPIs/userAPI';
import UserListPage from './UserListPage';

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/UserList/UserList', () => {
  return jest
    .fn()
    .mockImplementation(({ deleteUser }) => (
      <div onClick={deleteUser}>UserListComponent</div>
    ));
});

jest.mock('../../axiosAPIs/teamsAPI', () => ({
  getTeams: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../axiosAPIs/userAPI', () => ({
  deleteUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const mockDeleteUser = jest.fn(() => Promise.resolve({}));

describe('Test UserListPage component', () => {
  it('UserListPage component should render properly', async () => {
    const { container } = render(<UserListPage />, {
      wrapper: MemoryRouter,
    });

    const PageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const UserListComponent = await findByText(container, 'UserListComponent');

    expect(PageContainerV1).toBeInTheDocument();
    expect(UserListComponent).toBeInTheDocument();
  });

  it('should delete users', async () => {
    (deleteUser as jest.Mock).mockImplementationOnce(mockDeleteUser);

    const { container } = render(<UserListPage />, {
      wrapper: MemoryRouter,
    });

    await act(async () => {
      fireEvent.click(await findByText(container, 'UserListComponent'));
    });

    expect(mockDeleteUser).toBeCalled();
  });
});
