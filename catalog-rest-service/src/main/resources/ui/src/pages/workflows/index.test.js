import { render } from '@testing-library/react';
import React from 'react';
import WorkflowsPage from './index';

describe('Test Workflows page', () => {
  it('Check for heading', async () => {
    const { findByText } = render(<WorkflowsPage />);
    const heading = await findByText(/Workflows/);

    expect(heading).toBeInTheDocument();
  });
});
