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
import { ReactNode } from 'react';
import { TransportationStrategy } from '../../../../../../generated/email/smtpSettings';
import { getSettingsConfigFromConfigType } from '../../../../../../rest/settingConfigAPI';
import EmailSettings from './EmailSettings';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  testEmailConnection: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = jest.fn((actions: ReactNode) => {
  headerActions = actions;
});

const renderView = async () => {
  render(
    <EmailSettings
      onNavigate={onNavigate}
      onSetHeaderActions={onSetHeaderActions}
    />
  );
  await act(async () => undefined);
};

describe('EmailSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    headerActions = undefined;
  });

  it('shows every stored SMTP field, with "Not set" for empty ones', async () => {
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: {
        config_value: {
          serverEndpoint: 'smtp.gmail.com',
          serverPort: 587,
          transportationStrategy: TransportationStrategy.SMTPTLS,
          senderMail: 'noreply@example.com',
          enableSmtpServer: true,
        },
      },
    });
    await renderView();

    expect(screen.getByTestId('server-endpoint-value')).toHaveTextContent(
      'smtp.gmail.com'
    );
    expect(screen.getByTestId('server-port-value')).toHaveTextContent('587');
    expect(
      screen.getByTestId('transportation-strategy-value')
    ).toHaveTextContent('SMTP_TLS');
    expect(screen.getByTestId('username-value')).toHaveTextContent(
      'label.not-set'
    );
  });

  it('offers Test Email and Edit once a sender is configured', async () => {
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: { config_value: { senderMail: 'noreply@example.com' } },
    });
    await renderView();
    render(<>{headerActions}</>);

    fireEvent.click(screen.getByTestId('test-email-button'));

    expect(await screen.findByTestId('test-email-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('edit-button'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'email',
      isEditing: true,
    });
  });

  it('shows an empty state and an Add action when nothing is configured', async () => {
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: {},
    });
    await renderView();
    render(<>{headerActions}</>);

    expect(screen.getByTestId('email-config-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('test-email-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-button')).toHaveTextContent('label.add');
  });
});
