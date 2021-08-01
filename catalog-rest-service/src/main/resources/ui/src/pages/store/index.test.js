import { render } from '@testing-library/react';
import React from 'react';
import StorePage from '.';

describe('Test Store page', () => {
  it('Check for heading', async () => {
    const { findByText } = render(<StorePage />);
    const heading = await findByText(/Store/);

    expect(heading).toBeInTheDocument();
  });
});
