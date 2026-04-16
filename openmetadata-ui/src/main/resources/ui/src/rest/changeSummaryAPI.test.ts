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

import axiosClient from '.';
import { ChangeSource } from '../generated/type/changeSummaryMap';
import { getChangeSummary, getChangeSummaryByFqn } from './changeSummaryAPI';

jest.mock('.');

const mockedGet = axiosClient.get as jest.MockedFunction<
  typeof axiosClient.get
>;

describe('changeSummaryAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getChangeSummary', () => {
    it('should call the correct URL with entity type and ID', async () => {
      const mockResponse = {
        data: {
          changeSummary: {
            description: {
              changedBy: 'admin',
              changeSource: ChangeSource.Suggested,
              changedAt: 1700000000000,
            },
          },
          totalEntries: 1,
        },
      };
      mockedGet.mockResolvedValueOnce(mockResponse as never);

      const result = await getChangeSummary('table', 'test-id-123');

      expect(mockedGet).toHaveBeenCalledWith(
        '/changeSummary/table/test-id-123',
        { params: undefined }
      );
      expect(result.changeSummary).toHaveProperty('description');
      expect(result.totalEntries).toBe(1);
    });

    it('should pass fieldPrefix parameter', async () => {
      const mockResponse = {
        data: {
          changeSummary: {},
          totalEntries: 0,
        },
      };
      mockedGet.mockResolvedValueOnce(mockResponse as never);

      await getChangeSummary('table', 'test-id', {
        fieldPrefix: 'columns.',
      });

      expect(mockedGet).toHaveBeenCalledWith('/changeSummary/table/test-id', {
        params: { fieldPrefix: 'columns.' },
      });
    });

    it('should pass pagination parameters', async () => {
      const mockResponse = {
        data: {
          changeSummary: {},
          totalEntries: 0,
          offset: 10,
          limit: 50,
        },
      };
      mockedGet.mockResolvedValueOnce(mockResponse as never);

      await getChangeSummary('table', 'test-id', {
        limit: 50,
        offset: 10,
      });

      expect(mockedGet).toHaveBeenCalledWith('/changeSummary/table/test-id', {
        params: { limit: 50, offset: 10 },
      });
    });
  });

  describe('getChangeSummaryByFqn', () => {
    it('should call the correct URL with entity type and FQN', async () => {
      const mockResponse = {
        data: {
          changeSummary: {
            description: {
              changedBy: 'admin',
              changeSource: ChangeSource.Automated,
              changedAt: 1700000000000,
            },
          },
          totalEntries: 1,
        },
      };
      mockedGet.mockResolvedValueOnce(mockResponse as never);

      const result = await getChangeSummaryByFqn(
        'table',
        'service.database.schema.my_table'
      );

      expect(mockedGet).toHaveBeenCalledWith(
        '/changeSummary/table/name/service.database.schema.my_table',
        { params: undefined }
      );
      expect(result.changeSummary).toHaveProperty('description');
      expect(result.totalEntries).toBe(1);
    });
  });
});
