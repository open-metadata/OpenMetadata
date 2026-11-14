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
import { act, fireEvent, screen } from '@testing-library/react';
import { DefaultTimeFormat } from '../../../../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../../../../rest/settingConfigAPI';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import TimeFormatSettings from './TimeFormatSettings';
import TimeFormatSettingsForm from './TimeFormatSettingsForm';

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
const BACK_TO_VIEW = { type: 'page', page: 'time-format', isEditing: false };

const renderForm = async () => {
  renderWithQueryClient(
    <TimeFormatSettingsForm showHint={false} onNavigate={onNavigate} />
  );
  await screen.findByTestId('time-format-radio-group');
};

describe('Default time format settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useApplicationStore.getState().setTimeFormat('12h');
    (patchAppConfiguration as jest.Mock).mockResolvedValue({});
  });

  it.each([
    [undefined, 'label.12-hour-format'],
    [DefaultTimeFormat.The12H, 'label.12-hour-format'],
    [DefaultTimeFormat.The24H, 'label.24-hour-format'],
  ])('view shows %s as "%s"', async (format, label) => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultTimeFormat: format,
    });
    renderWithQueryClient(
      <TimeFormatSettings
        onNavigate={onNavigate}
        onSetHeaderActions={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('default-time-format-value')
    ).toHaveTextContent(label);
  });

  it('keeps Save disabled until the selection changes', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultTimeFormat: DefaultTimeFormat.The12H,
    });
    await renderForm();

    expect(screen.getByTestId('save-button')).toBeDisabled();

    fireEvent.click(screen.getByText('label.24-hour-format'));

    expect(screen.getByTestId('save-button')).toBeEnabled();
  });

  it('saves the format, applies it to this session and returns to the view', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    await renderForm();

    fireEvent.click(screen.getByText('label.24-hour-format'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(patchAppConfiguration).toHaveBeenCalledWith({
      defaultTimeFormat: DefaultTimeFormat.The24H,
    });
    expect(useApplicationStore.getState().timeFormat).toBe('24h');
    expect(onNavigate).toHaveBeenCalledWith(BACK_TO_VIEW);
  });

  it('stays on the form and reports a failed save', async () => {
    const error = new Error('Save failed');
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    (patchAppConfiguration as jest.Mock).mockRejectedValue(error);
    await renderForm();

    fireEvent.click(screen.getByText('label.24-hour-format'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(useApplicationStore.getState().timeFormat).toBe('12h');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('cancel returns to the view without saving', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    await renderForm();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onNavigate).toHaveBeenCalledWith(BACK_TO_VIEW);
    expect(patchAppConfiguration).not.toHaveBeenCalled();
  });
});
