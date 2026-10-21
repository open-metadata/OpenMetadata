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
import { MemoryRouter } from 'react-router-dom';

let mockPermissions: Record<string, unknown> = {};
jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: mockPermissions }) })
);

let mockIsAdmin = false;
jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock(
  '../../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => () => <div data-testid="permission-error-placeholder" />
);

jest.mock('./AccessControlLanding', () => () => <div data-testid="landing" />);
jest.mock('./AccessControlRolesPanel', () => () => <div data-testid="roles" />);
jest.mock('./AccessControlPoliciesPanel', () => () => (
  <div data-testid="policies" />
));
jest.mock('./AccessControlAddRoleForm', () => () => (
  <div data-testid="add-role" />
));
jest.mock('./AccessControlAddPolicyForm', () => () => (
  <div data-testid="add-policy" />
));
jest.mock('./AccessControlRoleDetail', () => () => (
  <div data-testid="role-detail" />
));
jest.mock('./AccessControlPolicyDetail', () => () => (
  <div data-testid="policy-detail" />
));
jest.mock('./AccessControlRuleFormPage', () => () => (
  <div data-testid="rule-form" />
));
jest.mock('./AccessControlDebuggerPanel', () => () => (
  <div data-testid="debugger" />
));
jest.mock('./AccessControlAuditLogsPanel', () => () => (
  <div data-testid="audit-logs" />
));

import AccessControlPanel from './AccessControlPanel';

const renderAt = (hash: string) => {
  globalThis.location.hash = hash;

  return render(
    <MemoryRouter>
      <AccessControlPanel />
    </MemoryRouter>
  );
};

// A non-admin reaches each view under the gate classic `SettingsRouter` put on
// the matching page.
describe('AccessControlPanel permission gates', () => {
  beforeEach(() => {
    mockIsAdmin = false;
    mockPermissions = { role: { ViewBasic: true } };
  });

  it('shows a role to a non-admin with role view permission', () => {
    renderAt('#access-control/roles/DataSteward');

    expect(screen.getByTestId('role-detail')).toBeInTheDocument();
  });

  it('shows no-access for policies without policy view permission', () => {
    renderAt('#access-control/policies/OrgPolicy');

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('policy-detail')).not.toBeInTheDocument();
  });

  it('keeps the permission debugger admin-only', () => {
    renderAt('#access-control/permission-debugger');

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
  });

  it('opens every view for an admin', () => {
    mockIsAdmin = true;
    mockPermissions = {};
    renderAt('#access-control/permission-debugger');

    expect(screen.getByTestId('debugger')).toBeInTheDocument();
  });

  it('gates audit logs on the AuditLogs operation', () => {
    renderAt('#access-control/audit-logs');

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('audit-logs')).not.toBeInTheDocument();
  });

  it('shows audit logs to a non-admin allowed the AuditLogs operation', () => {
    mockPermissions = { auditLog: { AuditLogs: true } };
    renderAt('#access-control/audit-logs');

    expect(screen.getByTestId('audit-logs')).toBeInTheDocument();
  });
});
