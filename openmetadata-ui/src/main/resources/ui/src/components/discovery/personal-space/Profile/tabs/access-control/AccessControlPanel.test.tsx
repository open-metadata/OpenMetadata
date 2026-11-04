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
import AccessControlPanel from './AccessControlPanel';

let mockSubPath = '';
let mockIsAdmin = false;

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'access-control', subPath: mockSubPath, params: {} },
    setHash: jest.fn(),
  }),
}));
jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));
jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: {} }) })
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('./AccessControlLanding', () => () => (
  <div data-testid="ac-landing" />
));
jest.mock('./AccessControlRolesPanel', () => () => (
  <div data-testid="ac-roles" />
));

describe('AccessControlPanel', () => {
  beforeEach(() => {
    mockIsAdmin = false;
  });

  it('shows a non-admin who deep-links to roles the no-access placeholder', () => {
    mockSubPath = 'roles';
    render(<AccessControlPanel />);

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('ac-roles')).not.toBeInTheDocument();
  });

  it('opens roles for an admin', () => {
    mockIsAdmin = true;
    mockSubPath = 'roles';
    render(<AccessControlPanel />);

    expect(screen.getByTestId('ac-roles')).toBeInTheDocument();
    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();
  });

  it('keeps the landing open to a non-admin', () => {
    mockSubPath = '';
    render(<AccessControlPanel />);

    expect(screen.getByTestId('ac-landing')).toBeInTheDocument();
  });
});
