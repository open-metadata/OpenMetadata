import { render } from '@testing-library/react';
import React from 'react';
import ProfileDropdown from './ProfileDropdown';

describe('Test ProfileDropdown Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(<ProfileDropdown name="Test user" />);
    const dropdown = getByTestId('dropdown-profile');

    expect(dropdown).toBeInTheDocument();
  });
});
