import { render } from '@testing-library/react';
import React from 'react';
import ActivityFeedSettingsPage from './ActivityFeedSettingsPage';

jest.mock('../../axiosAPIs/eventFiltersAPI', () => ({
  getActivityFeedEventFilters: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  resetAllFilters: jest.fn().mockImplementation(() => Promise.resolve()),
  updateFilters: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('Test ActivityFeedSettingsPage', () => {
  it('should render properly', async () => {
    const { findByText } = render(<ActivityFeedSettingsPage />);

    expect(
      await findByText(/No activity feed settings available/)
    ).toBeInTheDocument();
  });
});
