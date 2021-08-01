import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import MyDataPage from './index';

describe('Test MyData page', () => {
  it('Check if there is an element in the page', () => {
    const { container } = render(<MyDataPage />, {
      wrapper: MemoryRouter,
    });
    const pageContainer = getByTestId(container, 'container');

    expect(pageContainer).toBeInTheDocument();
  });
});
