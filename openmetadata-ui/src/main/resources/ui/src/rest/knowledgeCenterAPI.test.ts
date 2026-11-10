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
import { extractPageMemories } from './knowledgeCenterAPI';

jest.mock('./axiosClient', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockPost = APIClient.post as jest.Mock;

describe('extractPageMemories', () => {
  it('asks the server to extract the article and returns the article it now reads', async () => {
    const queued = { id: 'page-1', name: 'gdpr', processingStatus: 'Queued' };
    mockPost.mockResolvedValueOnce({ data: queued });

    expect(await extractPageMemories('page-1')).toEqual(queued);
    expect(mockPost).toHaveBeenCalledWith(
      '/contextCenter/pages/page-1/extract'
    );
  });
});
