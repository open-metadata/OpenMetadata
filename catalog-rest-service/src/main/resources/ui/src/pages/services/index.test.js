import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ServicesPage from './index';

describe('Test Service page', () => {
  it('Check if there is an element in the page', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const pageContainer = await findByTestId(container, 'add-service');

    expect(pageContainer).toBeInTheDocument();
  });
});
