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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  FieldKind,
  IntakeForm,
  OnboardingStage,
  Role,
  TargetEntityType,
  Type,
} from '../../../generated/governance/intakeForm';
import { OnboardingPreview } from './OnboardingPreview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const creator = { id: 'creator', type: 'user', name: 'Producer' };
const form: IntakeForm = {
  id: 'preview',
  name: 'metric',
  entityType: TargetEntityType.Metric,
  formFields: [
    {
      fieldPath: 'name',
      fieldLabel: 'Name',
      fieldKind: FieldKind.Native,
      required: true,
    },
  ],
  onboarding: {
    enabled: true,
    gates: [
      {
        stage: OnboardingStage.Creation,
        steps: [
          {
            id: 'name',
            type: Type.Field,
            fieldPath: 'name',
            rules: { minLength: 5 },
          },
        ],
      },
    ],
  },
};
const reviewer = { id: 'reviewer', name: 'Steward', type: 'user' };
const workflow = {
  id: 'workflow',
  name: 'Steward review',
  description: 'Review metadata',
  deployed: true,
  nodes: [
    {
      subType: 'userApprovalTask',
      config: { assignees: { candidates: [reviewer] } },
    },
  ],
};
const reviewedForm: IntakeForm = {
  ...form,
  onboarding: {
    enabled: true,
    gates: [
      ...(form.onboarding?.gates ?? []),
      {
        stage: OnboardingStage.InReview,
        steps: [
          {
            id: 'approval',
            title: 'Steward approval',
            type: Type.Approval,
            workflow: {
              id: workflow.id,
              name: workflow.name,
              type: 'workflowDefinition',
            },
          },
        ],
      },
    ],
  },
};
const Example = ({
  configuration = form,
  initialStage = OnboardingStage.Creation,
}: {
  configuration?: IntakeForm;
  initialStage?: OnboardingStage;
}) => {
  const [stage, setStage] = useState(initialStage);

  return (
    <OnboardingPreview
      creator={creator}
      form={configuration}
      properties={[]}
      stage={stage}
      workflows={[workflow]}
      onStageChange={setStage}
    />
  );
};

it('uses the full journey in preview and advances only after its required values pass', async () => {
  render(<Example />);

  expect(
    screen.getByText('message.onboarding-preview-help')
  ).toBeInTheDocument();

  fireEvent.change(await screen.findByRole('textbox', { name: /Name/ }), {
    target: { value: 'x' },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });

  expect(screen.getByTestId('onboarding-advance')).toBeDisabled();

  fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
    target: { value: 'Revenue' },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });
  await screen.findByRole('button', { name: 'label.advance-to-stage' });
  fireEvent.click(screen.getByTestId('onboarding-advance'));

  expect(await screen.findByText('label.draft')).toBeInTheDocument();
});

it('simulates rejection and approval, then invalidates the review after metadata changes', async () => {
  render(
    <Example
      configuration={reviewedForm}
      initialStage={OnboardingStage.InReview}
    />
  );
  fireEvent.change(await screen.findByRole('textbox', { name: /Name/ }), {
    target: { value: 'Revenue' },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });

  expect(await screen.findByTestId('onboarding-handoff')).toHaveTextContent(
    'Steward'
  );

  fireEvent.click(
    screen.getByRole('button', { name: 'label.onboarding-simulate-rejection' })
  );

  expect(screen.getByTestId('onboarding-advance')).toBeDisabled();

  fireEvent.click(
    screen.getByRole('button', { name: 'label.onboarding-simulate-approval' })
  );

  expect(screen.getByTestId('onboarding-advance')).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: 'Name' }));
  fireEvent.change(await screen.findByRole('textbox', { name: /Name/ }), {
    target: { value: 'Adjusted revenue' },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });

  expect(screen.getByTestId('onboarding-advance')).toBeDisabled();
  expect(screen.getByTestId('onboarding-handoff')).toHaveTextContent(
    'label.onboarding-state-pending'
  );
});

it('previews team work separately from the creator requirements', async () => {
  const teamForm: IntakeForm = {
    ...form,
    formFields: [
      ...(form.formFields ?? []),
      {
        fieldPath: 'displayName',
        fieldLabel: 'Display name',
        fieldKind: FieldKind.Native,
        required: true,
      },
    ],
    onboarding: {
      enabled: true,
      gates: [
        ...(form.onboarding?.gates ?? []),
        {
          stage: OnboardingStage.Draft,
          steps: [
            {
              id: 'displayName',
              fieldPath: 'displayName',
              type: Type.Field,
              assignment: {
                role: Role.Explicit,
                assignees: [{ id: 'stewards', type: 'team', name: 'Stewards' }],
              },
            },
          ],
        },
      ],
    },
  };
  render(
    <Example configuration={teamForm} initialStage={OnboardingStage.Draft} />
  );
  fireEvent.click(
    screen.getByRole('button', { name: /label.onboarding-preview-as/ })
  );
  fireEvent.click(await screen.findByRole('option', { name: 'Stewards' }));

  expect(
    await screen.findByRole('textbox', { name: /Display name/ })
  ).toBeInTheDocument();

  const personal = screen.getByRole('navigation', {
    name: 'label.onboarding-your-checks',
  });

  expect(personal).toHaveTextContent('Display name');
  expect(personal).not.toHaveTextContent('Name');
});
