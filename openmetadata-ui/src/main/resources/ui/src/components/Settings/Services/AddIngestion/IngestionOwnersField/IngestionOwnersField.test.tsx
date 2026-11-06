/*
 *  Copyright 2026 Collate.
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
import IngestionOwnersField from './IngestionOwnersField';

const mockOnChange = jest.fn();

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
  canEdit: true,
  owners: mockOwners,
  onChange: mockOnChange,
};

describe('IngestionOwnersField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the owners field and its selector', () => {
    render(<IngestionOwnersField {...mockProps} />);

    expect(screen.getByTestId('ingestion-owners-field')).toBeInTheDocument();
    expect(screen.getByTestId('mock-owner-selector')).toBeInTheDocument();
  });

  // `hasPermission` does not gate a consumer-supplied trigger, so the selector
  // itself has to be withheld — otherwise the picker opens and the save 403s.
  it('should withhold the owner selector without the edit-owners permission', () => {
    render(<IngestionOwnersField {...mockProps} canEdit={false} />);

    expect(screen.getByTestId('ingestion-owners-field')).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-owners')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-owner-selector')).not.toBeInTheDocument();
  });

  it('should propagate an owner selection', () => {
    render(<IngestionOwnersField {...mockProps} />);

    fireEvent.click(screen.getByTestId('mock-owner-selector'));

    expect(mockOnChange).toHaveBeenCalledWith([
      { id: 'new-owner', type: 'team' },
    ]);
  });

  it('should allow selecting both multiple users and multiple teams', () => {
    render(<IngestionOwnersField {...mockProps} />);

    expect(
      screen.getByTestId('mock-owner-selector').getAttribute('data-multiple')
    ).toBe(JSON.stringify({ user: true, team: true }));
  });

  it('should show the error only when owners are required and invalid', () => {
    const { rerender } = render(<IngestionOwnersField {...mockProps} />);

    expect(screen.queryByTestId('owners-error')).not.toBeInTheDocument();

    rerender(<IngestionOwnersField {...mockProps} isInvalid />);

    expect(screen.queryByTestId('owners-error')).not.toBeInTheDocument();

    rerender(<IngestionOwnersField {...mockProps} isInvalid isRequired />);

    expect(screen.getByTestId('owners-error')).toBeInTheDocument();
  });

  it('should link the error to the owners group for assistive tech', () => {
    const { rerender } = render(<IngestionOwnersField {...mockProps} />);

    expect(screen.getByTestId('ingestion-owners-field')).not.toHaveAttribute(
      'aria-describedby'
    );

    rerender(<IngestionOwnersField {...mockProps} isInvalid isRequired />);

    const describedBy = screen
      .getByTestId('ingestion-owners-field')
      .getAttribute('aria-describedby');

    expect(describedBy).toBe(screen.getByTestId('owners-error').id);
    expect(describedBy).toBeTruthy();
  });
});
