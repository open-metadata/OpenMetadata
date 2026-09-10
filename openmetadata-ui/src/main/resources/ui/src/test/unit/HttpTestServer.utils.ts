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

import { AxiosError, InternalAxiosRequestConfig } from 'axios';
// eslint-disable-next-line openmetadata-imports/no-internal-barrel-imports -- Client singleton, not a barrel.
import APIClient from '../../rest/index';

interface HttpRequest {
  method: string;
  url: URL;
  body: unknown;
}

interface HttpResponse {
  data: unknown;
  status?: number;
}

type HttpHandler = (
  request: HttpRequest
) => HttpResponse | Promise<HttpResponse>;

/** Keeps the real REST client and interceptors; replaces only network transport. */
export function createHttpTestServer() {
  const originalAdapter = APIClient.defaults.adapter;
  const routes: { method: string; path: string; handler: HttpHandler }[] = [];
  const requests: HttpRequest[] = [];
  const unhandled: string[] = [];
  let requestLimitExceeded = false;

  APIClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const request: HttpRequest = {
      method: (config.method ?? 'get').toUpperCase(),
      url: new URL(APIClient.getUri(config), 'http://localhost'),
      body:
        typeof config.data === 'string' &&
        String(config.headers.getContentType()).includes('application/json')
          ? JSON.parse(config.data)
          : config.data,
    };

    if (requests.length >= 500) {
      requestLimitExceeded = true;

      throw new Error(
        'HTTP test exceeded 500 requests; check for a render loop'
      );
    }
    requests.push(request);
    const route = routes.find(
      ({ method, path }) =>
        method === request.method && path === request.url.pathname
    );
    if (!route) {
      const message = `Unhandled HTTP request: ${request.method} ${request.url}`;
      unhandled.push(message);

      throw new Error(message);
    }
    const { data, status = 200 } = await route.handler(request);
    const response = {
      config,
      data,
      status,
      statusText: String(status),
      headers: {},
    };
    if (status >= 400) {
      throw new AxiosError(
        `HTTP ${status}`,
        undefined,
        config,
        undefined,
        response
      );
    }

    return response;
  };

  return {
    requests,
    on(method: string, path: string, handler: HttpHandler) {
      routes.unshift({ method, path, handler });
    },
    restore() {
      APIClient.defaults.adapter = originalAdapter;

      expect(unhandled).toEqual([]);
      expect(requestLimitExceeded).toBe(false);
    },
  };
}

export function deferredResponse<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}
