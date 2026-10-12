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

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { getPermissionDebugInfo } from '../../../../rest/permissionAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import AdminPermissionDebugger from './AdminPermissionDebugger.component';

jest.mock('../../../../rest/searchAPI');
jest.mock('../../../../rest/permissionAPI');
jest.mock('../../../../utils/ToastUtils');
jest.mock('../UsersProfile/UserPermissions/UserPermissions.component', () => ({
  __esModule: true,
  default: jest.fn(() => (
    <div data-testid="user-permissions">User Permissions</div>
  )),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <HelmetProvider>
      <MemoryRouter>{component}</MemoryRouter>
    </HelmetProvider>
  );
};

describe('AdminPermissionDebugger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps asynchronously returned users selectable after an empty initial search', async () => {
    let resolveSearch!: (value: unknown) => void;
    (searchQuery as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    (getPermissionDebugInfo as jest.Mock).mockResolvedValue({
      data: undefined,
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithRouter(<AdminPermissionDebugger />);
    await user.type(screen.getByRole('combobox'), 'visual');
    act(() => jest.advanceTimersByTime(300));
    await waitFor(() => expect(searchQuery).toHaveBeenCalled());
    await act(async () =>
      resolveSearch({
        hits: {
          hits: [
            { _source: { name: 'visual_user', displayName: 'Visual User' } },
          ],
        },
      })
    );
    const option = await screen.findByRole('option', {
      name: 'Visual User (visual_user)',
    });
    await user.click(option);
    await waitFor(() =>
      expect(screen.getByText('visual_user')).toBeInTheDocument()
    );

    expect(getPermissionDebugInfo).toHaveBeenCalledWith('visual_user');
  });

  it('should render the component', () => {
    renderWithRouter(<AdminPermissionDebugger />);

    expect(screen.getByText('label.permission-debugger')).toBeInTheDocument();
    expect(
      screen.getByText('label.select-user-to-debug-permissions')
    ).toBeInTheDocument();
  });

  it('should render search input and evaluation form', () => {
    renderWithRouter(<AdminPermissionDebugger />);

    // Check for autocomplete
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Check for cards
    expect(screen.getByText('label.evaluate-permission')).toBeInTheDocument();
    expect(screen.getByText('message.select-user-first')).toBeInTheDocument();
  });

  it('should render permission resources and operations', () => {
    renderWithRouter(<AdminPermissionDebugger />);

    // Check that constants are being used properly
    expect(screen.queryByText('table')).not.toBeInTheDocument(); // Not visible until dropdown is opened
    expect(screen.queryByText('ViewAll')).not.toBeInTheDocument(); // Not visible until dropdown is opened
  });
});
