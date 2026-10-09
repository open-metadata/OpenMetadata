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
} from '@testing-library/react';
import { SettingType } from '../../../../../../generated/settings/settings';
import {
  getLoginConfig,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import LoginSettings from './LoginSettings';
import LoginSettingsForm from './LoginSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getLoginConfig: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

const onNavigate = jest.fn();

const inputOf = (testId: string) =>
  screen.getByTestId(testId).querySelector('input') as HTMLInputElement;

describe('Login configuration settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLoginConfig as jest.Mock).mockResolvedValue({
      maxLoginFailAttempts: 3,
      accessBlockTime: 600,
      jwtTokenExpiryTime: 3600,
    });
    (updateSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('shows each limit, with the JWT expiry in seconds', async () => {
    render(
      <LoginSettings onNavigate={onNavigate} onSetHeaderActions={jest.fn()} />
    );

    expect(
      await screen.findByTestId('max-login-fail-attampts')
    ).toHaveTextContent('3');
    expect(screen.getByTestId('access-block-time')).toHaveTextContent('600');
    expect(screen.getByTestId('jwt-token-expiry-time')).toHaveTextContent(
      '3600 label.second-plural'
    );
  });

  it('saves numbers and treats a cleared field as unset', async () => {
    render(<LoginSettingsForm showHint={false} onNavigate={onNavigate} />);
    await waitFor(() => expect(inputOf('maxLoginFailAttempts')).toHaveValue(3));

    fireEvent.change(inputOf('maxLoginFailAttempts'), {
      target: { value: '5' },
    });
    fireEvent.change(inputOf('accessBlockTime'), { target: { value: '' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: SettingType.LoginConfiguration,
      config_value: {
        maxLoginFailAttempts: 5,
        accessBlockTime: undefined,
        jwtTokenExpiryTime: 3600,
      },
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'login-configuration',
      isEditing: false,
    });
  });

  it('rejects negative values', async () => {
    render(<LoginSettingsForm showHint={false} onNavigate={onNavigate} />);
    await waitFor(() => expect(inputOf('maxLoginFailAttempts')).toHaveValue(3));

    fireEvent.change(inputOf('maxLoginFailAttempts'), {
      target: { value: '-1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(
      await screen.findByText('label.greater-than-or-equal-to 0')
    ).toBeInTheDocument();
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });
});
