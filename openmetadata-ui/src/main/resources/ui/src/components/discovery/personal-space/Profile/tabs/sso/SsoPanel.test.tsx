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
import { MemoryRouter } from 'react-router-dom';
import { SettingType } from '../../../../../../generated/system/settingsSourceResponse';
import {
  getSecurityConfiguration,
  patchSecurityConfiguration,
} from '../../../../../../rest/securityConfigAPI';
import { getSettingsSource } from '../../../../../../rest/settingConfigAPI';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import { deploymentOwnedSource } from '../platform-settings/PlatformSettings.mock';
import SsoPanel from './SsoPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSetHash = jest.fn();
let mockSubPath = '';

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'sso', subPath: mockSubPath, params: {} },
    setHash: mockSetHash,
  }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsSource: jest.fn().mockResolvedValue({ settings: [] }),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../../../../../rest/securityConfigAPI', () => ({
  getSecurityConfiguration: jest.fn(),
  patchSecurityConfiguration: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// The form owns its own save flow (see SsoConfigureForm.test); here it only has to be routed to.
jest.mock('./SsoConfigureForm', () =>
  jest.fn(
    ({
      selectedProvider,
      securityConfig,
      showHint,
      isReadOnly,
      managedPaths,
    }: {
      selectedProvider?: string;
      securityConfig?: { authenticationConfiguration: { provider: string } };
      showHint: boolean;
      isReadOnly?: boolean;
      managedPaths?: Record<string, string[]>;
    }) => (
      <div
        data-managed-paths={JSON.stringify(managedPaths)}
        data-provider={
          selectedProvider ??
          securityConfig?.authenticationConfiguration.provider
        }
        data-read-only={String(Boolean(isReadOnly))}
        data-show-hint={String(showHint)}
        data-testid="sso-configure-form"
      />
    )
  )
);

const OKTA_CONFIG = {
  authenticationConfiguration: { provider: 'okta', enableSelfSignup: true },
  authorizerConfiguration: {},
};

const onHeaderChange = jest.fn();
const lastHeader = (): ProfileHeaderOverride =>
  onHeaderChange.mock.calls[onHeaderChange.mock.calls.length - 1][0];

const renderHeaderActions = () => render(<>{lastHeader().actions}</>);

const renderPanel = async (config: unknown) => {
  (getSecurityConfiguration as jest.Mock).mockResolvedValue({ data: config });
  renderWithQueryClient(
    <MemoryRouter>
      <SsoPanel onHeaderChange={onHeaderChange} />
    </MemoryRouter>
  );
  await waitFor(() => expect(getSecurityConfiguration).toHaveBeenCalled());
  await screen.findByTestId('sso-panel');
};

