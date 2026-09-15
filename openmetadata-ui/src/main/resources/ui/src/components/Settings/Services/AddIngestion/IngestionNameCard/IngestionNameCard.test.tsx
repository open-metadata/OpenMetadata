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
import { EntityReference } from '../../../../../generated/entity/type';
import IngestionNameCard from './IngestionNameCard';

const mockOnOwnersChange = jest.fn();

const mockOwners: EntityReference[] = [
  { id: 'owner-id', type: 'user', name: 'owner-name' },
];

jest.mock('../../../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockReturnValue({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  }),
}));

jest.mock(
  '../../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest
      .fn()
      .mockImplementation(({ onUpdate, multiple }) => (
        <button
          data-multiple={JSON.stringify(multiple)}
          data-testid="mock-owner-selector"
          onClick={() => onUpdate([{ id: 'new-owner', type: 'team' }])}>
          select
        </button>
      )),
  })
);

const mockProps = {
  displayName: 'agent name',
  owners: mockOwners,
  onDisplayNameChange: jest.fn(),
  onOwnersChange: mockOnOwnersChange,
};

describe('IngestionNameCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the owners field alongside the name field', () => {
    render(<IngestionNameCard {...mockProps} />);

    expect(screen.getByTestId('ingestion-display-name')).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-owners-field')).toBeInTheDocument();
    expect(screen.getByTestId('mock-owner-selector')).toBeInTheDocument();
  });

  it('should propagate an owner selection', () => {
    render(<IngestionNameCard {...mockProps} />);

    fireEvent.click(screen.getByTestId('mock-owner-selector'));

    expect(mockOnOwnersChange).toHaveBeenCalledWith([
      { id: 'new-owner', type: 'team' },
    ]);
  });

  it('should allow selecting both multiple users and multiple teams', () => {
    render(<IngestionNameCard {...mockProps} />);

    expect(
      screen.getByTestId('mock-owner-selector').getAttribute('data-multiple')
    ).toBe(JSON.stringify({ user: true, team: true }));
  });

  it('should show the error only when owners are required and invalid', () => {
    const { rerender } = render(<IngestionNameCard {...mockProps} />);

    expect(screen.queryByTestId('owners-error')).not.toBeInTheDocument();

    rerender(<IngestionNameCard {...mockProps} isOwnersInvalid />);

    expect(screen.queryByTestId('owners-error')).not.toBeInTheDocument();

    rerender(
      <IngestionNameCard {...mockProps} isOwnersInvalid isOwnersRequired />
    );

    expect(screen.getByTestId('owners-error')).toBeInTheDocument();
  });
});
