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

import { CSVImportResult } from '../generated/type/csvImportResult';
import axiosClient from './axiosClient';
import { getCsvAsyncImportResult, resolveCsvImportResult } from './csvAPI';

jest.mock('./axiosClient');

const mockedGet = axiosClient.get as jest.MockedFunction<
  typeof axiosClient.get
>;

const IMPORT_RESULT = {
  importResultsCsv: 'status\nsuccess',
} as CSVImportResult;

describe('csvAPI import result', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCsvAsyncImportResult', () => {
    it('fetches the persisted result by job id', async () => {
      mockedGet.mockResolvedValueOnce({ data: IMPORT_RESULT } as never);

      const result = await getCsvAsyncImportResult('42');

      expect(mockedGet).toHaveBeenCalledWith('/csvAsyncJobs/42/import-result', {
        signal: undefined,
      });
      expect(result).toEqual(IMPORT_RESULT);
    });
  });

  describe('resolveCsvImportResult', () => {
    it('returns the inline result without fetching when the frame carries one', async () => {
      const result = await resolveCsvImportResult('42', IMPORT_RESULT);

      expect(result).toEqual(IMPORT_RESULT);
      expect(mockedGet).not.toHaveBeenCalled();
    });

    it('fetches by job id when the frame is thin (no inline result)', async () => {
      mockedGet.mockResolvedValueOnce({ data: IMPORT_RESULT } as never);

      const result = await resolveCsvImportResult('42', undefined);

      expect(mockedGet).toHaveBeenCalledWith('/csvAsyncJobs/42/import-result', {
        signal: undefined,
      });
      expect(result).toEqual(IMPORT_RESULT);
    });

    it('returns undefined without fetching when there is no job id', async () => {
      const result = await resolveCsvImportResult(undefined, undefined);

      expect(result).toBeUndefined();
      expect(mockedGet).not.toHaveBeenCalled();
    });
  });
});
