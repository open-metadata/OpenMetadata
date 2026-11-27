/*
 *  Copyright 2024 Collate.
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
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MASKED_PASSWORD_VALUE } from '../../constants/Secrets.constants';
import { SettingType } from '../../generated/settings/settings';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType as SourceSettingType,
} from '../../generated/system/settingsSourceResponse';
import EditEmailConfigPage from './EditEmailConfigPage.component';

const ERROR = 'ERROR';
const ENTITY_FETCH_ERROR = 'server.entity-fetch-error';
const ENTITY_UPDATING_ERROR = 'server.entity-updating-error';
const UPDATE_ENTITY_SUCCESS = 'server.update-entity-success';
const ACTIVE_FIELD = 'activeField';
const EMAIL_CONFIG = {
  password: MASKED_PASSWORD_VALUE,
  senderMail: 'before@example.com',
  serverEndpoint: 'smtp.example.com',
  serverPort: 587,
};

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn(({ activeField }) => (
    <>
      <p>{activeField}</p>
      <div>ServiceDocPanel</div>
    </>
  ))
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock(
  '../../components/Settings/Email/EmailConfigForm/EmailConfigForm.component',
  () =>
    jest
      .fn()
      .mockImplementation(
        ({ emailConfigValues, managedFields, onCancel, onFocus, onSubmit }) => (
          <>
            EmailConfigForm
            <span data-testid="managed-fields">
              {JSON.stringify(managedFields)}
            </span>
            <button onClick={onCancel}>Cancel EmailConfigForm</button>
            <button onClick={() => onFocus({ target: { id: ACTIVE_FIELD } })}>
              Focus EmailConfigForm
            </button>
            <button onClick={() => onSubmit(emailConfigValues)}>
              Submit EmailConfigForm
            </button>
          </>
        )
      )
);

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockGetSettingsConfigFromConfigType = jest.fn().mockResolvedValue({
  data: {
    config_value: EMAIL_CONFIG,
  },
});

const mockUpdateSettingsConfig = jest.fn().mockResolvedValue({});
const mockGetSettingsSource = jest.fn();
const mockAdoptDeploymentConfig = jest.fn();

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(() =>
    mockGetSettingsConfigFromConfigType()
  ),
  updateSettingsConfig: jest.fn((...args) => mockUpdateSettingsConfig(...args)),
  getSettingsSource: jest.fn(() => mockGetSettingsSource()),
  adoptDeploymentConfig: jest.fn((...args) =>
    mockAdoptDeploymentConfig(...args)
  ),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn(),
}));

const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation((...args) => mockShowErrorToast(...args)),
  showSuccessToast: jest
    .fn()
    .mockImplementation((...args) => mockShowSuccessToast(...args)),
}));

const mockProps = {
  pageTitle: 'edit-email-config',
};

const emailSource = (overrides: Partial<SettingSource>): SettingSource => ({
  configType: SourceSettingType.EmailConfiguration,
  source: ConfigSourceMode.Auto,
  sourceVariable: 'EMAIL_CONFIG_SOURCE',
  editable: true,
  ...overrides,
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EditEmailConfigPage {...mockProps} />
    </QueryClientProvider>
  );
};

describe('EditEmailConfigPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
    mockAdoptDeploymentConfig.mockResolvedValue({});
  });

  it('should contain all necessary elements', async () => {
    await act(async () => {
      renderPage();
    });

    expect(mockGetSettingsConfigFromConfigType).toHaveBeenCalled();

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(screen.getByText('EmailConfigForm')).toBeInTheDocument();
    expect(screen.getByText('ServiceDocPanel')).toBeInTheDocument();
  });

  it('actions check', async () => {
    await act(async () => {
      renderPage();
    });

    // Focus EmailConfigForm
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Focus EmailConfigForm',
        })
      );
    });

    expect(await screen.findByText(ACTIVE_FIELD)).toBeInTheDocument();

    // Cancel EmailConfigForm
    userEvent.click(
      screen.getByRole('button', {
        name: 'Cancel EmailConfigForm',
      })
    );

    // Submit EmailConfigForm
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Submit EmailConfigForm',
        })
      );
    });

    await waitFor(() => {
      expect(mockUpdateSettingsConfig).toHaveBeenCalled();
      expect(mockShowSuccessToast).toHaveBeenCalledWith(UPDATE_ENTITY_SUCCESS);
    });

    // called in cancel and submit both actions
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('errors check', async () => {
    mockGetSettingsConfigFromConfigType.mockRejectedValueOnce(ERROR);
    mockUpdateSettingsConfig.mockRejectedValueOnce(ERROR);

    renderPage();

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        ERROR,
        ENTITY_FETCH_ERROR
      );
    });

    // Submit EmailConfigForm

    userEvent.click(
      await screen.findByRole('button', {
        name: 'Submit EmailConfigForm',
      })
    );

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        ERROR,
        ENTITY_UPDATING_ERROR
      );
    });
  });

  it('does not submit the masked password sentinel', async () => {
    renderPage();

    await screen.findByText('EmailConfigForm');
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Submit EmailConfigForm',
        })
      );
    });

    await waitFor(() => expect(mockUpdateSettingsConfig).toHaveBeenCalled());
    const submittedSettings = mockUpdateSettingsConfig.mock.calls[0][0];

    expect(submittedSettings).toEqual({
      config_type: SettingType.EmailConfiguration,
      config_value: {
        senderMail: EMAIL_CONFIG.senderMail,
        serverEndpoint: EMAIL_CONFIG.serverEndpoint,
        serverPort: EMAIL_CONFIG.serverPort,
      },
    });
  });

  it('should leave every field editable when the deployment owns none', async () => {
    renderPage();

    expect(await screen.findByTestId('managed-fields')).toHaveTextContent('[]');
    expect(
      screen.queryByTestId('settings-source-banner')
    ).not.toBeInTheDocument();
  });

  it('should lock the fields the deployment configuration owns', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        emailSource({
          source: ConfigSourceMode.Env,
          editable: false,
          managedPaths: ['/senderMail', '/password', '/templates'],
        }),
      ],
    });
    renderPage();

    expect(
      await screen.findByTestId('settings-source-env-alert')
    ).toBeInTheDocument();
    expect(screen.getByTestId('managed-fields')).toHaveTextContent(
      '["password","senderMail"]'
    );
  });

  it('should reload the configuration once deployment values are adopted', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        emailSource({
          overriddenFields: [
            { path: '/serverPort', envVariable: 'SMTP_SERVER_PORT' },
          ],
        }),
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
      SourceSettingType.EmailConfiguration,
      ['/serverPort']
    );
  });
});
