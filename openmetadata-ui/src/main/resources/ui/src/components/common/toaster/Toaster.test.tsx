import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import Toaster from './Toaster';

const toastList = [{ body: 'test', variant: 'success' }];

describe('Test Toaster Component', () => {
  it('Component should render', () => {
    const { container } = render(<Toaster toastList={toastList} />);

    expect(getByTestId(container, 'toast')).toBeInTheDocument();
  });
});
