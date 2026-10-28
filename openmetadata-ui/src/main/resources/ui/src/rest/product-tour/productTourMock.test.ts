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
import axios, { AxiosAdapter } from 'axios';
import { ProductTourFixture } from '../../interface/product-tour/productTour.interface';
import {
  activateTourMock,
  attachTourMockInterceptor,
  deactivateTourMock,
  isTourPageQuiet,
} from './productTourMock';

jest.mock('../apiBaseUrl', () => ({
  getApiBaseUrl: () => '/api/v1',
}));

const FIXTURES = [
  {
    method: 'get',
    path: '/glossaries',
    query: { limit: '10' },
    data: { data: [{ name: 'Business Glossary' }] },
  },
];

describe('product tour mock interceptor', () => {
  const server = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
    async (config) => ({
      data: 'from server',
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
  );
  const client = axios.create({ baseURL: '/api/v1', adapter: server });
  attachTourMockInterceptor(client);

  afterEach(() => {
    deactivateTourMock();
    server.mockClear();
  });

  it('leaves every request to the server when no tour runs', async () => {
    const response = await client.get('/glossaries', { params: { limit: 10 } });

    expect(response.data).toBe('from server');
  });

  it('answers a recorded request from its fixture without the server', async () => {
    activateTourMock(async () => FIXTURES);

    const response = await client.get('/glossaries', { params: { limit: 10 } });

    expect(response.data).toEqual({ data: [{ name: 'Business Glossary' }] });
    expect(server).not.toHaveBeenCalled();
  });

  it('hands out a copy, so a page cannot change the fixture', async () => {
    activateTourMock(async () => FIXTURES);

    const first = await client.get('/glossaries');
    first.data.data.pop();
    const second = await client.get('/glossaries');

    expect(second.data.data).toHaveLength(1);
  });

  it('sends a request without a fixture to the server', async () => {
    activateTourMock(async () => FIXTURES);

    const response = await client.get('/tables');

    expect(response.data).toBe('from server');
  });

  it('drops an update during the tour', async () => {
    activateTourMock(async () => FIXTURES);

    const response = await client.patch('/glossaries/1', [{ op: 'add' }]);

    expect(response.status).toBe(200);
    expect(server).not.toHaveBeenCalled();
  });

  it('sends a read made as a POST without a fixture to the server', async () => {
    activateTourMock(async () => FIXTURES);

    const response = await client.post('/search/aggregate', { field: 'a' });

    expect(response.data).toBe('from server');
  });

  it('loads the fixtures as the tour starts, once', async () => {
    const loadFixtures = jest.fn(async () => FIXTURES);
    activateTourMock(loadFixtures);

    expect(loadFixtures).toHaveBeenCalledTimes(1);

    await Promise.all([client.get('/glossaries'), client.get('/glossaries')]);

    expect(loadFixtures).toHaveBeenCalledTimes(1);
  });

  it('tells when the page has gone quiet', async () => {
    activateTourMock(async () => FIXTURES);
    let answer: () => void = () => undefined;
    const reachedServer = new Promise<void>((reached) => {
      server.mockImplementationOnce(
        (config) =>
          new Promise((resolve) => {
            answer = () =>
              resolve({
                data: 'late',
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
              });
            reached();
          })
      );
    });

    const pending = client.get('/users/loggedInUser');
    await reachedServer;

    expect(isTourPageQuiet(0)).toBe(false);

    answer();
    await pending;

    expect(isTourPageQuiet(0)).toBe(true);
    expect(isTourPageQuiet(60_000)).toBe(false);
  });

  it('matches a live request to the one recorded from the browser', async () => {
    // Recorded from the wire: a repeated key, as `indexes: null` sends arrays.
    const recorded: ProductTourFixture[] = [
      {
        method: 'get',
        path: '/search/query',
        query: { index: 'dataAsset', exclude: 'columns,queries' },
        data: 'explore results',
      },
      { method: 'get', path: '/search/query', query: {}, data: 'other' },
    ];
    activateTourMock(async () => recorded);

    const response = await client.get('/search/query', {
      params: { index: 'dataAsset', exclude: ['columns', 'queries'] },
      paramsSerializer: { indexes: null },
    });

    expect(response.data).toBe('explore results');
  });

  it('never serves auth from a fixture, even one recorded by mistake', async () => {
    activateTourMock(async () => [
      { method: 'post', path: '/auth/refresh', data: 'recorded token' },
    ]);

    const response = await client.post('/auth/refresh', {});

    expect(response.data).toBe('from server');
  });

  it('leaves requests to the server when the fixtures fail to load', async () => {
    activateTourMock(() => Promise.reject(new Error('chunk 404')));

    const response = await client.get('/glossaries');

    expect(response.data).toBe('from server');
  });
});
