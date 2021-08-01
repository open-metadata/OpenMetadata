import { render } from '@testing-library/react';
import React from 'react';
import FeedsPage from './index';

describe('Test Feeds page', () => {
  // Rewrite this test as component has actual data from api and api is not mocked here
  it('Check for Today Timeline to be rendered', async () => {
    const { findByText } = render(<FeedsPage />);
    const heading = await findByText(/Announcements/);

    expect(heading).toBeInTheDocument();
  });
});
