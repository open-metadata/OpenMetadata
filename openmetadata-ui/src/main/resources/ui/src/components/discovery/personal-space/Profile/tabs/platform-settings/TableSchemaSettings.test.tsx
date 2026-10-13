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
import { DefaultColumnOrder } from '../../../../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../../../../rest/settingConfigAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import TableSchemaSettings from './TableSchemaSettings';
import TableSchemaSettingsForm from './TableSchemaSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getAppConfiguration: jest.fn(),
  patchAppConfiguration: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const onNavigate = jest.fn();
const BACK_TO_VIEW = { type: 'page', page: 'table-schema', isEditing: false };

const renderForm = async () => {
  render(<TableSchemaSettingsForm showHint={false} onNavigate={onNavigate} />);
  await screen.findByTestId('default-column-order-radio-group');
};

const optionInput = (value: DefaultColumnOrder) =>
  screen
    .getByTestId(`column-order-option-${value}`)
    .querySelector('input') as HTMLInputElement;

describe('Table & Schema settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useApplicationStore
      .getState()
      .setAppPreferences({ defaultColumnOrder: undefined });
    (patchAppConfiguration as jest.Mock).mockResolvedValue({});
  });

  it.each([
    [undefined, 'label.alphabetical (A → Z)'],
    [null, 'label.alphabetical (A → Z)'],
    [DefaultColumnOrder.Alphabetical, 'label.alphabetical (A → Z)'],
    [DefaultColumnOrder.SourceOrder, 'label.original-order'],
  ])('view shows a stored %s order as "%s"', async (order, label) => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultColumnOrder: order,
    });
    render(
      <TableSchemaSettings
        onNavigate={onNavigate}
        onSetHeaderActions={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('default-column-order-value')
    ).toHaveTextContent(label);
  });

  it('starts alphabetical when nothing is stored and keeps Save off until a change', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    await renderForm();

    expect(optionInput(DefaultColumnOrder.Alphabetical)).toBeChecked();
    expect(screen.getByTestId('save-button')).toBeDisabled();
  });

  it('saves only the column order and applies it to this session', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    await renderForm();

    fireEvent.click(optionInput(DefaultColumnOrder.SourceOrder));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(patchAppConfiguration).toHaveBeenCalledWith({
      defaultColumnOrder: DefaultColumnOrder.SourceOrder,
    });
    expect(
      useApplicationStore.getState().appPreferences.defaultColumnOrder
    ).toBe(DefaultColumnOrder.SourceOrder);
    expect(onNavigate).toHaveBeenCalledWith(BACK_TO_VIEW);
  });

  it('stays on the form and keeps the session default when the save fails', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    (patchAppConfiguration as jest.Mock).mockRejectedValue(new Error('boom'));
    await renderForm();

    fireEvent.click(optionInput(DefaultColumnOrder.SourceOrder));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(
      useApplicationStore.getState().appPreferences.defaultColumnOrder
    ).toBeUndefined();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
