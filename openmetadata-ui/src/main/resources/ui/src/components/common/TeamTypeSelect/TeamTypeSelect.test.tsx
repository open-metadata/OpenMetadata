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
import { fireEvent, render } from '@testing-library/react';
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
  getTeamOptionsFromType: jest.fn().mockReturnValue([
    { label: 'BusinessUnit', value: 'BusinessUnit' },
    { label: 'Division', value: 'Division' },
    { label: 'Department', value: 'Department' },
    { label: 'Group', value: 'Group' },
  ]),
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
});
