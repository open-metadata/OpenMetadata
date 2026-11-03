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
import { act, fireEvent, screen } from '@testing-library/react';
import { App } from '../../../../../../generated/entity/applications/app';
import {
  getMcpConfig,
  updateMcpConfig,
} from '../../../../../../rest/mcpConfigAPI';
import { getSettingsSource } from '../../../../../../rest/settingConfigAPI';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';
import AppConfigForm from './AppConfigForm';
import McpConfigForm from './McpConfigForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/mcpConfigAPI', () => ({
  getMcpConfig: jest.fn(),
  updateMcpConfig: jest.fn(),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsSource: jest.fn(),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('./AppConfigForm', () =>
  jest.fn(({ appData, onSave }) => (
    <button
      data-testid="app-config-form"
      onClick={() =>
        onSave({ formData: { allowedOrigins: ['https://app.example.com'] } })
      }>
      {JSON.stringify(appData.appConfiguration)}
    </button>
  ))
);

const storedConfig = {
  allowedOrigins: ['http://localhost:3000'],
  maxResponseChars: 100000,
  connectionTimeoutSecs: 30,
};

const renderForm = async () => {
  renderWithQueryClient(
    <McpConfigForm
      showHint
      appData={{ name: 'McpApplication' } as App}
      jsonSchema={{ type: 'object' }}
      onCancel={jest.fn()}
    />
  );
  await act(async () => undefined);
};

describe('McpConfigForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMcpConfig as jest.Mock).mockResolvedValue(storedConfig);
    (getSettingsSource as jest.Mock).mockResolvedValue({ settings: [] });
    (updateMcpConfig as jest.Mock).mockImplementation(
      async (payload) => payload
    );
  });

  it('renders the stored MCP settings in the shared app config form', async () => {
    await renderForm();

    expect(screen.getByTestId('app-config-form')).toHaveTextContent(
      JSON.stringify({
        allowedOrigins: ['http://localhost:3000'],
        maxResponseChars: 100000,
      })
    );
    expect(AppConfigForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ showHint: true, isReadOnly: false }),
      expect.anything()
    );
  });

  it('saves to the MCP setting and keeps fields the form does not show', async () => {
    await renderForm();

    await act(async () => {
      fireEvent.click(screen.getByTestId('app-config-form'));
    });

    expect(updateMcpConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedOrigins: ['https://app.example.com'],
        connectionTimeoutSecs: 30,
      })
    );
  });
});
