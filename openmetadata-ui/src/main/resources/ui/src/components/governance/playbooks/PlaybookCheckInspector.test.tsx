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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  CheckType,
  OnboardingStep,
  Requirement,
  Role,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { PlaybookCheckInspector } from './PlaybookCheckInspector';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../onboarding/OnboardingAssignees', () => ({
  OnboardingAssignees: ({
    label,
    onChange,
  }: {
    label: string;
    onChange: (value: { id: string; type: string; name: string }[]) => void;
  }) => (
    <button
      data-testid="assignee-picker"
      type="button"
      onClick={() =>
        onChange([{ id: 'team-1', type: 'team', name: 'DataManagement' }])
      }>
      {label}
    </button>
  ),
}));

const properties: CustomProperty[] = [
  {
    name: 'retentionPolicy',
    description: 'Retention policy',
    propertyType: { id: 'p', type: 'type', name: 'enum' },
  },
];

const approvalWorkflows = [
  { id: 'wf-1', name: 'StewardApproval', displayName: 'Steward approval' },
] as WorkflowDefinition[];

const step: OnboardingStep = {
  id: 'description',
  title: 'Business description',
  type: CheckType.Attribute,
  requirement: Requirement.Blocking,
  fieldPath: 'description',
};

const renderInspector = (overrides: Partial<OnboardingStep> = {}) => {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  render(
    <PlaybookCheckInspector
      approvalWorkflows={approvalWorkflows}
      customProperties={properties}
      isCreationGate={false}
      position={2}
      step={{ ...step, ...overrides }}
      onChange={onChange}
      onRemove={onRemove}
    />
  );

  return { onChange, onRemove };
};

describe('PlaybookCheckInspector', () => {
  it('lets the author rename the check', () => {
    const { onChange } = renderInspector();

    fireEvent.change(screen.getByTestId('check-title'), {
      target: { value: 'What it is for' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'What it is for' })
    );
  });

  it('names the field, where it lives and the shape it holds', () => {
    renderInspector();

    expect(screen.getByText('description')).toBeVisible();
    expect(screen.getByText('label.native-field')).toBeVisible();
    expect(screen.getByTestId('check-dtype')).toHaveTextContent(
      'label.markdown'
    );
  });

  it('reads a custom property shape from the property, not the path', () => {
    renderInspector({ fieldPath: 'extension.retentionPolicy' });

    expect(screen.getByText('label.custom-property')).toBeVisible();
    expect(screen.getByTestId('check-dtype')).toHaveTextContent(
      'label.single-select'
    );
  });

  it('asks an approval for a workflow, and nothing else does', () => {
    const { onChange } = renderInspector({ type: CheckType.Approval });

    expect(screen.getByTestId('check-workflow')).toBeVisible();
    expect(screen.getByTestId('check-dtype')).toHaveTextContent(
      'label.workflow'
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not ask a field check for a workflow', () => {
    renderInspector();

    expect(screen.queryByTestId('check-workflow')).toBeNull();
  });

  it('offers a picker only once the task goes to named users or teams', () => {
    renderInspector();

    expect(screen.queryByTestId('assignee-picker')).toBeNull();
  });

  it('keeps the explicit role when the named team is picked', () => {
    const { onChange } = renderInspector({
      assignment: { role: Role.Explicit },
    });

    fireEvent.click(screen.getByTestId('assignee-picker'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: {
          role: Role.Explicit,
          assignees: [{ id: 'team-1', type: 'team', name: 'DataManagement' }],
        },
      })
    );
  });

  it('changes the requirement from the segmented control', () => {
    const { onChange } = renderInspector();

    fireEvent.click(screen.getByText('label.recommended'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ requirement: Requirement.Recommended })
    );
  });

  it('states what counts as an answer, derived from the rule', () => {
    renderInspector({ rules: { minLength: 120 } });

    expect(screen.getByTestId('accepted-when-rule')).toHaveTextContent(
      'message.accepted-when-min-length'
    );
  });

  it('keeps the numbers behind the sentence out of the way until asked for', () => {
    renderInspector({ rules: { minLength: 120 } });

    expect(screen.queryByTestId('check-min-length')).toBeNull();

    fireEvent.click(screen.getByTestId('edit-accepted-when'));

    expect(screen.getByTestId('check-min-length')).toHaveValue(120);
  });

  it('has no rule to edit on an approval - the decision is the rule', () => {
    renderInspector({ type: CheckType.Approval });

    expect(screen.getByTestId('accepted-when-rule')).toHaveTextContent(
      'message.accepted-when-decision-recorded'
    );
    expect(screen.queryByTestId('edit-accepted-when')).toBeNull();
  });

  it('clears the rule when the length is emptied', () => {
    const { onChange } = renderInspector({ rules: { minLength: 120 } });

    fireEvent.click(screen.getByTestId('edit-accepted-when'));
    fireEvent.change(screen.getByTestId('check-min-length'), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ rules: undefined })
    );
  });

  it('removes the check it is inspecting', () => {
    const { onRemove } = renderInspector();

    fireEvent.click(screen.getByTestId('remove-check'));

    expect(onRemove).toHaveBeenCalledWith('description');
  });
});
