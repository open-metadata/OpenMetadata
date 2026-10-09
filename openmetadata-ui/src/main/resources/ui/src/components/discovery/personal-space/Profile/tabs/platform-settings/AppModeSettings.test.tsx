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
import { DefaultAppMode } from '../../../../../../generated/api/configuration/appConfiguration';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../../../../rest/settingConfigAPI';
import AppModeSettings from './AppModeSettings';
import AppModeSettingsForm from './AppModeSettingsForm';

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
const BACK_TO_VIEW = { type: 'page', page: 'app-mode', isEditing: false };

const renderForm = async () => {
  render(<AppModeSettingsForm showHint={false} onNavigate={onNavigate} />);
  await screen.findByTestId('app-mode-radio-group');
};

describe('Default app mode settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (patchAppConfiguration as jest.Mock).mockResolvedValue({});
  });

  it.each([
    [undefined, 'label.no-default'],
    [DefaultAppMode.Classic, 'label.classic'],
    [DefaultAppMode.AI, 'label.ai'],
  ])('view shows %s as "%s"', async (mode, label) => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultAppMode: mode,
    });
    render(
      <AppModeSettings onNavigate={onNavigate} onSetHeaderActions={jest.fn()} />
    );

    expect(
      await screen.findByTestId('default-app-mode-value')
    ).toHaveTextContent(label);
  });

  it('keeps Save disabled until the selection changes', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultAppMode: DefaultAppMode.Classic,
    });
    await renderForm();

    expect(screen.getByTestId('save-button')).toBeDisabled();

    fireEvent.click(screen.getByText('label.ai'));

    expect(screen.getByTestId('save-button')).toBeEnabled();
  });

  it('sends null for the "no default" choice and returns to the view', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultAppMode: DefaultAppMode.AI,
    });
    await renderForm();

    fireEvent.click(screen.getByText('label.no-default'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(patchAppConfiguration).toHaveBeenCalledWith({
      defaultAppMode: null,
    });
    expect(onNavigate).toHaveBeenCalledWith(BACK_TO_VIEW);
  });

  it('cancel returns to the view without saving', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    await renderForm();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onNavigate).toHaveBeenCalledWith(BACK_TO_VIEW);
    expect(patchAppConfiguration).not.toHaveBeenCalled();
  });
});
