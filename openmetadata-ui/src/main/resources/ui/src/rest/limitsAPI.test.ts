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
import axiosClient from './';
import { getLimitByResource, getLimitConfig } from './limitsAPI';

jest.mock('./', () => ({
  get: jest.fn(),
}));

describe('limitsAPI -- getLimitConfig', () => {
  it('should fetch limit config successfully', async () => {
    const mockResponse = {
      data: {
        enabled: true,
      },
    };

    (axiosClient.get as jest.Mock).mockResolvedValue(mockResponse);

    const result = await getLimitConfig();

    expect(axiosClient.get).toHaveBeenCalledWith('/limits/config');
    expect(result).toEqual(mockResponse.data);
  });

  it('should handle error when fetching limit config', async () => {
    const mockError = new Error('Failed to fetch limit config');

    (axiosClient.get as jest.Mock).mockRejectedValue(mockError);

    await expect(getLimitConfig()).rejects.toThrow(mockError);
  });
});

describe('limitsAPI -- getLimitByResource', () => {
  describe('getLimitByResource', () => {
    it('should fetch limit by resource successfully', async () => {
      const mockResource = 'exampleResource';
      const mockResponse = {
        data: {
          resource: mockResource,
          used: 1,
          enable: true,
          assetLimits: {
            softLimit: 1,
            hardLimit: 1,
          },
        },
      };

      (axiosClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getLimitByResource(mockResource);

      expect(axiosClient.get).toHaveBeenCalledWith(
        '/limits/features/exampleResource',
        { params: undefined }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle error when fetching limit by resource', async () => {
      const mockResource = 'exampleResource';
      const mockError = new Error('Failed to fetch limit by resource');

      (axiosClient.get as jest.Mock).mockRejectedValue(mockError);

      await expect(getLimitByResource(mockResource)).rejects.toThrow(mockError);
    });
  });
});
