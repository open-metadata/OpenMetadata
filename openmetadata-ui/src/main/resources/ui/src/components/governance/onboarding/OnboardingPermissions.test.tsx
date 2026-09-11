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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FieldKind,
  OnboardingStage,
  State,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { OnboardingJourney } from './OnboardingJourney';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it.each([
  { name: 'edit all', grant: { EditAll: true }, allowed: true },
  { name: 'all operations', grant: { All: true }, allowed: true },
  {
    name: 'field editing only',
    grant: { EditDescription: true },
    allowed: false,
  },
  { name: 'view only', grant: { ViewAll: true }, allowed: false },
])('retains transition authorization for $name', async ({ grant, allowed }) => {
  const advance = jest.fn();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(
    <OnboardingJourney
      advance={advance}
      loadField={jest.fn()}
      permissions={{ ...DEFAULT_ENTITY_PERMISSION, ...grant }}
      progress={{
        stage: OnboardingStage.Draft,
        canAdvance: true,
        blockingSteps: [],
        steps: [],
      }}
      refresh={jest.fn()}
    />
  );
  const button = screen.getByTestId('onboarding-advance');

  expect(button).toHaveProperty('disabled', !allowed);

  await user.click(button);

  expect(advance).toHaveBeenCalledTimes(allowed ? 1 : 0);
});

it('lets the assigned user edit reviewers with the existing EditReviewers permission', async () => {
  const viewer = { id: 'producer' };
  const result = {
    step: {
      id: 'reviewers',
      type: Type.Field,
      fieldPath: 'reviewers',
      title: 'Reviewers',
    },
    field: {
      fieldPath: 'reviewers',
      fieldLabel: 'Reviewers',
      fieldKind: FieldKind.Native,
      required: true,
    },
    state: State.Pending,
    required: true,
    assignees: [{ id: viewer.id, type: 'user', name: 'Producer' }],
  };
  await act(async () => {
    render(
      <OnboardingJourney
        advance={async () => undefined}
        loadField={async () => ({
          value: [],
          properties: [],
          save: async () => result,
        })}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditReviewers: true }}
        progress={{
          stage: OnboardingStage.Draft,
          canAdvance: false,
          blockingSteps: ['reviewers'],
          steps: [result],
        }}
        refresh={async () => undefined}
        viewer={viewer}
      />
    );
  });

  expect(
    screen.getByRole('combobox', { name: /Reviewers/ })
  ).toBeInTheDocument();
});
