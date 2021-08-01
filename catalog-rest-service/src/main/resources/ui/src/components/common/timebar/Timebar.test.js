import { render } from '@testing-library/react';
import React from 'react';
import Timebar from './Timebar';

describe('Test Timebar Component', () => {
  it('Should render Timebar Pill', async () => {
    const { findByText } = render(<Timebar title="Today" />);
    const pill = await findByText(/Today/);

    expect(pill).toBeInTheDocument();
  });
});
