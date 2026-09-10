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
  FieldKind,
  OnboardingProgress,
  OnboardingStage,
  State,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import {
  canRequestTransition,
  groupJourneySteps,
  journeyInitialStep,
} from './OnboardingJourney.utils';

const mine = { id: 'producer', type: 'user' };
const team = { id: 'stewards', type: 'team' };
const steps: OnboardingProgress['steps'] = [
  {
    step: { id: 'name', type: Type.Field, fieldPath: 'displayName' },
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
    step: { id: 'review', type: Type.Approval },
    required: true,
    state: State.Pending,
    assignees: [team],
    taskId: 'task',
  },
  {
    step: { id: 'unassigned', type: Type.Field },
    required: true,
    state: State.Blocked,
    assignees: [],
  },
];
const progress: OnboardingProgress = {
  stage: OnboardingStage.Draft,
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
