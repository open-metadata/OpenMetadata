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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { searchRoles } from '../../../../../../rest/rolesAPIV1';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import SsoRolesAutocomplete from './SsoRolesAutocomplete';

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const ROLES = [
  { id: '1', name: 'DataConsumer', displayName: 'Data Consumer' },
  { id: '2', name: 'DataSteward', displayName: 'Data Steward' },
];

const renderPicker = (value: string[] = []) => {
  const onChange = jest.fn();
  render(
    <SsoRolesAutocomplete
      label="Roles"
      testId="roles"
      value={value}
      onChange={onChange}
    />
  );

  return onChange;
};

describe('SsoRolesAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchRoles as jest.Mock).mockResolvedValue(ROLES);
  });

  it('shows saved role names with their display names once roles load', async () => {
    renderPicker(['DataSteward']);

    expect(await screen.findByText('Data Steward')).toBeInTheDocument();
    expect(searchRoles).toHaveBeenCalledWith('');
  });

  it('adds a picked role by name', async () => {
    const onChange = renderPicker(['DataSteward']);
    await waitFor(() => expect(searchRoles).toHaveBeenCalled());

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.click(
      await screen.findByRole('option', { name: 'Data Consumer' })
    );

    expect(onChange).toHaveBeenCalledWith(['DataSteward', 'DataConsumer']);
  });

  it('removes a role', async () => {
    const onChange = renderPicker(['DataSteward', 'DataConsumer']);
    await screen.findByText('Data Steward');

    const stewardChip = screen
      .getByText('Data Steward')
      .closest('[data-testid="autocomplete-selected-item"]') as HTMLElement;
    fireEvent.click(within(stewardChip).getByRole('button'));

    expect(onChange).toHaveBeenCalledWith(['DataConsumer']);
  });

  it('searches roles on the server as the admin types', async () => {
    jest.useFakeTimers();
    renderPicker();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Steward' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(searchRoles).toHaveBeenLastCalledWith('Steward');

    jest.useRealTimers();
  });

  it('reports a failed role search', async () => {
    (searchRoles as jest.Mock).mockRejectedValue(new Error('boom'));
    renderPicker();

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});
