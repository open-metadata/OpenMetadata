import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Scorecard from './index';

describe('Test Service page', () => {
  it('Check if there is an element in the page', () => {
    const { container } = render(<Scorecard />, {
      wrapper: MemoryRouter,
    });
    const filterContainer = getByTestId(container, 'filter-container');

    expect(filterContainer).toBeInTheDocument();
  });
});
