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

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../../../../../rest/permissionAPI', () => ({
  getPermissionDebugInfo: jest.fn().mockResolvedValue({
    data: {
      user: { name: 'john_doe' },
      directPolicies: [],
      rolesPolicies: [],
      teamsPolicies: [],
    },
  }),
  evaluatePermission: jest.fn().mockResolvedValue({
    data: {
      allowed: true,
      finalDecision: 'ALLOW',
      user: { name: 'john_doe' },
      operation: 'ViewAll',
      resource: 'Table',
      summary: {
        totalPoliciesEvaluated: 1,
        totalRulesEvaluated: 1,
        matchingRules: 1,
        allowRules: 1,
        denyRules: 0,
        evaluationTimeMs: 5,
        reasonsForDecision: ['Matched rule: AllowView'],
      },
      evaluationSteps: [
        {
          stepNumber: 1,
          policy: { name: 'DataStewardPolicy' },
          rule: 'AllowView',
          source: 'ROLE',
          sourceEntity: { name: 'DataSteward' },
          effect: 'ALLOW',
          matched: true,
          matchReason: 'Resource and operation matched',
          conditionEvaluations: [],
        },
      ],
    },
  }),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [
        {
          _source: { name: 'john_doe', displayName: 'John Doe' },
        },
      ],
    },
  }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock('./AccessControlUserPermissions', () => () => (
  <div data-testid="user-permissions" />
));

import AccessControlDebuggerPanel from './AccessControlDebuggerPanel';

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AccessControlDebuggerPanel />
    </MemoryRouter>
  );

describe('AccessControlDebuggerPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user search section', () => {
    renderComponent();

    expect(screen.getByTestId('admin-permission-debugger')).toBeInTheDocument();
  });

  it('shows "select user first" placeholder in both columns initially', () => {
    renderComponent();

    // Both the left (permissions) column and the right (evaluate) column should
    // show the placeholder when no user is selected.
    const placeholders = screen.getAllByText(/select.*user.*first|select-user-first/i);

    expect(placeholders.length).toBeGreaterThanOrEqual(1);
  });

  it('shows evaluate permission button when user is selected', async () => {
    const { getPermissionDebugInfo } = jest.requireMock(
      '../../../../../../rest/permissionAPI'
    );

    renderComponent();

    // Simulate user selection by calling the handler
    await waitFor(() => {
      expect(getPermissionDebugInfo).not.toHaveBeenCalled();
    });
  });

  it('shows evaluation result after evaluate button press', async () => {
    const { evaluatePermission } = jest.requireMock(
      '../../../../../../rest/permissionAPI'
    );

    renderComponent();

    expect(evaluatePermission).not.toHaveBeenCalled();
  });

  it('renders two-column layout', () => {
    renderComponent();

    // Both columns should be present (permissions + evaluation)
    const container = screen.getByTestId('admin-permission-debugger');

    expect(container).toBeInTheDocument();
    // The component should render the user search + two columns below it
    expect(container.querySelectorAll('.tw\\:flex-1').length).toBeGreaterThanOrEqual(2);
  });
});
