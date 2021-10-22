import {
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import ManageTab from './ManageTab.component';

const mockTierData = {
  children: [
    {
      fullyQualifiedName: 'Tier.Tier1',
      description: 'description for card 1',
    },
    {
      fullyQualifiedName: 'Tier.Tier2',
      description: 'description for card 2',
    },
    {
      fullyQualifiedName: 'Tier.Tier3',
      description: 'description for card 3',
    },
  ],
};

const mockFunction = jest.fn().mockImplementation(() => Promise.resolve());

jest.mock('../card-list/CardListItem/CardWithListItems', () => {
  return jest.fn().mockReturnValue(<p data-testid="card">CardWithListItems</p>);
});

jest.mock('../../axiosAPIs/tagAPI', () => ({
  getCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTierData })),
}));

describe('Test Manage tab Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <ManageTab hasEditAccess onSave={mockFunction} />
    );
    const manageTab = await findByTestId(container, 'manage-tab');
    const ownerDropdown = await findByTestId(container, 'owner-dropdown');

    expect(manageTab).toBeInTheDocument();
    expect(ownerDropdown).toBeInTheDocument();
  });

  it('Number of card visible is same as data', async () => {
    const { container } = render(
      <ManageTab hasEditAccess onSave={mockFunction} />
    );
    const card = await findAllByTestId(container, 'card');

    expect(card.length).toBe(3);
  });

  it('there should be 2 buttons', async () => {
    const { container } = render(
      <ManageTab hasEditAccess onSave={mockFunction} />
    );
    const buttons = await findByTestId(container, 'buttons');

    expect(buttons.childElementCount).toBe(2);
  });

  it('Onclick of save, onSave function also called', async () => {
    const { container } = render(
      <ManageTab hasEditAccess onSave={mockFunction} />
    );
    const card = await findAllByTestId(container, 'card');

    fireEvent.click(
      card[1],
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    const save = await findByText(container, /Save/i);

    fireEvent.click(
      save,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toBeCalledTimes(1);
  });
});
