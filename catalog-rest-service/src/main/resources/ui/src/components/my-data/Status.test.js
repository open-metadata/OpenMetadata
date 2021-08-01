import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import Status from './Status';

describe('Test Status Component', () => {
  it('Renders "Ready to Use" as the status', async () => {
    const { findByText } = render(<Status text="Ready to Use" />);
    const statusText = await findByText('Ready to Use');

    expect(statusText).toBeInTheDocument();
  });

  it('Check for the status icon rendered', () => {
    const { container } = render(<Status text="Ready to Use" />);
    const dotDiv = getByTestId(container, 'status-icon');

    expect(dotDiv).toBeInTheDocument();
  });

  it('Check for the proper class added to status icon and status text', () => {
    const { container } = render(<Status text="Ready to Use" />);
    const dotDiv = getByTestId(container, 'status-icon');
    const statusText = getByTestId(container, 'status-text');

    expect(statusText).toHaveClass('text-success');
    expect(dotDiv).toHaveClass('text-success');
  });
});
