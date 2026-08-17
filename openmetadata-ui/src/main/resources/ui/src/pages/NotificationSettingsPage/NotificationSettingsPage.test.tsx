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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import NotificationSettingsPage from './NotificationSettingsPage';

const mockNavigate = jest.fn();

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loading...</div>)
);
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockReturnValue(<div>TitleBreadcrumb.component</div>)
);
jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockReturnValue(<div>PageHeader.component</div>)
);
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));
jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn().mockResolvedValue({
    data: {
      config_type: 'notificationSettings',
      config_value: { enableQueryChangeEvents: false },
    },
  }),
  updateSettingsConfig: jest.fn().mockResolvedValue({ data: {} }),
}));
jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetSettingsConfigFromConfigType =
  getSettingsConfigFromConfigType as jest.Mock;
const mockUpdateSettingsConfig = updateSettingsConfig as jest.Mock;

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsConfigFromConfigType.mockResolvedValue({
      data: {
        config_type: 'notificationSettings',
        config_value: { enableQueryChangeEvents: false },
      },
    });
    mockUpdateSettingsConfig.mockResolvedValue({ data: {} });
  });

  it('should render the notification settings form', async () => {
    render(<NotificationSettingsPage />);

    expect(
      await screen.findByTestId('notification-settings-form')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('label.query-change-event-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('enable-query-change-events-switch')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('save-button')).toBeInTheDocument();
  });

  it('should fetch the notification settings on initial render', async () => {
    render(<NotificationSettingsPage />);

    await screen.findByTestId('notification-settings-form');

    expect(mockGetSettingsConfigFromConfigType).toHaveBeenCalledWith(
      SettingType.NotificationSettings
    );
  });

  it('should show the stored value of enableQueryChangeEvents', async () => {
    mockGetSettingsConfigFromConfigType.mockResolvedValueOnce({
      data: {
        config_type: 'notificationSettings',
        config_value: { enableQueryChangeEvents: true },
      },
    });

    render(<NotificationSettingsPage />);

    expect(
      await screen.findByTestId('enable-query-change-events-switch')
    ).toBeChecked();
  });

  it('should save the updated value of enableQueryChangeEvents', async () => {
    render(<NotificationSettingsPage />);

    const toggle = await screen.findByTestId(
      'enable-query-change-events-switch'
    );

    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    fireEvent.click(await screen.findByTestId('save-button'));

    await waitFor(() =>
      expect(mockUpdateSettingsConfig).toHaveBeenCalledWith({
        config_type: SettingType.NotificationSettings,
        config_value: { enableQueryChangeEvents: true },
      })
    );
  });
});
