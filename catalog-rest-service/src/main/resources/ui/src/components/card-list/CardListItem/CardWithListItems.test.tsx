import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import CardListItem from './CardWithListItems';

const mockFunction = jest.fn();
const mockCard = {
  id: 'test1',
  title: 'card',
  description: 'description',
  contents: [{ text: 'string1' }],
};

describe('Test CardWithListing Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <CardListItem card={mockCard} isActive={false} onSelect={mockFunction} />
    );

    const card = getByTestId('card-list');

    expect(card).toBeInTheDocument();

    expect(getByTestId('icon')).toBeEmptyDOMElement();
  });

  it('OnClick callback function should call', () => {
    const { getByTestId } = render(
      <CardListItem card={mockCard} isActive={false} onSelect={mockFunction} />
    );

    const card = getByTestId('card-list');
    fireEvent(
      card,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
