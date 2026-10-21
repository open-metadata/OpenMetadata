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
import { render, screen } from '@testing-library/react';
import AccessControlLanding from './AccessControlLanding';

let mockPermissions: Record<string, unknown> = {};
let mockIsAdmin = false;
jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: mockPermissions }) })
);
jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

const CARD_IDS = ['roles', 'policies', 'permission-debugger', 'audit-logs'];

// Each card opens a view the panel gates; a card the user cannot open would
// only lead to no-access.
describe('AccessControlLanding', () => {
  beforeEach(() => {
    mockPermissions = {};
    mockIsAdmin = false;
  });

  it('shows every card to an admin', () => {
    mockIsAdmin = true;
    render(<AccessControlLanding onNavigate={jest.fn()} />);

    CARD_IDS.forEach((id) =>
      expect(
        screen.getByTestId(`access-control-card-${id}`)
      ).toBeInTheDocument()
    );
  });

  it('shows a non-admin only the views their permissions open', () => {
    mockPermissions = { role: { ViewBasic: true } };
    render(<AccessControlLanding onNavigate={jest.fn()} />);

    expect(screen.getByTestId('access-control-card-roles')).toBeInTheDocument();
    ['policies', 'permission-debugger', 'audit-logs'].forEach((id) =>
      expect(
        screen.queryByTestId(`access-control-card-${id}`)
      ).not.toBeInTheDocument()
    );
  });
});
