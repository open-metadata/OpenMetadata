import { render } from '@testing-library/react';
import React from 'react';
import Loader from './Loader';

describe('Test Loader Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(<Loader />);

    const loader = getByTestId('loader');

    expect(loader).toBeInTheDocument();
  });
});
