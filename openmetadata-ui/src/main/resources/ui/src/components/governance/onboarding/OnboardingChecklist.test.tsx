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
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import {
  EntityStatus,
  FieldKind,
  OnboardingProgress,
  OnboardingStage,
  State,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import {
  getOnboardingProgress,
  transitionOnboarding,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { OnboardingChecklist } from './OnboardingChecklist';

jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  getOnboardingProgress: jest.fn(),
  transitionOnboarding: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const progress: OnboardingProgress = {
  stage: OnboardingStage.InReview,
  entityVersion: 0.3,
  nextStatus: EntityStatus.Approved,
  blockingSteps: ['review'],
  canAdvance: false,
  steps: [
    {
      step: { id: 'review', type: Type.Approval, title: 'Steward approval' },
      state: State.Pending,
      required: true,
      message: 'Workflow approval is required',
      taskId: 'review-task',
      workflowInstanceId: 'execution',
      assignees: [
        { id: 'reviewer', type: 'user', displayName: 'Assigned reviewer' },
      ],
    },
  ],
};
const asset = { id: 'asset', name: 'orders', version: 0.3 };
const mockGetProgress = getOnboardingProgress as jest.MockedFunction<
  typeof getOnboardingProgress
>;
const mockTransition = transitionOnboarding as jest.MockedFunction<
  typeof transitionOnboarding
>;

describe('saved onboarding checklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProgress.mockResolvedValue(progress);
  });

  it('retains workflow blockers until the server reports a completed review', async () => {
    const reviewed: OnboardingProgress = {
      ...progress,
      canAdvance: true,
      blockingSteps: [],
      steps: progress.steps.map((step) => ({
        ...step,
        state: State.Complete,
        message: undefined,
      })),
    };
    mockTransition.mockResolvedValue({
      ...reviewed,
      stage: OnboardingStage.Approved,
      completed: true,
    });
    render(
      <OnboardingChecklist
        asset={asset}
        entityType={TargetEntityType.Metric}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
      />
    );

    expect(await screen.findByText('Assigned reviewer')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'label.view-task' })
    ).toHaveAttribute('href', '/tasks/review-task');
    expect(screen.getByTestId('onboarding-advance')).toHaveTextContent(
      'label.request-onboarding-transition'
    );

    mockGetProgress.mockResolvedValue(reviewed);
    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }));
    await screen.findByRole('button', { name: 'label.advance-to-stage' });
    fireEvent.click(screen.getByTestId('onboarding-advance'));

    expect(
      await screen.findByTestId('onboarding-current-stage')
    ).toHaveTextContent('label.approved');
    expect(screen.queryByTestId('onboarding-advance')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Steward approval' }));

    expect(
      screen.getByText('message.onboarding-workflow-evidence')
    ).toBeInTheDocument();
  });

  it('keeps field editing and gate advancement disabled for a viewer', async () => {
    mockGetProgress.mockResolvedValue({
      ...progress,
      steps: [
        {
          step: { id: 'name', type: Type.Field, fieldPath: 'displayName' },
          field: {
            fieldPath: 'displayName',
            fieldLabel: 'Display name',
            fieldKind: FieldKind.Native,
          },
          state: State.Pending,
          required: true,
        },
      ],
    });
    render(
      <OnboardingChecklist
        asset={asset}
        entityType={TargetEntityType.Metric}
        permissions={DEFAULT_ENTITY_PERMISSION}
      />
    );
    await screen.findByTestId('onboarding-handoff');

    expect(
      screen.queryByRole('button', { name: 'label.edit' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('onboarding-advance')).toBeDisabled();
  });
});
