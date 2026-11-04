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
import { ROUTES } from '../../../constants/constants';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../../generated/system/settingsSourceResponse';
import {
  adoptDeploymentConfig,
  getSettingsConfigFromConfigType,
  getSettingsSource,
} from '../../../rest/settingConfigAPI';
import UrlConfigurationPage from './UrlConfigurationPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  getSettingsSource: jest.fn(),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }: { children: ReactNode }) => <div>{children}</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader">Loader</div>)
);

jest.mock('../../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn(() => []),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetSettingsConfigFromConfigType =
  getSettingsConfigFromConfigType as jest.Mock;
const mockGetSettingsSource = getSettingsSource as jest.Mock;
const mockAdoptDeploymentConfig = adoptDeploymentConfig as jest.Mock;

const envUrlSource = (managedPaths: string[]): SettingSource => ({
  configType: SettingType.OpenMetadataBaseURLConfiguration,
  source: ConfigSourceMode.Env,
  sourceVariable: 'SERVER_URL_CONFIG_SOURCE',
  editable: false,
  managedPaths,
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UrlConfigurationPage />
    </QueryClientProvider>
  );
};

describe('UrlConfigurationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsConfigFromConfigType.mockResolvedValue({
      data: { config_value: { openMetadataUrl: 'https://om.example.com' } },
    });
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
    mockAdoptDeploymentConfig.mockResolvedValue({});
  });

  it('should show the URL with an edit action when the deployment does not set it', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    expect(await screen.findByTestId('open-metadata-url')).toHaveTextContent(
      'https://om.example.com'
    );

    await user.click(await screen.findByTestId('edit-button'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.SETTINGS_OM_URL_CONFIG);
    expect(
      screen.queryByTestId('settings-source-banner')
    ).not.toBeInTheDocument();
  });

  it.each([['/openMetadataUrl'], ['/']])(
    'should hide the edit action when the deployment owns %s',
    async (managedPath) => {
      mockGetSettingsSource.mockResolvedValue({
        settings: [envUrlSource([managedPath])],
      });
      renderPage();

      expect(
        await screen.findByTestId('settings-source-env-alert')
      ).toHaveTextContent('message.settings-managed-by-deployment');
      expect(screen.getByTestId('open-metadata-url')).toHaveTextContent(
        'https://om.example.com'
      );
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    }
  );

  it('should reload the URL once the deployment value is adopted', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        {
          configType: SettingType.OpenMetadataBaseURLConfiguration,
          source: ConfigSourceMode.Auto,
          editable: true,
          overriddenFields: [
            {
              path: '/openMetadataUrl',
              envVariable: 'OPENMETADATA_SERVER_URL',
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
      SettingType.OpenMetadataBaseURLConfiguration,
      ['/openMetadataUrl']
    );
  });
});
