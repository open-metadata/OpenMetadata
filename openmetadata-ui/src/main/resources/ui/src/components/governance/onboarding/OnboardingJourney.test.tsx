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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  FieldKind,
  OnboardingProgress,
  OnboardingStage,
  State,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { OnboardingJourney } from './OnboardingJourney';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const viewer = { id: 'producer' };
const progress: OnboardingProgress = {
  stage: OnboardingStage.Draft,
  canAdvance: false,
  blockingSteps: ['name', 'owners'],
  steps: [
    {
      step: {
        id: 'name',
        type: Type.Field,
        title: 'Display name',
        fieldPath: 'displayName',
      },
      field: {
        fieldPath: 'displayName',
        fieldLabel: 'Display name',
        fieldKind: FieldKind.Native,
      },
      required: true,
      state: State.Pending,
      assignees: [{ id: viewer.id, type: 'user', name: 'Producer' }],
    },
    {
      step: { id: 'note', type: Type.Field, title: 'Note', fieldPath: 'name' },
      field: {
        fieldPath: 'name',
        fieldLabel: 'Note',
        fieldKind: FieldKind.Native,
      },
      required: false,
      state: State.Pending,
      assignees: [{ id: viewer.id, type: 'user', name: 'Producer' }],
    },
    {
      step: {
        id: 'owners',
        type: Type.Field,
        title: 'Owners',
        fieldPath: 'owners',
      },
      field: {
        fieldPath: 'owners',
        fieldLabel: 'Owners',
        fieldKind: FieldKind.Native,
      },
      required: true,
      state: State.Pending,
      assignees: [{ id: 'steward', type: 'user', name: 'Domain steward' }],
      taskId: 'assigned-task',
    },
  ],
};
const permissions = { ...DEFAULT_ENTITY_PERMISSION, EditDisplayName: true };
const save = jest.fn();
const loadField = async () => ({ value: '', properties: [], save });
const advance = async () => undefined;
const refresh = async () => undefined;

beforeEach(() => jest.clearAllMocks());

it('saves a personal check, skips optional work, and shows the cross-assignee handoff', async () => {
  save.mockResolvedValue({ ...progress.steps[0], state: State.Complete });
  render(
    <OnboardingJourney
      advance={advance}
      loadField={loadField}
      permissions={{ ...permissions, EditAll: true }}
      progress={progress}
      refresh={refresh}
      viewer={viewer}
    />
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: /Display name/ }),
    { target: { value: 'Ready for review' } }
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });

  expect(
    await screen.findByRole('textbox', { name: /Note/ })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'label.skip' }));
  const handoff = await screen.findByTestId('onboarding-handoff');

  expect(within(handoff).getByText('Domain steward')).toBeInTheDocument();
  expect(
    within(handoff).getByRole('link', { name: 'label.view-task' })
  ).toHaveAttribute('href', '/tasks/assigned-task');
  expect(screen.getByTestId('onboarding-advance')).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'label.skip' })
  ).not.toBeInTheDocument();
});

it('keeps a required check selected when the saved server result is still pending', async () => {
  save.mockResolvedValue(progress.steps[0]);
  render(
    <OnboardingJourney
      advance={advance}
      loadField={loadField}
      permissions={permissions}
      progress={progress}
      refresh={refresh}
      viewer={viewer}
    />
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: /Display name/ }),
    { target: { value: 'x' } }
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    ).not.toBeDisabled()
  );

  expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveValue(
    'x'
  );
  expect(
    screen.queryByRole('textbox', { name: /Note/ })
  ).not.toBeInTheDocument();
});

it('shows a permission handoff without exposing an editor to a viewer', async () => {
  render(
    <OnboardingJourney
      advance={advance}
      loadField={loadField}
      permissions={DEFAULT_ENTITY_PERMISSION}
      progress={progress}
      refresh={refresh}
      viewer={viewer}
    />
  );

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByTestId('onboarding-handoff')).toBeInTheDocument();
  expect(screen.getByTestId('onboarding-advance')).toBeDisabled();
});

it('keeps unsaved input when navigation is cancelled and discards only after confirmation', async () => {
  render(
    <OnboardingJourney
      advance={advance}
      loadField={loadField}
      permissions={permissions}
      progress={progress}
      refresh={refresh}
      viewer={viewer}
    />
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: /Display name/ }),
    { target: { value: 'Unfinished input' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Owners' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'label.continue-editing' })
  );

  expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveValue(
    'Unfinished input'
  );

  fireEvent.click(screen.getByRole('button', { name: 'Owners' }));
  fireEvent.click(await screen.findByRole('button', { name: 'label.discard' }));

  expect(await screen.findByTestId('onboarding-handoff')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});
