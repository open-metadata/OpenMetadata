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

import { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { Task } from '../generated/entity/tasks/task';
import { addTaskComment, deleteTaskComment, editTaskComment } from './tasksAPI';

let mockCapturedRequest: InternalAxiosRequestConfig | undefined;

// Use a real axios instance wired like the app's shared client: a request
// interceptor that mirrors AuthProvider (forces application/json-patch+json on
// every PATCH) plus a stub adapter that short-circuits the network and captures
// the fully-resolved request — after both the interceptor and transformRequest
// have run. This exercises the real interceptor → transform ordering instead of
// hand-invoking transformRequest, so a regression that reintroduces the 415
// (e.g. interceptor ordering) fails here.
jest.mock('./index', () => {
  const axios = jest.requireActual('axios');
  const client = axios.create();

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (config.method === 'patch' && config.headers) {
      config.headers['Content-type'] = 'application/json-patch+json';
    }

    return config;
  });

  client.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    mockCapturedRequest = config;

    return Promise.resolve({
      data: { id: 't1' } as Task,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  };

  return { __esModule: true, default: client };
});

describe('tasksAPI comments', () => {
  beforeEach(() => {
    mockCapturedRequest = undefined;
  });

  it('addTaskComment posts the message to the comments endpoint', async () => {
    const result = await addTaskComment('t1', 'hello');

    expect(mockCapturedRequest?.method).toBe('post');
    expect(mockCapturedRequest?.url).toBe('/tasks/t1/comments');
    expect(result).toEqual({ id: 't1' });
  });

  it('deleteTaskComment deletes by task and comment id', async () => {
    const result = await deleteTaskComment('t1', 'c1');

    expect(mockCapturedRequest?.method).toBe('delete');
    expect(mockCapturedRequest?.url).toBe('/tasks/t1/comments/c1');
    expect(result).toEqual({ id: 't1' });
  });

  describe('editTaskComment', () => {
    it('patches the comment message', async () => {
      const result = await editTaskComment('t1', 'c1', 'edited');

      expect(mockCapturedRequest?.method).toBe('patch');
      expect(mockCapturedRequest?.url).toBe('/tasks/t1/comments/c1');
      expect(mockCapturedRequest?.data).toBe(
        JSON.stringify({ message: 'edited' })
      );
      expect(result).toEqual({ id: 't1' });
    });

    it('overrides the forced json-patch content type with application/json', async () => {
      await editTaskComment('t1', 'c1', 'edited');

      const contentType = (mockCapturedRequest?.headers as AxiosHeaders).get(
        'Content-Type'
      );

      expect(contentType).toBe('application/json');
    });
  });
});
