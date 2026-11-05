/*
 *  Copyright 2022 Collate.
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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TeamType } from '../../../../generated/entity/teams/teamHierarchy';
import { getTeamsHierarchy } from '../../../../rest/teamsAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TeamsSelectable from './TeamsSelectable';

jest.mock('../../../../rest/teamsAPI', () => ({
  getTeamsHierarchy: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: () => 'entityName',
}));

describe('TeamsSelectable', () => {
  beforeEach(() => {
    (getTeamsHierarchy as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('renders a searchable team picker', async () => {
    render(<TeamsSelectable />, { wrapper: MemoryRouter });

    expect(screen.getByRole('combobox')).toBeInTheDocument();

    await waitFor(() => expect(getTeamsHierarchy).toHaveBeenCalled());
  });

  it('returns team references when selecting and clearing a group', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onSelectionChange = jest.fn();
    (getTeamsHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'team-id',
          name: 'Team',
          teamType: TeamType.Group,
          isJoinable: true,
        },
      ],
    });
    render(<TeamsSelectable onSelectionChange={onSelectionChange} />, {
      wrapper: MemoryRouter,
    });
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('entityName'));

    expect(onSelectionChange).toHaveBeenLastCalledWith([
      { id: 'team-id', displayName: 'entityName', type: 'team' },
    ]);

    await user.click(
      screen.getByRole('button', { name: /remove.*entityName/i })
    );

    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('toasts a failed load once and retries when the picker opens', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const error = new Error('network');
    (getTeamsHierarchy as jest.Mock)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'team-id',
            name: 'Team',
            teamType: TeamType.Group,
            isJoinable: true,
          },
        ],
      });
    render(<TeamsSelectable />, { wrapper: MemoryRouter });

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('entityName')).toBeInTheDocument();
    expect(getTeamsHierarchy).toHaveBeenCalledTimes(2);
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('shows an empty-team message after an empty response', async () => {
    render(<TeamsSelectable showTeamsAlert />, { wrapper: MemoryRouter });

    expect(
      await screen.findByText('message.no-entity-data-available')
    ).toBeInTheDocument();
  });

  it('keeps the empty-team message hidden when data exists', async () => {
    (getTeamsHierarchy as jest.Mock).mockResolvedValue({
      data: [{ id: 'team-id', name: 'Team', teamType: TeamType.Group }],
    });
    render(<TeamsSelectable showTeamsAlert />, { wrapper: MemoryRouter });
    await waitFor(() => expect(getTeamsHierarchy).toHaveBeenCalled());

    expect(
      screen.queryByText('message.no-entity-data-available')
    ).not.toBeInTheDocument();
  });
});
