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
import { TargetEntityType } from '../../../generated/entity/governance/onboardingPlaybook';
import {
  CheckType,
  FieldKind,
  OnboardingProgress,
  State,
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
  stage: 'inReview',
  entityVersion: 0.3,
  nextStage: 'approved',
  blockingSteps: ['review'],
  canAdvance: false,
  steps: [
    {
      step: {
        id: 'review',
        type: CheckType.Approval,
        title: 'Steward approval',
      },
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
      stage: 'approved',
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
    // The only thing holding the gate is the workflow's decision, so there is nothing to submit.
    expect(screen.getByTestId('onboarding-advance')).toHaveTextContent(
      'label.waiting-for-approval'
    );
    expect(screen.getByTestId('onboarding-advance')).toBeDisabled();

    mockGetProgress.mockResolvedValue(reviewed);
    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-advance')).toBeEnabled()
    );

    expect(screen.getByTestId('onboarding-advance')).toHaveTextContent(
      'label.send-to-stage'
    );

    expect(
      screen.getByText('message.onboarding-workflow-evidence')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-advance'));

    expect(
      await screen.findByTestId('onboarding-current-stage')
    ).toHaveTextContent('label.approved');
    expect(screen.queryByTestId('onboarding-advance')).not.toBeInTheDocument();
    expect(await screen.findByTestId('onboarding-submitted')).toHaveTextContent(
      'label.sent-to-stage'
    );
  });

  it('keeps field editing and gate advancement disabled for a viewer', async () => {
    mockGetProgress.mockResolvedValue({
      ...progress,
      steps: [
        {
          step: {
            id: 'name',
            type: CheckType.Attribute,
            fieldPath: 'displayName',
          },
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
