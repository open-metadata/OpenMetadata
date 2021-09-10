import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import PageNotFound from './index';

describe('Test PageNotFound Component', () => {
  it('Component should render', () => {
    const { container } = render(<PageNotFound />, {
      wrapper: MemoryRouter,
    });
    const noPage = getByTestId(container, 'no-page-found');

    expect(noPage).toBeInTheDocument();
  });

  it('There should be 2 buttons on the component', () => {
    const { container } = render(<PageNotFound />, {
      wrapper: MemoryRouter,
    });
    const buttons = getByTestId(container, 'route-links');

    expect(buttons.childElementCount).toEqual(2);
  });
});
