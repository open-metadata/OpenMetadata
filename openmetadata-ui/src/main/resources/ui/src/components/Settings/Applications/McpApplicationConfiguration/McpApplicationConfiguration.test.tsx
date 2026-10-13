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

import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { pick } from 'lodash';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../../../generated/system/settingsSourceResponse';
import { getMcpConfig, updateMcpConfig } from '../../../../rest/mcpConfigAPI';
import {
  adoptDeploymentConfig,
  getSettingsSource,
} from '../../../../rest/settingConfigAPI';
import mcpSchema from '../../../../utils/ApplicationSchemas/McpApplication.json';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import McpApplicationConfiguration from './McpApplicationConfiguration';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../rest/mcpConfigAPI', () => ({
  getMcpConfig: jest.fn(),
  updateMcpConfig: jest.fn(),
}));

jest.mock('../../../../rest/settingConfigAPI', () => ({
  getSettingsSource: jest.fn(),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div data-testid="loader" />);
});

jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="service-doc-panel" />);
});

jest.mock('../../../common/ResizablePanels/ResizablePanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div data-testid="resizable-panels">
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ));
});

jest.mock('../../../common/FormBuilder/FormBuilder', () => {
  return jest
    .fn()
    .mockImplementation(
      ({ formData, onSubmit, uiSchema, disabled, readonly }) => (
        <div
          data-disabled={String(Boolean(disabled))}
          data-readonly={String(Boolean(readonly))}
          data-testid="form-builder">
          <span data-testid="form-data">{JSON.stringify(formData)}</span>
          <span data-testid="ui-schema">{JSON.stringify(uiSchema)}</span>
          <button
            data-testid="submit"
            onClick={() =>
              onSubmit({
                formData: { allowedOrigins: ['https://app.example.com'] },
              })
            }>
            submit
          </button>
        </div>
      )
    );
});

const mockJsonSchema = {
  type: 'object',
  properties: {
    allowedOrigins: { type: 'array', items: { type: 'string' } },
  },
} as RJSFSchema;

const mockGetMcpConfig = getMcpConfig as jest.Mock;
const mockUpdateMcpConfig = updateMcpConfig as jest.Mock;
const mockGetSettingsSource = getSettingsSource as jest.Mock;
const mockAdoptDeploymentConfig = adoptDeploymentConfig as jest.Mock;

const mcpSource = (overrides: Partial<SettingSource>): SettingSource => ({
  configType: SettingType.MCPConfiguration,
  source: ConfigSourceMode.Env,
  sourceVariable: 'MCP_CONFIG_SOURCE',
  editable: false,
  ...overrides,
});

const notFoundError = {
  response: { status: 404 },
} as AxiosError;

const renderComponent = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <McpApplicationConfiguration
          appName="McpApplication"
          jsonSchema={mockJsonSchema}
        />
      </QueryClientProvider>
    );
  });
};