describe('SsoPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubPath = '';
    (getSettingsSource as jest.Mock).mockResolvedValue({ settings: [] });
  });

  it('shows the provider grid when SSO is not set up, with no header action', async () => {
    await renderPanel({
      authenticationConfiguration: { provider: 'basic' },
      authorizerConfiguration: {},
    });

    expect(await screen.findByTestId('sso-provider-grid')).toBeInTheDocument();
    expect(lastHeader()).toMatchObject({
      title: 'label.single-sign-on',
      breadcrumbs: [
        { id: 'settings', label: 'label.setting-plural' },
        { id: 'sso', label: 'label.single-sign-on' },
      ],
    });

    expect(lastHeader().actions).toBeUndefined();
  });

  it('opens the setup form as soon as a provider card is clicked', async () => {
    await renderPanel(undefined);

    fireEvent.click(await screen.findByText('Google'));

    expect(mockSetHash).toHaveBeenCalledWith('sso', 'new/google');
  });

  it('renders the setup form with the provider in the header and a hint toggle', async () => {
    mockSubPath = 'new/azure';
    await renderPanel(undefined);

    expect(await screen.findByTestId('sso-configure-form')).toHaveAttribute(
      'data-provider',
      'azure'
    );
    expect(lastHeader().title).toBe('Azure AD');
    expect(lastHeader().breadcrumbs).toContainEqual({
      id: 'current',
      label: 'Azure AD',
    });

    renderHeaderActions();
    fireEvent.click(screen.getByRole('switch', { name: 'label.show-hint' }));

    await waitFor(() =>
      expect(screen.getAllByTestId('sso-configure-form')[0]).toHaveAttribute(
        'data-show-hint',
        'true'
      )
    );
  });

  it('opens a saved provider on its Overview tab and toggles self signup', async () => {
    (patchSecurityConfiguration as jest.Mock).mockResolvedValue({});
    await renderPanel(OKTA_CONFIG);

    const toggle = await screen.findByRole('switch', {
      name: 'label.enable-sso',
    });

    expect(toggle).toBeChecked();
    expect(lastHeader().title).toBe('Okta');

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(patchSecurityConfiguration).toHaveBeenCalledWith([
      {
        op: 'replace',
        path: '/authenticationConfiguration/enableSelfSignup',
        value: false,
      },
    ]);
    expect(toggle).not.toBeChecked();
  });

  it('restores self signup and reports the error when the PATCH fails', async () => {
    (patchSecurityConfiguration as jest.Mock).mockRejectedValue(
      new Error('nope')
    );
    await renderPanel(OKTA_CONFIG);
    const toggle = await screen.findByRole('switch', {
      name: 'label.enable-sso',
    });

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(toggle).toBeChecked();
  });

  it('edits the saved configuration on the Configure tab and offers Change provider', async () => {
    mockSubPath = 'configure';
    await renderPanel(OKTA_CONFIG);

    expect(await screen.findByTestId('sso-configure-form')).toHaveAttribute(
      'data-provider',
      'okta'
    );

    renderHeaderActions();
    fireEvent.click(screen.getByTestId('change-provider-button'));

    expect(mockSetHash).toHaveBeenCalledWith('sso', 'providers');
  });

  it('switches tabs through the hash', async () => {
    await renderPanel(OKTA_CONFIG);

    fireEvent.click(await screen.findByTestId('sso-tab-configure'));

    expect(mockSetHash).toHaveBeenCalledWith('sso', 'configure');
  });

  describe('when the deployment owns part of the configuration', () => {
    const ownAuthentication = (managedPaths: string[]) =>
      (getSettingsSource as jest.Mock).mockResolvedValue({
        settings: [
          deploymentOwnedSource(
            SettingType.AuthenticationConfiguration,
            managedPaths
          ),
        ],
      });

    it('locks the deployment-owned fields and offers no Change provider', async () => {
      ownAuthentication(['/provider', '/clientId']);
      mockSubPath = 'configure';
      await renderPanel(OKTA_CONFIG);

      expect(
        await screen.findByTestId('settings-source-env-alert')
      ).toBeInTheDocument();

      await waitFor(() =>
        expect(screen.getByTestId('sso-configure-form')).toHaveAttribute(
          'data-managed-paths',
          JSON.stringify({
            authenticationConfiguration: ['/provider', '/clientId'],
            authorizerConfiguration: [],
          })
        )
      );

      expect(screen.getByTestId('sso-configure-form')).toHaveAttribute(
        'data-read-only',
        'false'
      );

      renderHeaderActions();

      expect(
        screen.queryByTestId('change-provider-button')
      ).not.toBeInTheDocument();
    });

    it('offers no provider to pick when the deployment sets it', async () => {
      ownAuthentication(['/provider']);
      await renderPanel({
        authenticationConfiguration: { provider: 'basic' },
        authorizerConfiguration: {},
      });

      expect(
        await screen.findByTestId('sso-provider-set-by-deployment')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('sso-provider-grid')).not.toBeInTheDocument();

      renderHeaderActions();

      expect(
        screen.queryByTestId('sso-configure-provider')
      ).not.toBeInTheDocument();
    });

    it('locks self signup when the deployment sets it', async () => {
      ownAuthentication(['/enableSelfSignup']);
      await renderPanel(OKTA_CONFIG);
      await screen.findByTestId('settings-source-env-alert');

      expect(
        await screen.findByRole('switch', { name: 'label.enable-sso' })
      ).toBeDisabled();
    });

    it('shows the form read-only when the deployment owns both settings', async () => {
      (getSettingsSource as jest.Mock).mockResolvedValue({
        settings: [
          deploymentOwnedSource(SettingType.AuthenticationConfiguration, ['/']),
          deploymentOwnedSource(SettingType.AuthorizerConfiguration, ['/']),
        ],
      });
      mockSubPath = 'configure';
      await renderPanel(OKTA_CONFIG);

      await waitFor(() =>
        expect(screen.getByTestId('sso-configure-form')).toHaveAttribute(
          'data-read-only',
          'true'
        )
      );
    });
  });
});
