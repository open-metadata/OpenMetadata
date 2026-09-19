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
  EntityStatus,
  OnboardingStageDefinition,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { PlaybookStageDialog } from './PlaybookStageDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderDialog = (stage?: OnboardingStageDefinition) => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <PlaybookStageDialog stage={stage} onClose={onClose} onSave={onSave} />
  );

  return { onSave, onClose };
};

const pickStatus = async (option: string) => {
  fireEvent.click(
    screen.getByTestId('stage-status').querySelector('button') as Element
  );
  fireEvent.click(await screen.findByRole('option', { name: option }));
};

describe('PlaybookStageDialog', () => {
  it('starts with the caret in the name, which is what the dialog is for', () => {
    renderDialog();

    expect(screen.getByTestId('stage-name')).toHaveFocus();
  });

  it('refuses to save a stage with no name', () => {
    renderDialog();

    expect(screen.getByTestId('save-stage')).toBeDisabled();
  });

  it('saves a new stage with no status unless one is picked', () => {
    const { onSave } = renderDialog();

    fireEvent.change(screen.getByTestId('stage-name'), {
      target: { value: '  Certified  ' },
    });
    fireEvent.click(screen.getByTestId('save-stage'));

    expect(onSave).toHaveBeenCalledWith('Certified', undefined);
  });

  it('records the status the author picks', async () => {
    const { onSave } = renderDialog();

    fireEvent.change(screen.getByTestId('stage-name'), {
      target: { value: 'Certified' },
    });
    await pickStatus(EntityStatus.Approved);
    fireEvent.click(screen.getByTestId('save-stage'));

    expect(onSave).toHaveBeenCalledWith('Certified', EntityStatus.Approved);
  });

  it('never offers Unprocessed, which is an unset value rather than a state', async () => {
    renderDialog();

    fireEvent.click(
      screen.getByTestId('stage-status').querySelector('button') as Element
    );

    expect(
      await screen.findByRole('option', { name: EntityStatus.Draft })
    ).toBeVisible();
    expect(
      screen.queryByRole('option', { name: EntityStatus.Unprocessed })
    ).toBeNull();
  });

  it('opens on the existing name and status when renaming', () => {
    renderDialog({
      key: 'draft',
      displayName: 'Draft',
      order: 1,
      entityStatus: EntityStatus.Draft,
    });

    expect(screen.getByTestId('stage-name')).toHaveValue('Draft');
    expect(screen.getByTestId('stage-status')).toHaveTextContent(
      EntityStatus.Draft
    );
  });
});