describe('McpApplicationConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMcpConfig.mockResolvedValue({
      allowedOrigins: ['http://localhost:8585'],
      maxResponseChars: 50000,
      connectTimeout: 30000,
      path: '/api/v1/mcp',
      enabled: true,
      mcpServerName: 'openmetadata-mcp-server',
    });
    mockUpdateMcpConfig.mockResolvedValue({
      allowedOrigins: ['https://app.example.com'],
      path: '/api/v1/mcp',
      enabled: true,
      mcpServerName: 'openmetadata-mcp-server',
    });
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
    mockAdoptDeploymentConfig.mockResolvedValue({});
  });

  it('should seed the form with only the editable fields of the stored mcpConfiguration', async () => {
    await renderComponent();

    expect(mockGetMcpConfig).toHaveBeenCalledTimes(1);
    // connectTimeout/path/enabled/mcpServerName are stored but not editable, and the schema sets
    // additionalProperties:false, so passing them to the form would fail validation.
    expect(screen.getByTestId('form-data')).toHaveTextContent(
      '{"allowedOrigins":["http://localhost:8585"],"maxResponseChars":50000}'
    );
  });

  it('should treat a 404 as an unconfigured setting and not raise an error', async () => {
    mockGetMcpConfig.mockRejectedValue(notFoundError);

    await renderComponent();

    expect(showErrorToast).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-data')).toHaveTextContent('{}');
  });

  it('should surface a non-404 fetch failure', async () => {
    const serverError = { response: { status: 500 } } as AxiosError;
    mockGetMcpConfig.mockRejectedValue(serverError);

    await renderComponent();

    expect(showErrorToast).toHaveBeenCalledWith(serverError);
  });

  it('should merge the edits over the stored config so non editable fields survive the save', async () => {
    await renderComponent();

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    // A PUT replaces the whole setting, so connectTimeout/path/enabled/mcpServerName must be
    // sent back untouched alongside the edited allowedOrigins.
    expect(mockUpdateMcpConfig).toHaveBeenCalledWith({
      allowedOrigins: ['https://app.example.com'],
      maxResponseChars: 50000,
      connectTimeout: 30000,
      path: '/api/v1/mcp',
      enabled: true,
      mcpServerName: 'openmetadata-mcp-server',
    });
    expect(showSuccessToast).toHaveBeenCalled();
    expect(screen.getByTestId('form-data')).toHaveTextContent(
      '{"allowedOrigins":["https://app.example.com"]}'
    );
  });

  it('should surface a failure to persist the config', async () => {
    const serverError = { response: { status: 400 } } as AxiosError;
    mockUpdateMcpConfig.mockRejectedValue(serverError);

    await renderComponent();

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(showErrorToast).toHaveBeenCalledWith(serverError);
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it('should keep the form editable when the deployment owns no field', async () => {
    await renderComponent();

    expect(screen.getByTestId('form-builder')).toHaveAttribute(
      'data-readonly',
      'false'
    );
    expect(
      screen.queryByTestId('settings-source-banner')
    ).not.toBeInTheDocument();
  });

  it('should disable only the fields the deployment owns', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [mcpSource({ managedPaths: ['/allowedOrigins', '/path'] })],
    });
    await renderComponent();

    await screen.findByTestId('settings-source-env-alert');
    const uiSchema = JSON.parse(
      screen.getByTestId('ui-schema').textContent ?? '{}'
    );

    expect(uiSchema.allowedOrigins).toEqual({ 'ui:disabled': true });
    expect(uiSchema.baseUrl).toBeUndefined();
    expect(screen.getByTestId('form-builder')).toHaveAttribute(
      'data-readonly',
      'false'
    );
  });

  it.each([
    [
      'every field the form shows',
      ['/baseUrl', '/allowedOrigins', '/maxResponseChars'],
    ],
    ['the whole setting', ['/']],
  ])(
    'should offer no save when the deployment owns %s',
    async (_, managedPaths) => {
      mockGetSettingsSource.mockResolvedValue({
        settings: [mcpSource({ managedPaths })],
      });
      await renderComponent();

      await screen.findByTestId('settings-source-env-alert');

      await waitFor(() => {
        expect(screen.getByTestId('form-builder')).toHaveAttribute(
          'data-readonly',
          'true'
        );
      });

      expect(screen.getByTestId('form-builder')).toHaveAttribute(
        'data-disabled',
        'true'
      );
    }
  );

  it('should reload the stored configuration once deployment values are adopted', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        mcpSource({
          source: ConfigSourceMode.Auto,
          editable: true,
          overriddenFields: [{ path: '/allowedOrigins' }],
        }),
      ],
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderComponent();

    await user.click(await screen.findByTestId('use-deployment-value-button'));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'label.use-deployment-value',
      })
    );

    await waitFor(() => {
      expect(mockGetMcpConfig).toHaveBeenCalledTimes(2);
    });

    expect(mockAdoptDeploymentConfig).toHaveBeenCalledWith(
      SettingType.MCPConfiguration,
      ['/allowedOrigins']
    );
  });
});

describe('McpApplication form schema', () => {
  const formSchema = mcpSchema as RJSFSchema;
  const editableFields = ['baseUrl', 'allowedOrigins', 'maxResponseChars'];
  // Shape of a real stored mcpConfiguration row, including the fields no code reads.
  const storedConfig = {
    path: '/api/v1/mcp',
    baseUrl: 'http://localhost:8585',
    enabled: true,
    readTimeout: 30000,
    mcpServerName: 'openmetadata-mcp-server',
    allowedOrigins: ['http://localhost:3000', 'https://app.example.com'],
    maxResponseChars: 100000,
    connectTimeout: 30000,
    originHeaderUri: 'http://localhost',
    mcpServerVersion: '1.0.0',
    originValidationEnabled: false,
  };
  const editableSubset = pick(storedConfig, editableFields);

  it('should accept the editable subset of a stored config', () => {
    expect(
      validator.validateFormData(editableSubset, formSchema).errors
    ).toEqual([]);
  });

  it('should reject the full stored config, since additionalProperties is false', () => {
    expect(
      validator.validateFormData(storedConfig, formSchema).errors.length
    ).toBeGreaterThan(0);
  });

  it('should reject an empty allowedOrigins list, which would deny every origin', () => {
    expect(
      validator.validateFormData(
        { ...editableSubset, allowedOrigins: [] },
        formSchema
      ).errors.length
    ).toBeGreaterThan(0);
  });

  it('should reject a response cap under the 25,000 character minimum', () => {
    expect(
      validator.validateFormData(
        { ...editableSubset, maxResponseChars: 20000 },
        formSchema
      ).errors.length
    ).toBeGreaterThan(0);
  });

  it('should reject a stored timeout field, which is not editable from this form', () => {
    expect(
      validator.validateFormData(
        { ...editableSubset, connectTimeout: 30000 },
        formSchema
      ).errors.length
    ).toBeGreaterThan(0);
  });
});
