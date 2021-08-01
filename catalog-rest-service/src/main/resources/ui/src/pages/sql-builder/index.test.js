import { render } from '@testing-library/react';
import React from 'react';
import SQLBuilderPage from './index';

describe('Test SqlBuilder page', () => {
  it('Check for heading', async () => {
    const { findByText } = render(<SQLBuilderPage />);
    const heading = await findByText(/SQL Builder/);

    expect(heading).toBeInTheDocument();
  });
});
