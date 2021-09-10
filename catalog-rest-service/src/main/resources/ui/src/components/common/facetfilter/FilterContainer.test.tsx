import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import FilterContainer from './FilterContainer';

const mockSelect = jest.fn();

describe('Test FilterContainer Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <FilterContainer
        count={5}
        isSelected={false}
        name="test"
        type="service type"
        onSelect={mockSelect}
      />
    );

    expect(getByTestId(container, 'filter-container')).toBeInTheDocument();
  });

  it('onClick of checkbox callback function should call', () => {
    const { container } = render(
      <FilterContainer
        count={5}
        isSelected={false}
        name="test"
        type="service type"
        onSelect={mockSelect}
      />
    );

    const checkbox = getByTestId(container, 'checkbox');
    fireEvent.click(
      checkbox,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockSelect).toBeCalledTimes(1);
  });
});
