import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from './index';

describe('Test UsersPage page', () => {
  it('Checks if the page has all the proper components rendered', () => {
    const { container } = render(<UsersPage />, {
      wrapper: MemoryRouter,
    });
    const header = getByTestId(container, 'header');
    const paginate = getByTestId(container, 'pagination');

    expect(header).toBeInTheDocument();
    expect(paginate).toBeInTheDocument();
  });
});
