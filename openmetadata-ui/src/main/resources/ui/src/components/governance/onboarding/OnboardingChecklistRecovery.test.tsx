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
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
  getOnboardingAsset,
  getOnboardingProgress,
  patchOnboardingAsset,
  transitionOnboarding,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { OnboardingChecklist } from './OnboardingChecklist';
import { OnboardingNativeInput } from './OnboardingNativeInput';

jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  getOnboardingAsset: jest.fn(),
  getOnboardingProgress: jest.fn(),
  patchOnboardingAsset: jest.fn(),
  transitionOnboarding: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const progress: OnboardingProgress = {
  stage: OnboardingStage.Draft,
  entityVersion: 0.3,
  nextStatus: EntityStatus.InReview,
  canAdvance: false,
  blockingSteps: ['display-name'],
  steps: [
    {
      step: {
        id: 'display-name',
        type: Type.Field,
        title: 'Display name',
        fieldPath: 'displayName',
      },
      field: {
        fieldPath: 'displayName',
        fieldLabel: 'Display name',
        fieldKind: FieldKind.Native,
        required: true,
      },
      state: State.Pending,
      required: true,
      assignees: [{ id: 'assigned-user', type: 'user', name: 'Producer' }],
    },
  ],
};
const asset = {
  id: 'asset',
  name: 'orders',
  version: 0.3,
  displayName: 'Saved value',
};
const permissions = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  (getOnboardingProgress as jest.Mock).mockResolvedValue(progress);
  (getOnboardingAsset as jest.Mock).mockResolvedValue(asset);
});

async function mountChecklist() {
  await act(async () => {
    render(
      <OnboardingChecklist
        asset={asset}
        entityType={TargetEntityType.Metric}
        permissions={permissions}
      />
    );
  });
}

async function editField() {
  await act(async () => undefined);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'label.edit' }));
  });

  return screen.findByRole('textbox', { name: /Display name/ });
}

it('saves a field, shows completion, and reopens its persisted value', async () => {
  (patchOnboardingAsset as jest.Mock).mockImplementation(async () => {
    const saved = { ...asset, displayName: 'Completed metadata', version: 0.4 };
    (getOnboardingAsset as jest.Mock).mockResolvedValue(saved);
    (getOnboardingProgress as jest.Mock).mockResolvedValue({
      ...progress,
      canAdvance: true,
      blockingSteps: [],
      entityVersion: 0.4,
      steps: progress.steps.map((step) => ({ ...step, state: State.Complete })),
    });

    return saved;
  });
  await mountChecklist();
  fireEvent.change(await editField(), {
    target: { value: 'Completed metadata' },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    );
  });

  expect(
    screen.getByRole('button', { name: 'Display name' })
  ).toHaveTextContent('label.onboarding-state-complete');

  fireEvent.click(screen.getByRole('button', { name: 'Display name' }));

  expect(await editField()).toHaveValue('Completed metadata');
});

it('preserves or confirms dirty input when collapsing and reopening the checklist', async () => {
  await mountChecklist();
  fireEvent.change(await editField(), { target: { value: 'Unfinished work' } });
  fireEvent.click(screen.getByRole('button', { name: 'label.collapse' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'label.continue-editing' })
  );

  expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveValue(
    'Unfinished work'
  );
});

it('Refresh recovers a transient failure while loading the selected field', async () => {
  (getOnboardingAsset as jest.Mock).mockRejectedValueOnce(
    new Error('Temporary service failure')
  );
  await mountChecklist();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'label.edit' }));
  });
  await screen.findByText('message.onboarding-configuration-load-error');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }));
  });

  expect(
    await screen.findByRole('textbox', { name: /Display name/ })
  ).toHaveValue('Saved value');
});

it('Refresh makes a conflicting field save recoverable without leaving the check', async () => {
  await mountChecklist();
  fireEvent.change(await editField(), { target: { value: 'New value' } });
  (patchOnboardingAsset as jest.Mock).mockImplementation(
    async (_type, _id, patch) => {
      if (patch[0].value !== 0.4) {
        throw new Error('409: version conflict');
      }

      return { ...asset, version: 0.5, displayName: 'New value' };
    }
  );
  await act(async () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    )
  );
  (getOnboardingAsset as jest.Mock).mockResolvedValue({
    ...asset,
    version: 0.4,
  });
  (getOnboardingProgress as jest.Mock).mockResolvedValue({
    ...progress,
    entityVersion: 0.4,
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }));
  });
  await act(async () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    )
  );

  expect(
    (patchOnboardingAsset as jest.Mock).mock.calls.at(-1)?.[2][0].value
  ).toBe(0.4);
});

