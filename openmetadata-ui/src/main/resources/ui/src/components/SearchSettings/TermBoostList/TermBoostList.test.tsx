/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { TermBoost } from '../../../generated/configuration/searchSettings';
import TermBoostList from './TermBoostList';

const mockTermBoosts: TermBoost[] = [
  {
    field: 'tags.tagFQN',
    value: 'PersonalData.Personal',
    boost: 2.0,
  },
  {
    field: 'tags.tagFQN',
    value: 'PII.Sensitive',
    boost: 1.5,
  },
];

const mockHandleDeleteTermBoost = jest.fn();
const mockHandleTermBoostChange = jest.fn();

jest.mock('../TermBoost/TermBoost', () => {
  return jest
    .fn()
    .mockImplementation(
      ({ termBoost, showNewTermBoost, onDeleteBoost, onTermBoostChange }) => (
        <div
          data-testid={
            showNewTermBoost
              ? 'new-term-boost'
              : `term-boost-${termBoost.value}`
          }>
          {termBoost.value || 'New Term Boost'}
          <button
            data-testid={`delete-${termBoost.value || 'new'}`}
            onClick={() => onDeleteBoost(termBoost.value)}>
            Delete
          </button>
          <button
            data-testid={`edit-${termBoost.value || 'new'}`}
            onClick={() =>
              onTermBoostChange({
                ...termBoost,
                boost: termBoost.boost + 1,
              })
            }>
            Edit
          </button>
        </div>
      )
    );
});

describe('TermBoostList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all term boosts', () => {
    render(
      <TermBoostList
        handleDeleteTermBoost={mockHandleDeleteTermBoost}
        handleTermBoostChange={mockHandleTermBoostChange}
        termBoosts={mockTermBoosts}
      />
    );

    expect(
      screen.getByTestId('term-boost-PersonalData.Personal')
    ).toBeInTheDocument();
    expect(screen.getByTestId('term-boost-PII.Sensitive')).toBeInTheDocument();

    expect(screen.queryByTestId('new-term-boost')).not.toBeInTheDocument();
  });

  it('should render new term boost component when showNewTermBoost is true', () => {
    render(
      <TermBoostList
        showNewTermBoost
        handleDeleteTermBoost={mockHandleDeleteTermBoost}
        handleTermBoostChange={mockHandleTermBoostChange}
        termBoosts={mockTermBoosts}
      />
    );

    expect(screen.getByTestId('new-term-boost')).toBeInTheDocument();
  });

  it('should render empty container when no term boosts provided', () => {
    const { container } = render(
      <TermBoostList
        handleDeleteTermBoost={mockHandleDeleteTermBoost}
        handleTermBoostChange={mockHandleTermBoostChange}
        termBoosts={[]}
      />
    );

    expect(screen.queryByTestId(/term-boost-/)).not.toBeInTheDocument();

    expect(
      container.querySelector('.term-boosts-container')
    ).toBeInTheDocument();
  });

  it('should call handleTermBoostChange when edit button is clicked', () => {
    render(
      <TermBoostList
        handleDeleteTermBoost={mockHandleDeleteTermBoost}
        handleTermBoostChange={mockHandleTermBoostChange}
        termBoosts={mockTermBoosts}
      />
    );

    fireEvent.click(screen.getByTestId('edit-PersonalData.Personal'));

    expect(mockHandleTermBoostChange).toHaveBeenCalledTimes(1);
    expect(mockHandleTermBoostChange).toHaveBeenCalledWith({
      ...mockTermBoosts[0],
      boost: mockTermBoosts[0].boost + 1,
    });
  });

  it('should call handleDeleteTermBoost when delete button is clicked', () => {
    render(
      <TermBoostList
        handleDeleteTermBoost={mockHandleDeleteTermBoost}
        handleTermBoostChange={mockHandleTermBoostChange}
        termBoosts={mockTermBoosts}
      />
    );

    fireEvent.click(screen.getByTestId('delete-PersonalData.Personal'));

    expect(mockHandleDeleteTermBoost).toHaveBeenCalledTimes(1);
    expect(mockHandleDeleteTermBoost).toHaveBeenCalledWith(
      mockTermBoosts[0].value
    );
  });

  it('should call handleDeleteTermBoost with empty string when deleting a new term boost', () => {
    render(
      <TermBoostList
        showNewTermBoost
        handleDeleteTermBoost={mockHandleDeleteTermBoost}
        handleTermBoostChange={mockHandleTermBoostChange}
        termBoosts={mockTermBoosts}
      />
    );

    fireEvent.click(screen.getByTestId('delete-new'));

    expect(mockHandleDeleteTermBoost).toHaveBeenCalledTimes(1);
    expect(mockHandleDeleteTermBoost).toHaveBeenCalledWith('');
  });
});
