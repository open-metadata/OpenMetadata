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
import { ReactNode } from 'react';
import { SettingType } from '../../generated/settings/settings';
import {
  ConfigSourceMode,
  SettingsSourceResponse,
  SettingType as SourceSettingType,
} from '../../generated/system/settingsSourceResponse';
import { getSettingsSource } from '../../rest/settingConfigAPI';
import { useSettingsSource } from './useSettingsSource';

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsSource: jest.fn(),
}));

const mockGetSettingsSource = getSettingsSource as jest.Mock;

const RESPONSE: SettingsSourceResponse = {
  settings: [
    {
      configType: SourceSettingType.AuthenticationConfiguration,
      source: ConfigSourceMode.Env,
      sourceVariable: 'SECURITY_CONFIG_SOURCE',
      editable: false,
      managedPaths: ['/provider'],
    },
    {
      configType: SourceSettingType.AuthorizerConfiguration,
      source: ConfigSourceMode.Env,
      sourceVariable: 'SECURITY_CONFIG_SOURCE',
      editable: false,
      managedPaths: ['/adminEmails'],
    },
    {
      configType: SourceSettingType.EmailConfiguration,
      source: ConfigSourceMode.Auto,
      editable: true,
    },
  ],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSettingsSource', () => {
  beforeEach(() => {
    mockGetSettingsSource.mockReset();
  });

  it('should return only the requested settings', async () => {
    mockGetSettingsSource.mockResolvedValue(RESPONSE);

    const { result } = renderHook(
      () =>
        useSettingsSource([
          SettingType.AuthenticationConfiguration,
          SettingType.AuthorizerConfiguration,
        ]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.sources.map(({ configType }) => configType)).toEqual([
      SourceSettingType.AuthenticationConfiguration,
      SourceSettingType.AuthorizerConfiguration,
    ]);
  });

  it('should serve every caller on the page from one request', async () => {
    mockGetSettingsSource.mockResolvedValue(RESPONSE);

    const { result } = renderHook(
      () => ({
        email: useSettingsSource([SettingType.EmailConfiguration]),
        security: useSettingsSource([SettingType.AuthenticationConfiguration]),
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.email.isLoading).toBe(false));

    expect(result.current.email.sources).toHaveLength(1);
    expect(result.current.security.sources).toHaveLength(1);
    expect(mockGetSettingsSource).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404])(
    'should report no sources when the server answers %s',
    async (status) => {
      mockGetSettingsSource.mockRejectedValue({ response: { status } });

      const { result } = renderHook(
        () => useSettingsSource([SettingType.EmailConfiguration]),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.sources).toEqual([]);
    }
  );

  it('should read the sources again on refetch', async () => {
    mockGetSettingsSource
      .mockResolvedValueOnce(RESPONSE)
      .mockResolvedValueOnce({
        settings: [
          {
            configType: SourceSettingType.EmailConfiguration,
            source: ConfigSourceMode.Auto,
            editable: true,
            overriddenFields: [{ path: '/serverPort' }],
          },
        ],
      });

    const { result } = renderHook(
      () => useSettingsSource([SettingType.EmailConfiguration]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.sources[0].overriddenFields).toBeUndefined();

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetSettingsSource).toHaveBeenCalledTimes(2);

    await waitFor(() =>
      expect(result.current.sources[0].overriddenFields).toEqual([
        { path: '/serverPort' },
      ])
    );
  });
});
