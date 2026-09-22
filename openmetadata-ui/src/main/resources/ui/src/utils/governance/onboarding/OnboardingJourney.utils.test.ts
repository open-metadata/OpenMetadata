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
import {
  CheckType,
  FieldKind,
  OnboardingProgress,
  State,
} from '../../../generated/governance/onboarding/onboardingProgress';
import {
  canRequestTransition,
  canSubmitForReview,
  groupJourneySteps,
  isCreatedByViewer,
  journeyInitialStep,
  journeySteps,
} from './OnboardingJourney.utils';

const mine = { id: 'producer', type: 'user' };
const team = { id: 'stewards', type: 'team' };
const steps: OnboardingProgress['steps'] = [
  {
    step: { id: 'name', type: CheckType.Attribute, fieldPath: 'displayName' },
    field: {
      fieldPath: 'displayName',
      fieldLabel: 'Display name',
      fieldKind: FieldKind.Native,
    },
    required: true,
    state: State.Pending,
    assignees: [mine],
  },
  {
    step: { id: 'review', type: CheckType.Approval },
    required: true,
    state: State.Pending,
    assignees: [team],
    taskId: 'task',
  },
  {
    step: { id: 'unassigned', type: CheckType.Attribute },
    required: true,
    state: State.Blocked,
    assignees: [],
  },
];
const progress: OnboardingProgress = {
  stage: 'draft',
  canAdvance: false,
  blockingSteps: ['name', 'review', 'unassigned'],
  steps,
};

describe('onboarding journey assignments and gates', () => {
  it('includes team assignments in personal work and keeps unresolved checks visible', () => {
    const groups = groupJourneySteps(steps, { id: mine.id, teams: [team] });

    expect(groups.mine.map((result) => result.step.id)).toEqual([
      'name',
      'review',
    ]);
    expect(groups.others).toEqual([]);
    expect(groups.unassigned.map((result) => result.step.id)).toEqual([
      'unassigned',
    ]);
  });

  it('opens the first unfinished personal check when resuming', () => {
    expect(
      journeyInitialStep([{ ...steps[0], state: State.Complete }, steps[1]], {
        id: mine.id,
        teams: [team],
      })
    ).toBe('review');
  });

  it('cannot advance while another assignee has a required field outstanding', () => {
    expect(
      canRequestTransition({
        ...progress,
        steps: [{ ...steps[0], state: State.Complete }, steps[2]],
      })
    ).toBe(false);
  });

  it('permits idempotent requests for active, stale, rejected, or failed reviews', () => {
    expect(canRequestTransition({ ...progress, steps: [steps[1]] })).toBe(true);
    expect(
      canRequestTransition({
        ...progress,
        steps: [{ ...steps[1], state: State.Rejected }],
      })
    ).toBe(true);
    expect(
      canRequestTransition({
        ...progress,
        steps: [{ ...steps[1], state: State.Failed }],
      })
    ).toBe(true);
  });
});

describe('what the wizard walks through', () => {
  const stepAt = (
    id: string,
    stage: string,
    state: State,
    assignee = 'producer'
  ) => ({
    step: { id, type: CheckType.Attribute, fieldPath: id },
    required: true,
    state,
    stage,
    assignees: [{ id: assignee, type: 'user', name: assignee }],
  });

  it('drops checks an earlier gate already passed but keeps ones it let through', () => {
    const progress = {
      stage: 'draft',
      canAdvance: false,
      blockingSteps: [],
      steps: [
        stepAt('creation-done', 'creation', State.Complete),
        stepAt('creation-open', 'creation', State.Pending),
        stepAt('draft-done', 'draft', State.Complete),
      ],
    } as unknown as OnboardingProgress;

    expect(journeySteps(progress).map((result) => result.step.id)).toEqual([
      'creation-open',
      'draft-done',
    ]);
  });

  it('reads the creator from the checks the playbook assigned to that role', () => {
    const progress = {
      stage: 'draft',
      canAdvance: false,
      blockingSteps: [],
      steps: [stepAt('name', 'creation', State.Complete, 'producer')],
    } as unknown as OnboardingProgress;

    expect(isCreatedByViewer(progress, { id: 'producer' })).toBe(true);
    expect(isCreatedByViewer(progress, { id: 'someone-else' })).toBe(false);
  });

  it('lets a soft gate be asked for and keeps a hard one shut', () => {
    const blocked = {
      stage: 'draft',
      canAdvance: false,
      blockingSteps: ['a'],
      steps: [stepAt('a', 'draft', State.Pending)],
    } as unknown as OnboardingProgress;

    expect(canSubmitForReview(blocked)).toBe(false);
    expect(canSubmitForReview({ ...blocked, gateBlocking: false })).toBe(true);
    expect(canSubmitForReview({ ...blocked, canAdvance: true })).toBe(true);
  });
});
