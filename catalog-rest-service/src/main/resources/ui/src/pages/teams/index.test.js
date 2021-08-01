import { render } from '@testing-library/react';
import React from 'react';
import TeamsPage from './index';

describe('Test Teams page', () => {
  it('Check for heading', async () => {
    const { findByText } = render(<TeamsPage />);
    const heading = await findByText(/Teams/);

    expect(heading).toBeInTheDocument();
  });
});
