/*
 *  Copyright 2024 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TeamType } from '../../../generated/entity/teams/team';
import TeamTypeSelect from './TeamTypeSelect.component';

const handleShowTypeSelector = jest.fn();
const updateTeamType = jest.fn();

const mockProps = {
  showGroupOption: true,
  handleShowTypeSelector: handleShowTypeSelector,
  parentTeamType: TeamType.Organization,
  teamType: TeamType.Department,
  updateTeamType: updateTeamType,
};

jest.mock('../../../utils/TeamUtils', () => ({
  getTeamOptionsFromType: jest
    .fn()
    .mockReturnValue(['BusinessUnit', 'Division', 'Department', 'Group']),
}));

describe('TeamTypeSelect', () => {
  it('should render TeamTypeSelect', () => {
    const { getByTestId } = render(<TeamTypeSelect {...mockProps} />);

    expect(getByTestId('team-type-select')).toBeInTheDocument();
  });

  it('should call handleCancel when cancel button is clicked', () => {
    const { getByTestId } = render(<TeamTypeSelect {...mockProps} />);
    fireEvent.click(getByTestId('cancel-btn'));

    expect(handleShowTypeSelector).toHaveBeenCalledWith(false);
    expect(updateTeamType).not.toHaveBeenCalled();
  });

  it('should call handleSubmit when save button is clicked', () => {
    const { getByTestId } = render(<TeamTypeSelect {...mockProps} />);
    fireEvent.click(getByTestId('save-btn'));

    expect(updateTeamType).toHaveBeenCalled();
  });

  it('should save the team type picked from the list', async () => {
    render(<TeamTypeSelect {...mockProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /team-type/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'Division' }));
    });
    fireEvent.click(screen.getByTestId('save-btn'));

    expect(updateTeamType).toHaveBeenCalledWith(TeamType.Division);
  });

  it('should not offer Group when the group option is hidden', async () => {
    render(<TeamTypeSelect {...mockProps} showGroupOption={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /team-type/ }));
    });

    expect(screen.queryByRole('option', { name: 'Group' })).toBeNull();
    expect(
      screen.getByRole('option', { name: 'Division' })
    ).toBeInTheDocument();
  });
});
