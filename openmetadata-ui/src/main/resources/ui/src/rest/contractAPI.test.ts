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
import APIClient from './axiosClient';
import { exportContractToODCSYaml } from './contractAPI';

jest.mock('./axiosClient', () => ({
  get: jest.fn(),
}));

describe('ODCS YAML export version', () => {
  beforeEach(() => {
    (APIClient.get as jest.Mock).mockResolvedValue({
      data: 'apiVersion: v3.1.0',
    });
  });

  it.each([
    'v3.1.0',
    'v3.0.2',
    'v3.0.1',
    'v3.0.0',
    'v2.2.2',
    'v2.2.1',
  ] as const)('requests %s without losing field selection', async (version) => {
    await exportContractToODCSYaml('contract-id', 'owners', version);

    expect(APIClient.get).toHaveBeenCalledWith(
      '/dataContracts/contract-id/odcs/yaml',
      expect.objectContaining({
        params: { fields: 'owners', odcsVersion: version },
      })
    );
  });

  it('keeps existing callers on the server default version', async () => {
    expect(await exportContractToODCSYaml('contract-id')).toBe(
      'apiVersion: v3.1.0'
    );
    expect(APIClient.get).toHaveBeenCalledWith(
      '/dataContracts/contract-id/odcs/yaml',
      expect.objectContaining({
        params: { fields: undefined, odcsVersion: undefined },
      })
    );
  });
});
