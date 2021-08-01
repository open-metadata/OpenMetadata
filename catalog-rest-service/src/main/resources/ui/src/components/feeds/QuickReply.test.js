import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import QuickReply from './QuickReply';

describe('Test QuickReply component', () => {
  it('Should render quickReply with given text', async () => {
    const handleClick = jest.fn();
    const { findByText } = render(
      <QuickReply text="Test" onClick={handleClick} />
    );
    const button = await findByText(/Test/);

    expect(button).toBeInTheDocument();
  });

  it('Click should call onClick handler', async () => {
    const handleClick = jest.fn();

    const { findByText } = render(
      <QuickReply text="Test" onClick={handleClick} />
    );
    const button = await findByText(/Test/);

    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalled();
  });
});
