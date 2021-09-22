import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import ErrorPlaceHolder from './ErrorPlaceHolder';

describe('Test Error place holder Component', () => {
  it('Component should render', () => {
    const { container } = render(<ErrorPlaceHolder />);

    expect(getByTestId(container, 'error')).toBeInTheDocument();
    expect(getByTestId(container, 'no-data-found')).toBeInTheDocument();
  });
});
