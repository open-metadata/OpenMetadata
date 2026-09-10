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
import { render, screen, within } from '@testing-library/react';
import {
  FieldKind,
  IntakeForm,
  OnboardingStage,
  TargetEntityType,
  Type,
} from '../../../generated/governance/intakeForm';
import { State } from '../../../generated/governance/onboarding/onboardingProgress';
import { evaluateOnboarding } from '../../../rest/governance/onboarding/Onboarding.api';
import { OnboardingCreationChecklist } from './OnboardingCreationChecklist';

jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  evaluateOnboarding: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const form: IntakeForm = {
  id: 'form',
  name: 'form',
  entityType: TargetEntityType.Metric,
  enabled: true,
  formFields: [
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
      {
        stage: OnboardingStage.Creation,
        steps: [
          {
            id: 'name',
            title: 'Display name',
            fieldPath: 'displayName',
            type: Type.Field,
            rules: { minLength: 5 },
          },
        ],
      },
    ],
  },
};

describe('producer checklist', () => {
  it('shows the server validation message and administrator guidance', async () => {
    const step = {
      id: 'name',
      title: 'Display name',
      type: Type.Field,
      fieldPath: 'displayName',
      guidance: 'Use the published business name',
    };
    (
      evaluateOnboarding as jest.MockedFunction<typeof evaluateOnboarding>
    ).mockResolvedValueOnce({
      stage: OnboardingStage.Creation,
      canAdvance: false,
      blockingSteps: ['name'],
      steps: [
        {
          step,
          state: State.Pending,
          required: true,
          message: 'The published name is required',
        },
      ],
    });
    render(
      <OnboardingCreationChecklist
        form={{
          ...form,
          onboarding: {
            enabled: true,
            gates: [{ stage: OnboardingStage.Creation, steps: [step] }],
          },
        }}
        values={{ displayName: 'Entered name' }}
      />
    );

    expect(
      await screen.findByText('The published name is required')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Use the published business name')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.onboarding-state-pending')
    ).toBeInTheDocument();
  });

  it('shows pending checks and updates their displayed progress from entered values', () => {
    const { rerender } = render(
      <OnboardingCreationChecklist
        preview
        form={form}
        values={{ displayName: 'x' }}
      />
    );
    const checklist = screen.getByTestId('onboarding-creation-checklist');

    expect(
      within(checklist).getByText('label.onboarding-state-pending')
    ).toBeInTheDocument();

    rerender(
      <OnboardingCreationChecklist
        preview
        form={form}
        values={{ displayName: 'Orders' }}
      />
    );

    expect(
      within(checklist).getByText('label.onboarding-state-complete')
    ).toBeInTheDocument();
    expect(within(checklist).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps the legacy form free of staged onboarding controls', () => {
    render(
      <OnboardingCreationChecklist
        preview
        form={{ ...form, onboarding: undefined }}
      />
    );

    expect(
      screen.queryByTestId('onboarding-creation-checklist')
    ).not.toBeInTheDocument();
  });
});
