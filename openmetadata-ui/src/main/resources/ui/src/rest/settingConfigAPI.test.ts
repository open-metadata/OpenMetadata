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
import {
  patchAppConfiguration,
  toggleEntityRuleEnabled,
} from './settingConfigAPI';

jest.mock('./axiosClient');

describe('patchAppConfiguration', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a JSON patch touching only the given keys', async () => {
    mockClient.patch.mockResolvedValue({ data: {} });

    await patchAppConfiguration({ defaultAppMode: null });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(mockClient.patch).toHaveBeenCalledWith(
      `/system/settings/${SettingType.AppConfiguration}`,
      [{ op: 'add', path: '/defaultAppMode', value: null }],
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
  });

  it('sends a JSON patch for multiple keys', async () => {
    mockClient.patch.mockResolvedValue({ data: {} });

    await patchAppConfiguration({
      defaultAppMode: DefaultAppMode.AI,
      defaultColumnOrder: DefaultColumnOrder.SourceOrder,
    });

    expect(mockClient.patch).toHaveBeenCalledWith(
      `/system/settings/${SettingType.AppConfiguration}`,
      [
        { op: 'add', path: '/defaultAppMode', value: DefaultAppMode.AI },
        {
          op: 'add',
          path: '/defaultColumnOrder',
          value: DefaultColumnOrder.SourceOrder,
        },
      ],
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
  });
});

describe('toggleEntityRuleEnabled', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUTs only the rule name and new enabled state, not the whole list', async () => {
    mockClient.put.mockResolvedValue({ data: {} });

    await toggleEntityRuleEnabled('Single Domain', false);

    expect(mockClient.put).toHaveBeenCalledWith(
      '/system/settings/entityRulesSettings/rules/Single%20Domain/enabled',
      false,
      { headers: { 'Content-Type': 'application/json' } }
    );
  });

  it('URL-encodes rule names with special characters', async () => {
    mockClient.put.mockResolvedValue({ data: {} });

    await toggleEntityRuleEnabled('Multiple Domains are not allowed', true);

    expect(mockClient.put).toHaveBeenCalledWith(
      '/system/settings/entityRulesSettings/rules/Multiple%20Domains%20are%20not%20allowed/enabled',
      true,
      { headers: { 'Content-Type': 'application/json' } }
    );
  });
});