it('checks unsaved edits before advancing a gate whose persisted fields already pass', async () => {
  (getOnboardingProgress as jest.Mock).mockResolvedValue({
    ...progress,
    canAdvance: true,
    blockingSteps: [],
    steps: progress.steps.map((step) => ({ ...step, state: State.Complete })),
  });
  (transitionOnboarding as jest.Mock).mockResolvedValue({
    ...progress,
    stage: OnboardingStage.InReview,
    canAdvance: false,
  });
  await mountChecklist();
  fireEvent.change(await editField(), {
    target: { value: 'Unfinished replacement' },
  });
  await act(async () =>
    fireEvent.click(screen.getByTestId('onboarding-advance'))
  );

  expect(transitionOnboarding).not.toHaveBeenCalled();
});

it('accepts multiple synonyms typed with the advertised comma separator', async () => {
  function Synonyms() {
    const [value, setValue] = useState<unknown>([]);

    return (
      <OnboardingNativeInput
        label="Synonyms"
        path="synonyms"
        value={value}
        onChange={setValue}
      />
    );
  }
  render(<Synonyms />);
  const input = screen.getByRole('textbox', { name: /Synonyms/ });
  await userEvent.type(input, 'first, second');

  expect(input).toHaveValue('first, second');
});

it('retains the draft after a conflict and requires review before replacing changed metadata', async () => {
  await mountChecklist();
  fireEvent.change(await editField(), { target: { value: 'My draft' } });
  (patchOnboardingAsset as jest.Mock).mockRejectedValueOnce(
    new Error('version conflict')
  );
  await act(async () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    )
  );
  (getOnboardingAsset as jest.Mock).mockResolvedValue({
    ...asset,
    version: 0.4,
    displayName: 'Saved by another producer',
  });
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }))
  );

  expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveValue(
    'My draft'
  );
  expect(screen.getByText('Saved by another producer')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'label.onboarding-save-continue' })
  ).toBeDisabled();

  fireEvent.click(
    screen.getByRole('button', { name: 'label.onboarding-use-saved-value' })
  );

  expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveValue(
    'Saved by another producer'
  );
  expect(
    screen.queryByTestId('onboarding-field-conflict')
  ).not.toBeInTheDocument();
});

it('does not accept edits while a field save is still in flight', async () => {
  let finish: () => void = () => undefined;
  (patchOnboardingAsset as jest.Mock).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ ...asset, displayName: 'Saving now', version: 0.4 });
      })
  );
  await mountChecklist();
  const input = await editField();
  fireEvent.change(input, { target: { value: 'Saving now' } });
  await act(async () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    )
  );

  expect(input).toBeDisabled();

  await act(async () => finish());

  expect(input).toBeEnabled();

  fireEvent.change(input, { target: { value: 'Next edit' } });

  expect(input).toHaveValue('Next edit');
});

it('keeps only the saved value when Discard is followed by a failed transition', async () => {
  (getOnboardingProgress as jest.Mock).mockResolvedValue({
    ...progress,
    canAdvance: true,
    blockingSteps: [],
    steps: progress.steps.map((step) => ({ ...step, state: State.Complete })),
  });
  (transitionOnboarding as jest.Mock).mockRejectedValueOnce(
    new Error('Transition unavailable')
  );
  await mountChecklist();
  fireEvent.change(await editField(), {
    target: { value: 'Discard this value' },
  });
  fireEvent.click(screen.getByTestId('onboarding-advance'));
  await act(async () =>
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.discard' })
    )
  );

  expect(
    await screen.findByRole('textbox', { name: /Display name/ })
  ).toHaveValue('Saved value');
});

it('uses the last successful save as the baseline when refreshing another draft', async () => {
  (patchOnboardingAsset as jest.Mock).mockImplementation(async () => {
    const saved = { ...asset, displayName: 'First save', version: 0.4 };
    (getOnboardingAsset as jest.Mock).mockResolvedValue(saved);

    return saved;
  });
  await mountChecklist();
  const input = await editField();
  fireEvent.change(input, { target: { value: 'First save' } });
  await act(async () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'label.onboarding-save-continue' })
    )
  );
  fireEvent.change(input, { target: { value: 'Second draft' } });
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }))
  );

  expect(
    screen.queryByTestId('onboarding-field-conflict')
  ).not.toBeInTheDocument();
  expect(input).toHaveValue('Second draft');
  expect(
    screen.getByRole('button', { name: 'label.onboarding-save-continue' })
  ).toBeEnabled();
});
