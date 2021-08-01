import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Appbar from './Appbar';

describe('Test Appbar Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    // Check for statis user for now
    // TODO: Fix the tests when we have actual data
    const dropdown = getByTestId('dropdown-profile');

    expect(dropdown).toBeInTheDocument();
  });

  it('Check for render Items by default', () => {
    const { getAllByTestId } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    const items = getAllByTestId('appbar-item');

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.textContent)).toEqual([
      '',
      'Explore',
      'Scorecard',
    ]);
  });

  it('Check for render dropdown item', () => {
    const { getAllByTestId } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    const items = getAllByTestId('dropdown-item');

    expect(items).toHaveLength(3);
  });
});
