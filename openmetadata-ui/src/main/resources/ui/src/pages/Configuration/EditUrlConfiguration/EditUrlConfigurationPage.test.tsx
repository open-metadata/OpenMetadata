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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { SettingType as StoredSettingType } from '../../../generated/settings/settings';
import {
  ConfigSourceMode,
  SettingType,
} from '../../../generated/system/settingsSourceResponse';
import {
  getSettingsConfigFromConfigType,
  getSettingsSource,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import EditUrlConfigurationPage from './EditUrlConfigurationPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  updateSettingsConfig: jest.fn(),
  getSettingsSource: jest.fn(),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn((Component) => Component),
}));

jest.mock('../../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn(
    ({
      firstPanel,
      secondPanel,
    }: {
      firstPanel: { children: ReactNode };
      secondPanel: { children: ReactNode };
    }) => (
      <>
        <div>{firstPanel.children}</div>
        <div>{secondPanel.children}</div>
      </>
    )
  )
);

jest.mock('../../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn(() => <div>ServiceDocPanel</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader">Loader</div>)
);

jest.mock('../../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn(() => '/settings'),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetSettingsConfigFromConfigType =
  getSettingsConfigFromConfigType as jest.Mock;
const mockGetSettingsSource = getSettingsSource as jest.Mock;
const mockUpdateSettingsConfig = updateSettingsConfig as jest.Mock;

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EditUrlConfigurationPage pageTitle="edit-url-configuration" />
    </QueryClientProvider>
  );
};

describe('EditUrlConfigurationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsConfigFromConfigType.mockResolvedValue({
      data: { config_value: { openMetadataUrl: 'https://om.example.com' } },
    });
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
    mockUpdateSettingsConfig.mockResolvedValue({});
  });

  it('should save an edited URL', async () => {
    renderPage();

    const input = await screen.findByTestId('open-metadata-url-input');

    await waitFor(() => expect(input).toHaveValue('https://om.example.com'));

    fireEvent.change(input, { target: { value: 'https://new.example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    await waitFor(() => {
      expect(mockUpdateSettingsConfig).toHaveBeenCalledWith({
        config_type: StoredSettingType.OpenMetadataBaseURLConfiguration,
        config_value: { openMetadataUrl: 'https://new.example.com' },
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should show the URL read-only when the deployment owns it', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        {
          configType: SettingType.OpenMetadataBaseURLConfiguration,
          source: ConfigSourceMode.Env,
          sourceVariable: 'SERVER_URL_CONFIG_SOURCE',
          editable: false,
          managedPaths: ['/openMetadataUrl'],
        },
      ],
    });
    renderPage();

    expect(
      await screen.findByTestId('settings-source-env-alert')
    ).toBeInTheDocument();
    expect(screen.getByTestId('open-metadata-url-input')).toBeDisabled();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
  });

  it('should show the server message when the server refuses the change', async () => {
    const conflict = {
      response: {
        status: 409,
        data: {
          message:
            'openMetadataBaseUrlConfiguration is managed by SERVER_URL_CONFIG_SOURCE',
        },
      },
    };
    mockUpdateSettingsConfig.mockRejectedValue(conflict);
    renderPage();

    const input = await screen.findByTestId('open-metadata-url-input');
    await waitFor(() => expect(input).toHaveValue('https://om.example.com'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(conflict);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
