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

import { AxiosHeaders, AxiosRequestConfig } from 'axios';
import { Task } from '../generated/entity/tasks/task';
import APIClient from './index';
import { addTaskComment, deleteTaskComment, editTaskComment } from './tasksAPI';

jest.mock('./index');

describe('tasksAPI comments', () => {
  const mockAPIClient = APIClient as jest.Mocked<typeof APIClient>;
  const task = { id: 't1' } as Task;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTaskComment', () => {
    it('posts the message to the task comments endpoint', async () => {
      mockAPIClient.post.mockResolvedValue({ data: task });

      const result = await addTaskComment('t1', 'hello');

      expect(mockAPIClient.post).toHaveBeenCalledWith('/tasks/t1/comments', {
        message: 'hello',
      });
      expect(result).toEqual(task);
    });
  });

  describe('deleteTaskComment', () => {
    it('deletes the comment by task and comment id', async () => {
      mockAPIClient.delete.mockResolvedValue({ data: task });

      const result = await deleteTaskComment('t1', 'c1');

      expect(mockAPIClient.delete).toHaveBeenCalledWith(
        '/tasks/t1/comments/c1'
      );
      expect(result).toEqual(task);
    });
  });

  describe('editTaskComment', () => {
    it('patches the comment with a transformRequest config', async () => {
      mockAPIClient.patch.mockResolvedValue({ data: task });

      const result = await editTaskComment('t1', 'c1', 'edited');

      expect(mockAPIClient.patch).toHaveBeenCalledWith(
        '/tasks/t1/comments/c1',
        { message: 'edited' },
        expect.objectContaining({ transformRequest: expect.any(Array) })
      );
      expect(result).toEqual(task);
    });

    // Regression: the shared client's interceptor forces application/json-patch+json
    // on every PATCH, but this endpoint consumes application/json (a merge body), so
    // without the reset the server responds 415.
    it('resets the content type to application/json on the outgoing request', async () => {
      mockAPIClient.patch.mockResolvedValue({ data: task });

      await editTaskComment('t1', 'c1', 'edited');

      const config = mockAPIClient.patch.mock.calls[0][2] as AxiosRequestConfig;
      const [transform] = config.transformRequest as unknown as Array<
        (data: unknown, headers: AxiosHeaders) => string
      >;
      const setHeader = jest.fn();
      const headers = { set: setHeader } as unknown as AxiosHeaders;

      const body = transform({ message: 'edited' }, headers);

      expect(setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
        true
      );
      expect(body).toBe(JSON.stringify({ message: 'edited' }));
    });
  });
});
