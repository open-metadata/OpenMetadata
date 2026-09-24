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
  DefaultViewMode,
} from '../generated/api/configuration/appConfiguration';
import { SettingType } from '../generated/settings/settings';
import axiosClient from './axiosClient';
import { patchAppConfiguration } from './settingConfigAPI';

jest.mock('./axiosClient');

describe('settingConfigAPI', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('patchAppConfiguration', () => {
    it('reads the current config before writing the patch', async () => {
      mockClient.get.mockResolvedValue({
        data: { config_value: { defaultAppMode: DefaultAppMode.Classic } },
      });
      mockClient.put.mockResolvedValue({ data: { config_value: {} } });

      await patchAppConfiguration({
        defaultViewModes: { domains: DefaultViewMode.Grid },
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        `/system/settings/${SettingType.AppConfiguration}`
      );
      expect(mockClient.put).toHaveBeenCalledWith(
        '/system/settings',
        expect.objectContaining({
          config_type: SettingType.AppConfiguration,
        })
      );
    });

    it('keeps a field from the current config that the patch does not touch', async () => {
      mockClient.get.mockResolvedValue({
        data: {
          config_value: {
            defaultAppMode: DefaultAppMode.Classic,
            defaultViewModes: { domains: DefaultViewMode.Grid },
          },
        },
      });
      mockClient.put.mockResolvedValue({ data: { config_value: {} } });

      await patchAppConfiguration({
        defaultViewModes: { domains: DefaultViewMode.List },
      });

      expect(mockClient.put).toHaveBeenCalledWith('/system/settings', {
        config_type: SettingType.AppConfiguration,
        config_value: {
          defaultAppMode: DefaultAppMode.Classic,
          defaultViewModes: { domains: DefaultViewMode.List },
        },
      });
    });

    it('overrides a field the patch does provide with the same key', async () => {
      mockClient.get.mockResolvedValue({
        data: { config_value: { defaultAppMode: DefaultAppMode.Classic } },
      });
      mockClient.put.mockResolvedValue({ data: { config_value: {} } });

      await patchAppConfiguration({ defaultAppMode: DefaultAppMode.AI });

      expect(mockClient.put).toHaveBeenCalledWith('/system/settings', {
        config_type: SettingType.AppConfiguration,
        config_value: { defaultAppMode: DefaultAppMode.AI },
      });
    });

    it('sends the patch alone when nothing has been saved yet', async () => {
      mockClient.get.mockResolvedValue({ data: {} });
      mockClient.put.mockResolvedValue({ data: { config_value: {} } });

      await patchAppConfiguration({ defaultAppMode: DefaultAppMode.AI });

      expect(mockClient.put).toHaveBeenCalledWith('/system/settings', {
        config_type: SettingType.AppConfiguration,
        config_value: { defaultAppMode: DefaultAppMode.AI },
      });
    });
  });
});
