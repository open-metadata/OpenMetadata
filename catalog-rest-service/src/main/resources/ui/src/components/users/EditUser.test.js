import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { user } from '../../pages/users/index.mock';
import EditUser from './Edituser';

describe('Test Edit user Modal Component', () => {
  it('Renders the proper HTML for add servie form', () => {
    const handleSave = jest.fn();
    const { container } = render(
      <EditUser
        handleSave={handleSave}
        rolesList={[]}
        teamsList={[]}
        user={user}
      />
    );
    const element = getByTestId(container, 'form');

    expect(element).toBeInTheDocument();
  });
});
