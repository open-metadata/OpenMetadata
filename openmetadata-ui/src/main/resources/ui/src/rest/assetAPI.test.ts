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
import {
  extractFileMemories,
  getContextFileById,
  listContextFiles,
} from './assetAPI';
import APIClient from './axiosClient';

jest.mock('./axiosClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn(),
  },
}));

const mockGet = APIClient.get as jest.Mock;
const mockPost = APIClient.post as jest.Mock;

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

// The status badge shows Not processed from the server's neverExtracted, which a
// read returns only when asked for it.
describe('neverExtracted on file reads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is requested when a file is fetched by id', async () => {
    await getContextFileById('file-1');

    expect(mockGet.mock.calls[0][1].params.fields.split(',')).toContain(
      'neverExtracted'
    );
  });

  it('is requested when files are listed', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [], paging: {} } });

    await listContextFiles();

    expect(mockGet.mock.calls[0][1].params.fields.split(',')).toContain(
      'neverExtracted'
    );
  });
});

// Extract and Retry are offered to a file's owners, which a read returns only when asked for them.
describe('owners on file reads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('are requested when a file is fetched by id', async () => {
    await getContextFileById('file-1');

    expect(mockGet.mock.calls[0][1].params.fields.split(',')).toContain(
      'owners'
    );
  });

  it('are requested when files are listed', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [], paging: {} } });

    await listContextFiles();

    expect(mockGet.mock.calls[0][1].params.fields.split(',')).toContain(
      'owners'
    );
  });
});

describe('extractFileMemories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks the server to extract the file and returns the file it now reads', async () => {
    const queued = {
      id: 'file-1',
      name: 'report.pdf',
      processingStatus: 'ExtractingContext',
    };
    mockPost.mockResolvedValueOnce({ data: queued });

    expect(await extractFileMemories('file-1')).toEqual(queued);
    expect(mockPost).toHaveBeenCalledWith(
      '/contextCenter/drive/files/file-1/extract'
    );
  });
});
