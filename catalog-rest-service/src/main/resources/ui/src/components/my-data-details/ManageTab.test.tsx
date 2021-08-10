import {
  fireEvent,
  getByTestId,
  getByText,
  render,
} from '@testing-library/react';
import React from 'react';
import ManageTab from './ManageTab';

const mockFunction = jest.fn();
jest.mock('../../jsons/tiersData.ts', () => ({
  data: [
    {
      title: 'Tier 1',
      id: 'Tier.Tier1',
      description:
        'Critical Source of Truth business data assets of an organization',
      contents: [
        {
          text: 'Used in critical metrics and dashboards to drive business and product decisions',
        },
      ],
    },
    {
      title: 'Tier 1',
      id: 'Tier.Tier1',
      description:
        'Critical Source of Truth business data assets of an organization',
      contents: [
        {
          text: 'Used in critical metrics and dashboards to drive business and product decisions',
        },
      ],
    },
  ],
}));

describe('Test Manage tab Component', () => {
  it('Component should render', () => {
    const { container } = render(<ManageTab onSave={mockFunction} />);
    const manageTab = getByTestId(container, 'manage-tab');
    const ownerDropdown = getByTestId(container, 'owner-dropdown');

    expect(manageTab).toBeInTheDocument();
    expect(ownerDropdown).toBeInTheDocument();
  });

  it('Number of card visible is same as data', () => {
    const { container } = render(<ManageTab onSave={mockFunction} />);
    const cards = getByTestId(container, 'cards');

    expect(cards.childElementCount).toBe(2);
  });

  it('there should be 2 buttons', () => {
    const { container } = render(<ManageTab onSave={mockFunction} />);
    const buttons = getByTestId(container, 'buttons');

    expect(buttons.childElementCount).toBe(2);
  });

  it('Onclick of save, onSave function also called', () => {
    const { container } = render(<ManageTab onSave={mockFunction} />);
    const save = getByText(container, /Save/i);
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
