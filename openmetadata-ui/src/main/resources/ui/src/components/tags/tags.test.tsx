import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import Tags from './tags';

const mockCallback = jest.fn();

describe('Test tags Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <Tags editable removeTag={mockCallback} tag="test" />
    );
    const tags = getByTestId(container, 'tags');
    const remove = getByTestId(container, 'remove');

    expect(tags).toBeInTheDocument();
    expect(remove).toBeInTheDocument();
  });

  it('onClick of X callback function should call', () => {
    const { container } = render(
      <Tags editable removeTag={mockCallback} tag="test" />
    );
    const remove = getByTestId(container, 'remove');
    fireEvent.click(
      remove,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockCallback).toBeCalledTimes(1);
  });
});
