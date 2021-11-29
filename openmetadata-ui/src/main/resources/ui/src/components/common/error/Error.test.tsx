import { getByTestId, queryByText, render } from '@testing-library/react';
import React from 'react';
import Error from './Error';

describe('Test Error Component', () => {
  it('Component should render', () => {
    const { container } = render(<Error error="test" />);

    expect(getByTestId(container, 'error')).toBeInTheDocument();
    expect(queryByText(container, /test/i)).toBeInTheDocument();
  });
});
