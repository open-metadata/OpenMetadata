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
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { ReactNode } from 'react';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../../../generated/system/settingsSourceResponse';
import { getMcpConfig, updateMcpConfig } from '../../../../rest/mcpConfigAPI';
import { getSettingsSource } from '../../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useMcpConfiguration } from './useMcpConfiguration';

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

const mockGetMcpConfig = getMcpConfig as jest.Mock;
const mockUpdateMcpConfig = updateMcpConfig as jest.Mock;
const mockGetSettingsSource = getSettingsSource as jest.Mock;

const storedConfig = {
  baseUrl: 'https://om.example.com',
  allowedOrigins: ['http://localhost:3000'],
  maxResponseChars: 100000,
  connectionTimeoutSecs: 30,
};

const mcpSource = (managedPaths: string[]): SettingSource => ({
  configType: SettingType.MCPConfiguration,
  source: ConfigSourceMode.Env,
  editable: false,
  managedPaths,
});

const renderUseMcpConfiguration = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useMcpConfiguration(), { wrapper });
};

describe('useMcpConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMcpConfig.mockResolvedValue(storedConfig);
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
    mockUpdateMcpConfig.mockImplementation(async (payload) => payload);
  });

  it('loads the setting and exposes only the fields the form edits', async () => {
    const { result } = renderUseMcpConfiguration();

    expect(result.current.isFetching).toBe(true);

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.formConfig).toEqual({
      baseUrl: 'https://om.example.com',
      allowedOrigins: ['http://localhost:3000'],
      maxResponseChars: 100000,
    });
    expect(result.current.isEveryFieldManaged).toBe(false);
  });

  it('starts from an empty form when the setting was never written', async () => {
    mockGetMcpConfig.mockRejectedValue({
      response: { status: 404 },
    } as AxiosError);

    const { result } = renderUseMcpConfiguration();

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.formConfig).toEqual({});
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('reports any other load failure', async () => {
    const error = { response: { status: 500 } } as AxiosError;
    mockGetMcpConfig.mockRejectedValue(error);

    const { result } = renderUseMcpConfiguration();

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(showErrorToast).toHaveBeenCalledWith(error);
  });

  it('saves the edited fields on top of the stored ones the form does not show', async () => {
    const { result } = renderUseMcpConfiguration();
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    await act(async () => {
      await result.current.saveMcpConfig({
        ...result.current.formConfig,
        allowedOrigins: ['https://app.example.com'],
      });
    });

    expect(mockUpdateMcpConfig).toHaveBeenCalledWith({
      ...storedConfig,
      allowedOrigins: ['https://app.example.com'],
    });
    expect(result.current.formConfig.allowedOrigins).toEqual([
      'https://app.example.com',
    ]);
    expect(result.current.isSaving).toBe(false);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.entity-saved-successfully'
    );
  });

  it('keeps the form values and reports the error when a save fails', async () => {
    const error = { response: { status: 400 } } as AxiosError;
    mockUpdateMcpConfig.mockRejectedValue(error);
    const { result } = renderUseMcpConfiguration();
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    await act(async () => {
      await result.current.saveMcpConfig({ allowedOrigins: [] });
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(result.current.formConfig.allowedOrigins).toEqual([
      'http://localhost:3000',
    ]);
    expect(result.current.isSaving).toBe(false);
  });

  it('disables fields the deployment manages', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [mcpSource(['/allowedOrigins'])],
    });

    const { result } = renderUseMcpConfiguration();

    await waitFor(() =>
      expect(result.current.formUiSchema.allowedOrigins).toEqual(
        expect.objectContaining({ 'ui:disabled': true })
      )
    );

    expect(result.current.formUiSchema.baseUrl?.['ui:disabled']).toBeFalsy();
    expect(result.current.isEveryFieldManaged).toBe(false);
  });

  it('marks the whole form managed when the deployment owns every field', async () => {
    mockGetSettingsSource.mockResolvedValue({
      settings: [
        mcpSource(['/baseUrl', '/allowedOrigins', '/maxResponseChars']),
      ],
    });

    const { result } = renderUseMcpConfiguration();

    await waitFor(() => expect(result.current.isEveryFieldManaged).toBe(true));
  });
});
