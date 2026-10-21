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

import { Include } from '../generated/type/include';
import { getContextFileById } from './assetAPI';
import APIClient from './axiosClient';

jest.mock('./axiosClient', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: {} }) },
}));

const mockGet = APIClient.get as jest.Mock;

describe('getContextFileById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards include so a soft-deleted file can be fetched', async () => {
    // The archive list is loaded with `include: 'deleted'`, so every row there
    // is already soft-deleted. The endpoint defaults to `non-deleted`, which
    // would 404 on an archived file that is still very much present — the
    // async-delete probe relies on being able to ask for it with Include.All.
    await getContextFileById('file-1', Include.All);

    expect(mockGet).toHaveBeenCalledWith(
      '/contextCenter/drive/files/file-1',
      expect.objectContaining({
        params: expect.objectContaining({ include: Include.All }),
      })
    );
  });

  it('omits include when none is given', async () => {
    await getContextFileById('file-1');

    expect(mockGet.mock.calls[0][1].params.include).toBeUndefined();
  });
});
