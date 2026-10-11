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
import { MASKED_PASSWORD_VALUE } from '../../../../../../constants/Secrets.constants';
import {
  SMTPSettings,
  Templates,
  TransportationStrategy,
} from '../../../../../../generated/email/smtpSettings';
import { SettingType } from '../../../../../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import { showSuccessToast } from '../../../../../../utils/ToastUtils';
import EmailSettingsForm, {
  toEmailFormValues,
  toSmtpSettings,
} from './EmailSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const CONFIG: SMTPSettings = {
  serverEndpoint: 'smtp.gmail.com',
  serverPort: 587,
  transportationStrategy: TransportationStrategy.SMTPTLS,
  enableSmtpServer: true,
  senderMail: 'noreply@example.com',
  emailingEntity: 'OpenMetadata',
  username: 'smtp-user',
  password: MASKED_PASSWORD_VALUE,
  supportUrl: 'https://slack.open-metadata.org',
  templates: Templates.Openmetadata,
};

const onNavigate = jest.fn();

const renderForm = async () => {
  render(<EmailSettingsForm showHint={false} onNavigate={onNavigate} />);
  await screen.findByTestId('email-config-form');
};

const inputOf = (testId: string) =>
  screen.getByTestId(testId).querySelector('input') ??
  (screen.getByTestId(testId) as HTMLInputElement);

describe('toSmtpSettings', () => {
  it('drops the masked password placeholder so the stored secret is kept', () => {
    const settings = toSmtpSettings(toEmailFormValues(CONFIG), CONFIG);

    expect(settings).not.toHaveProperty('password');
  });

  it('keeps server-owned keys and converts the port to a number', () => {
    const settings = toSmtpSettings(
      { ...toEmailFormValues(CONFIG), serverPort: '465', password: 'secret' },
      CONFIG
    );

    expect(settings).toEqual(
      expect.objectContaining({
        templates: Templates.Openmetadata,
        serverPort: 465,
        password: 'secret',
        transportationStrategy: TransportationStrategy.SMTPTLS,
      })
    );
  });
});

describe('EmailSettingsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: { config_value: CONFIG },
    });
    (updateSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('prefills the form with the stored configuration', async () => {
    await renderForm();

    await waitFor(() =>
      expect(inputOf('server-endpoint-input')).toHaveValue('smtp.gmail.com')
    );

    expect(inputOf('sender-email-input')).toHaveValue('noreply@example.com');
    expect(inputOf('server-port-input')).toHaveValue(587);
  });

  it('saves the edited configuration and returns to the read-only view', async () => {
    await renderForm();
    await waitFor(() =>
      expect(inputOf('server-endpoint-input')).toHaveValue('smtp.gmail.com')
    );

    fireEvent.change(inputOf('server-endpoint-input'), {
      target: { value: 'smtp.example.com' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    await waitFor(() => expect(updateSettingsConfig).toHaveBeenCalled());

    const payload = (updateSettingsConfig as jest.Mock).mock.calls[0][0];

    expect(payload.config_type).toBe(SettingType.EmailConfiguration);
    expect(payload.config_value).toEqual(
      expect.objectContaining({
        serverEndpoint: 'smtp.example.com',
        serverPort: 587,
        templates: Templates.Openmetadata,
      })
    );
    expect(payload.config_value).not.toHaveProperty('password');
    expect(showSuccessToast).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'email',
      isEditing: false,
    });
  });

  it('blocks saving while a required field is empty', async () => {
    await renderForm();
    await waitFor(() =>
      expect(inputOf('sender-email-input')).toHaveValue('noreply@example.com')
    );

    fireEvent.change(inputOf('sender-email-input'), {
      target: { value: '' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('cancel goes back to the read-only view without saving', async () => {
    await renderForm();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'email',
      isEditing: false,
    });
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });
});
