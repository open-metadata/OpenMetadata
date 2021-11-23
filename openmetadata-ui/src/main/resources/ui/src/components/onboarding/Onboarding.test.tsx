import { render } from '@testing-library/react';
import React from 'react';
import Onboarding from './Onboarding';

describe('Test Onboarding Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(<Onboarding />);

    const onboarding = getByTestId('onboarding');

    expect(onboarding).toBeInTheDocument();
  });

  it('Logo should render', () => {
    const { getByTestId } = render(<Onboarding />);

    const logo = getByTestId('logo');

    expect(logo).toBeInTheDocument();
  });
});
