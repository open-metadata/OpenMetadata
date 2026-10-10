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
  DefaultAppMode,
  DefaultColumnOrder,
} from '../generated/api/configuration/appConfiguration';
import { SettingType } from '../generated/settings/settings';
import axiosClient from './axiosClient';
import { patchAppConfiguration } from './settingConfigAPI';

jest.mock('./axiosClient');

describe('patchAppConfiguration', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the keys it is not changing, since the PUT replaces the whole document', async () => {
    mockClient.get.mockResolvedValue({
      data: { config_value: { defaultAppMode: DefaultAppMode.AI } },
    });
    mockClient.put.mockImplementation(async (_url, body) => ({ data: body }));

    const saved = await patchAppConfiguration({
      defaultColumnOrder: DefaultColumnOrder.SourceOrder,
    });

    expect(mockClient.put).toHaveBeenCalledWith('/system/settings', {
      config_type: SettingType.AppConfiguration,
      config_value: {
        defaultAppMode: DefaultAppMode.AI,
        defaultColumnOrder: DefaultColumnOrder.SourceOrder,
      },
    });
    expect(saved).toEqual({
      defaultAppMode: DefaultAppMode.AI,
      defaultColumnOrder: DefaultColumnOrder.SourceOrder,
    });
  });

  it('clears a key explicitly set to null', async () => {
    mockClient.get.mockResolvedValue({
      data: {
        config_value: {
          defaultAppMode: DefaultAppMode.AI,
          defaultColumnOrder: DefaultColumnOrder.SourceOrder,
        },
      },
    });
    mockClient.put.mockImplementation(async (_url, body) => ({ data: body }));

    await patchAppConfiguration({ defaultAppMode: null });

    expect(mockClient.put).toHaveBeenCalledWith(
      '/system/settings',
      expect.objectContaining({
        config_value: {
          defaultAppMode: null,
          defaultColumnOrder: DefaultColumnOrder.SourceOrder,
        },
      })
    );
  });
});
