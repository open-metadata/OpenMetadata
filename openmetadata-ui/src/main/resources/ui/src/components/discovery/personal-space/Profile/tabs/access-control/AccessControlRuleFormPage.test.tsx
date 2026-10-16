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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import { Rule } from '../../../../../../generated/api/policies/createPolicy';
import {
  getPolicyByName,
  patchPolicy,
} from '../../../../../../rest/rolesAPIV1';
import AccessControlRuleFormPage from './AccessControlRuleFormPage';

const POLICY = {
  id: 'policy-1',
  name: 'OrgPolicy',
  displayName: 'Org Policy',
  rules: [
    {
      name: 'ViewRule',
      resources: ['table'],
      operations: ['ViewAll'],
      effect: 'allow',
    },
  ],
};

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getPolicyByName: jest.fn(),
  patchPolicy: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Stands in for the real field set: one button that types a new rule name.
jest.mock('./AccessControlRuleForm', () => ({
  __esModule: true,
  default: ({ form }: { form: UseFormReturn<Rule> }) => (
    <button
      data-testid="type-rule-name"
      type="button"
      onClick={() => form.setValue('name', ' EditRule ')}>
      type
    </button>
  ),
}));

const onNavigate = jest.fn();

describe('AccessControlRuleFormPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPolicyByName as jest.Mock).mockResolvedValue(POLICY);
    (patchPolicy as jest.Mock).mockResolvedValue(POLICY);
  });

  it('appends a new rule and returns to the policy', async () => {
    render(
      <AccessControlRuleFormPage fqn="OrgPolicy" onNavigate={onNavigate} />
    );

    fireEvent.click(await screen.findByTestId('type-rule-name'));
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(patchPolicy).toHaveBeenCalled());

    expect((patchPolicy as jest.Mock).mock.calls[0][0]).toEqual([
      expect.objectContaining({
        op: 'add',
        path: '/rules/1',
        value: expect.objectContaining({ name: 'EditRule' }),
      }),
    ]);
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'policies-detail',
      fqn: 'OrgPolicy',
      name: 'Org Policy',
    });
  });

  it('replaces the edited rule in place', async () => {
    render(
      <AccessControlRuleFormPage
        fqn="OrgPolicy"
        ruleName="ViewRule"
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(await screen.findByTestId('type-rule-name'));
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(patchPolicy).toHaveBeenCalled());

    expect((patchPolicy as jest.Mock).mock.calls[0][0]).toEqual([
      { op: 'replace', path: '/rules/0/name', value: 'EditRule' },
    ]);
  });

  it('goes back to the policy on cancel without saving', async () => {
    render(
      <AccessControlRuleFormPage fqn="OrgPolicy" onNavigate={onNavigate} />
    );

    fireEvent.click(await screen.findByTestId('cancel-btn'));

    expect(patchPolicy).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'policies-detail', fqn: 'OrgPolicy' })
    );
  });
});
