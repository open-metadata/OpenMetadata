import { render } from '@testing-library/react';
import React from 'react';
import ProfileIcon from './ProfileIcon';

describe('Test ProfileIcon Component', () => {
  it('Should render img tag with given src', async () => {
    const { findByTestId } = render(
      <ProfileIcon imgSrc="dummy/src" title="img profile" />
    );
    const icon = await findByTestId(/image-profile/);

    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('alt')).toBe('img profile');
  });

  it('Should render default svg', async () => {
    const { findByTestId } = render(<ProfileIcon title="svg icon" />);
    const icon = await findByTestId(/svg-profile/);

    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('title')).toBe('svg icon');
  });
});
