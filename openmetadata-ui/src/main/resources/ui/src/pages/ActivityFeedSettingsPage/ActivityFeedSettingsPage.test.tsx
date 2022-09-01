import { render } from '@testing-library/react';
import React from 'react';
import ActivityFeedSettingsPage from './ActivityFeedSettingsPage';

describe('Test ActivityFeedSettingsPage', () => {
  it('should render properly', async () => {
    const { findByText } = render(<ActivityFeedSettingsPage />);

    expect(await findByText(/Activity Feed/)).toBeInTheDocument();
  });
});
