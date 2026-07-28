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

import axios, { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import {
  attachEtagInterceptor,
  clearEtagCache,
  DISABLE_ETAG_CONDITIONAL_READS_KEY,
} from './etagInterceptor';

const ETAG = '"entity-version-1"';

const createClient = () => {
  const requests: InternalAxiosRequestConfig[] = [];
  const client = axios.create({
    adapter: async (config) => {
      requests.push(config);

      return {
        config,
        data: { id: 'entity-id' },
        headers: new AxiosHeaders({ etag: ETAG }),
        status: 200,
        statusText: 'OK',
      };
    },
  });
  attachEtagInterceptor(client);

  return { client, requests };
};

describe('etagInterceptor', () => {
  beforeEach(() => {
    clearEtagCache();
    localStorage.clear();
  });

  it('attaches If-None-Match to a cached entity read', async () => {
    const { client, requests } = createClient();

    await client.get('/tables/entity-id');
    await client.get('/tables/entity-id');

    expect(AxiosHeaders.from(requests[1].headers).get('If-None-Match')).toBe(
      ETAG
    );
  });

  it('honors the E2E conditional-read opt-out without network routing', async () => {
    const { client, requests } = createClient();

    await client.get('/tables/entity-id');
    localStorage.setItem(DISABLE_ETAG_CONDITIONAL_READS_KEY, 'true');
    await client.get('/tables/entity-id');

    expect(AxiosHeaders.from(requests[1].headers).has('If-None-Match')).toBe(
      false
    );
  });
});
