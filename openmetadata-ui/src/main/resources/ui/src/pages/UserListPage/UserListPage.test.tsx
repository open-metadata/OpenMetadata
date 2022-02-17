import { findByTestId, findByText, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import UserListPage from './UserListPage';

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/UserList/UserList', () => {
  return jest.fn().mockImplementation(() => <div>UserListComponent</div>);
});

jest.mock('../../axiosAPIs/teamsAPI', () => ({
  getTeams: jest.fn().mockImplementation(() => Promise.resolve()),
}));

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
});
