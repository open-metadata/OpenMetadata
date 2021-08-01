import { render } from '@testing-library/react';
import React from 'react';
import mockData from '../../pages/users/index.mock';
import UserList from './UserList';

describe('Test User Listing Component', () => {
  it('Renders the proper HTML for user list details', async () => {
    const { findByTestId, findAllByTestId } = render(
      <UserList handleClick={jest.fn()} userList={mockData} />
    );
    const tableList = await findByTestId('user-list');
    const userList = await findAllByTestId('user');

    expect(tableList).toBeInTheDocument();
    expect(userList.length).toBe(3);
  });
});
