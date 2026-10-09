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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../../../generated/system/settingsSourceResponse';
import { adoptDeploymentConfig } from '../../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import SettingsSourceBanner from './SettingsSourceBanner';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../../rest/settingConfigAPI', () => ({
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockAdoptDeploymentConfig = adoptDeploymentConfig as jest.Mock;
const mockOnRefetch = jest.fn();
const mockOnAdopted = jest.fn();

const ENV_AUTHENTICATION: SettingSource = {
  configType: SettingType.AuthenticationConfiguration,
  source: ConfigSourceMode.Env,
  sourceVariable: 'SECURITY_CONFIG_SOURCE',
  editable: false,
  managedPaths: ['/provider', '/clientId'],
};

const ENV_AUTHORIZER: SettingSource = {
  ...ENV_AUTHENTICATION,
  configType: SettingType.AuthorizerConfiguration,
  managedPaths: ['/adminEmails'],
};

const OVERRIDDEN_EMAIL: SettingSource = {
  configType: SettingType.EmailConfiguration,
  source: ConfigSourceMode.Auto,
  sourceVariable: 'EMAIL_CONFIG_SOURCE',
  editable: true,
  overriddenFields: [
    { path: '/serverPort', envVariable: 'SMTP_SERVER_PORT' },
    { path: '/supportUrl' },
  ],
};

const OVERRIDDEN_URL: SettingSource = {
  configType: SettingType.OpenMetadataBaseURLConfiguration,
  source: ConfigSourceMode.DB,
  editable: true,
  overriddenFields: [
    { path: '/openMetadataUrl', envVariable: 'OPENMETADATA_SERVER_URL' },
  ],
};

const renderBanner = (sources: SettingSource[]) =>
  render(
    <SettingsSourceBanner
      sources={sources}
      onAdopted={mockOnAdopted}
      onRefetch={mockOnRefetch}
    />
  );

// Jest runs with fake timers globally; user-event has to advance them between its steps.
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const openConfirmation = async () => {
  await user.click(screen.getByTestId('use-deployment-value-button'));

  return screen.findByRole('dialog');
};

describe('SettingsSourceBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnRefetch.mockResolvedValue(undefined);
    mockAdoptDeploymentConfig.mockResolvedValue({});
  });

  it('should render nothing when the stored values are used and match the deployment', () => {
    const { container } = renderBanner([
      { ...OVERRIDDEN_EMAIL, overriddenFields: [] },
      {
        configType: SettingType.MCPConfiguration,
        source: ConfigSourceMode.DB,
        editable: true,
      },
    ]);

    expect(container).toBeEmptyDOMElement();
  });

  it('should explain an ENV-managed setting once per variable, without an adopt action', () => {
    renderBanner([ENV_AUTHENTICATION, ENV_AUTHORIZER]);

    const alerts = screen.getAllByTestId('settings-source-env-alert');

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(
      'label.managed-by-deployment-configuration'
    );
    expect(alerts[0]).toHaveTextContent(
      'message.settings-managed-by-deployment {"variable":"SECURITY_CONFIG_SOURCE"}'
    );
    expect(
      screen.queryByTestId('use-deployment-value-button')
    ).not.toBeInTheDocument();
  });

  it('should explain an ENV-managed setting whose selecting variable is unknown', () => {
    renderBanner([{ ...ENV_AUTHENTICATION, sourceVariable: undefined }]);

    expect(screen.getByTestId('settings-source-env-alert')).toHaveTextContent(
      'message.settings-managed-by-deployment-without-variable'
    );
  });

  it('should ignore overridden fields reported for an ENV-managed setting', () => {
    renderBanner([
      { ...ENV_AUTHENTICATION, overriddenFields: [{ path: '/provider' }] },
    ]);

    expect(
      screen.queryByTestId('settings-source-overridden-alert')
    ).not.toBeInTheDocument();
  });

  it('should list each overridden field with the variable that sets it', () => {
    renderBanner([OVERRIDDEN_EMAIL]);

    const alert = screen.getByTestId('settings-source-overridden-alert');
    const items = within(alert).getAllByRole('listitem');

    expect(alert).toHaveTextContent('label.deployment-values-overridden');
    expect(alert).toHaveTextContent(
      'message.settings-deployment-values-overridden'
    );
    expect(items.map((item) => item.textContent)).toEqual([
      'message.overridden-field-env-variable {"field":"/serverPort","variable":"SMTP_SERVER_PORT"}',
      '/supportUrl',
    ]);
    expect(
      within(alert).getByTestId('use-deployment-value-button')
    ).toHaveTextContent('label.use-deployment-value');
  });

  it('should adopt the listed fields only after confirmation, then refetch and notify the page', async () => {
    renderBanner([OVERRIDDEN_EMAIL]);

    const dialog = await openConfirmation();

    expect(dialog).toHaveTextContent(
      'message.use-deployment-value-confirmation'
    );
    expect(mockAdoptDeploymentConfig).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole('button', {
        name: 'label.use-deployment-value',
      })
    );

    await waitFor(() => expect(mockOnAdopted).toHaveBeenCalledTimes(1));

    expect(mockAdoptDeploymentConfig).toHaveBeenCalledWith(
      SettingType.EmailConfiguration,
      ['/serverPort', '/supportUrl']
    );
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.deployment-values-adopted'
    );
    expect(mockOnRefetch).toHaveBeenCalledTimes(1);
    expect(mockOnRefetch.mock.invocationCallOrder[0]).toBeLessThan(
      mockOnAdopted.mock.invocationCallOrder[0]
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('should adopt each setting with its own fields', async () => {
    renderBanner([OVERRIDDEN_EMAIL, OVERRIDDEN_URL]);

    const dialog = await openConfirmation();
    await user.click(
      within(dialog).getByRole('button', {
        name: 'label.use-deployment-value',
      })
    );

    await waitFor(() => expect(mockOnAdopted).toHaveBeenCalled());

    expect(mockAdoptDeploymentConfig).toHaveBeenCalledTimes(2);
    expect(mockAdoptDeploymentConfig).toHaveBeenCalledWith(
      SettingType.OpenMetadataBaseURLConfiguration,
      ['/openMetadataUrl']
    );
  });

  it('should not adopt anything when the confirmation is cancelled', async () => {
    renderBanner([OVERRIDDEN_EMAIL]);

    const dialog = await openConfirmation();
    await user.click(
      within(dialog).getByRole('button', { name: 'label.cancel' })
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );

    expect(mockAdoptDeploymentConfig).not.toHaveBeenCalled();
    expect(mockOnAdopted).not.toHaveBeenCalled();
  });

  it('should show the server error and still refresh the status when adopting fails', async () => {
    const conflict = {
      response: {
        status: 409,
        data: {
          message: 'emailConfiguration is managed by EMAIL_CONFIG_SOURCE',
        },
      },
    };
    mockAdoptDeploymentConfig.mockRejectedValue(conflict);
    renderBanner([OVERRIDDEN_EMAIL]);

    const dialog = await openConfirmation();
    await user.click(
      within(dialog).getByRole('button', {
        name: 'label.use-deployment-value',
      })
    );

    await waitFor(() => expect(mockOnRefetch).toHaveBeenCalledTimes(1));

    expect(showErrorToast).toHaveBeenCalledWith(conflict);
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(mockOnAdopted).not.toHaveBeenCalled();
  });

  it('should reload the page when one setting is adopted and another fails', async () => {
    const conflict = {
      response: { status: 409, data: { message: 'email is ENV-managed' } },
    };
    mockAdoptDeploymentConfig.mockImplementation((configType: SettingType) =>
      configType === SettingType.EmailConfiguration
        ? Promise.reject(conflict)
        : Promise.resolve()
    );
    renderBanner([OVERRIDDEN_EMAIL, OVERRIDDEN_URL]);

    const dialog = await openConfirmation();
    await user.click(
      within(dialog).getByRole('button', {
        name: 'label.use-deployment-value',
      })
    );

    await waitFor(() => expect(mockOnAdopted).toHaveBeenCalledTimes(1));

    expect(mockAdoptDeploymentConfig).toHaveBeenCalledTimes(2);
    expect(showErrorToast).toHaveBeenCalledWith(conflict);
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(mockOnRefetch).toHaveBeenCalledTimes(1);
  });

  it('should report a setting this server could not apply', () => {
    renderBanner([
      {
        ...OVERRIDDEN_EMAIL,
        overriddenFields: [],
        lastReloadError: 'SMTP host unreachable',
      },
    ]);

    const alert = screen.getByTestId('settings-source-reload-error-alert');

    expect(alert).toHaveTextContent('label.settings-not-applied');
    expect(alert).toHaveTextContent(
      'message.settings-reload-error {"error":"SMTP host unreachable"}'
    );
  });
});
