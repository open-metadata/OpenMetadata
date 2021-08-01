import { render } from '@testing-library/react';
import React from 'react';
import SettingsPage from './index';

describe('Test Settings page', () => {
  it('Check for heading', async () => {
    const { findByText } = render(<SettingsPage />);
    const heading = await findByText(/Settings/);

    expect(heading).toBeInTheDocument();
  });
});
