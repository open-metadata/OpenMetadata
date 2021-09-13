import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { Button } from './Button';

const mockFunction = jest.fn();

describe('Test Button Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <Button
        data-testid="button"
        size="regular"
        theme="primary"
        variant="outlined"
        onClick={mockFunction}>
        test button
      </Button>
    );

    const button = getByTestId('button');

    expect(button).toBeInTheDocument();
  });

  it('OnClick callback function should call', () => {
    const { getByTestId } = render(
      <Button
        data-testid="button"
        size="regular"
        theme="primary"
        variant="outlined"
        onClick={mockFunction}>
        test button
      </Button>
    );

    const button = getByTestId('button');
    fireEvent(
      button,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
