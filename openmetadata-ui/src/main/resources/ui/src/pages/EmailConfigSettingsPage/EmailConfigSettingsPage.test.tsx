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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { ROUTES } from '../../constants/constants';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../generated/system/settingsSourceResponse';
import {
  adoptDeploymentConfig,
  getSettingsConfigFromConfigType,
  getSettingsSource,
} from '../../rest/settingConfigAPI';
import EmailConfigSettingsPage from './EmailConfigSettingsPage.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  getSettingsSource: jest.fn(),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => ({ isAdminUser: true })),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }: { children: ReactNode }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../components/Settings/Email/TestEmail/TestEmail.component', () =>
  jest.fn(() => <div>TestEmail</div>)
);

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn(() => []),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetSettingsConfigFromConfigType =
  getSettingsConfigFromConfigType as jest.Mock;
const mockGetSettingsSource = getSettingsSource as jest.Mock;
const mockAdoptDeploymentConfig = adoptDeploymentConfig as jest.Mock;

const EMAIL_CONFIG = {
  emailingEntity: 'OpenMetadata',
  enableSmtpServer: true,
  senderMail: 'sender@example.com',
  serverEndpoint: 'smtp.example.com',
  serverPort: 587,
  username: 'mailer',
};

// Every field conf/operations.yaml defines for email, as the server reports them in ENV mode.
const DEPLOYMENT_EMAIL_FIELDS = [
  '/emailingEntity',
  '/supportUrl',
  '/enableSmtpServer',
  '/senderMail',
  '/serverEndpoint',
  '/serverPort',
  '/username',
  '/password',
  '/transportationStrategy',
  '/templates',
];

const envEmailSource = (managedPaths: string[]): SettingSource => ({
  configType: SettingType.EmailConfiguration,
  source: ConfigSourceMode.Env,
  sourceVariable: 'EMAIL_CONFIG_SOURCE',
  editable: false,
  managedPaths,
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EmailConfigSettingsPage />
    </QueryClientProvider>
  );
};

describe('EmailConfigSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsConfigFromConfigType.mockResolvedValue({
      data: { config_value: EMAIL_CONFIG },
    });
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
    mockAdoptDeploymentConfig.mockResolvedValue({});
  });

  it('should show the stored values with an edit action when the deployment owns no field', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    const editButton = await screen.findByTestId('edit-email-configuration');

    expect(screen.getByText('sender@example.com')).toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-source-banner')
    ).not.toBeInTheDocument();

    await user.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      ROUTES.SETTINGS_EDIT_EMAIL_CONFIG
    );
  });

  it.each([
    ['every field it shows', DEPLOYMENT_EMAIL_FIELDS],
    ['the whole setting', ['/']],
  ])(
    'should hide the edit action when the deployment owns %s',
    async (_, managedPaths) => {
      mockGetSettingsSource.mockResolvedValue({
        settings: [envEmailSource(managedPaths)],
      });
      renderPage();

      expect(
        await screen.findByTestId('settings-source-env-alert')
      ).toHaveTextContent('message.settings-managed-by-deployment');
      expect(screen.getByText('sender@example.com')).toBeInTheDocument();
      expect(
        screen.queryByTestId('edit-email-configuration')
      ).not.toBeInTheDocument();
    }
  );

  it('should keep the edit action when the deployment owns only some fields', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [envEmailSource(['/senderMail'])],
    });
    renderPage();

    await screen.findByTestId('settings-source-env-alert');

    expect(
      await screen.findByTestId('edit-email-configuration')
    ).toBeInTheDocument();
  });

  it('should reload the values once deployment values are adopted', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        {
          configType: SettingType.EmailConfiguration,
          source: ConfigSourceMode.Auto,
          editable: true,
          overriddenFields: [
            {
              path: '/senderMail',
              envVariable: 'OPENMETADATA_SMTP_SENDER_MAIL',
            },
          ],
        },
      ],
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    await user.click(await screen.findByTestId('use-deployment-value-button'));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'label.use-deployment-value',
      })
    );

    await waitFor(() => {
      expect(mockGetSettingsConfigFromConfigType).toHaveBeenCalledTimes(2);
    });

    expect(mockAdoptDeploymentConfig).toHaveBeenCalledWith(
      SettingType.EmailConfiguration,
      ['/senderMail']
    );
  });
});
