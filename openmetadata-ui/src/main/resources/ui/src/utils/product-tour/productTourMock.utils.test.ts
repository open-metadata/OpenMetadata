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
import {
  buildTourFixtureIndex,
  findTourFixture,
  getTourRequestKey,
  isTourPassThroughPath,
  toTourRequest,
} from './productTourMock.utils';

const SEARCH = {
  method: 'get',
  path: '/search/query',
  query: { index: 'table', q: '*' },
  data: { hits: 'tables' },
};

describe('productTourMock utils', () => {
  describe('toTourRequest', () => {
    it('reads the path under the API base and the query as sent', () => {
      expect(
        toTourRequest(
          'GET',
          '/api/v1/search/query?q=*&index=table&size=10&fields=a&fields=b',
          '/api/v1'
        )
      ).toEqual({
        method: 'get',
        path: '/search/query',
        query: { q: '*', index: 'table', size: '10', fields: 'a,b' },
        body: undefined,
      });
    });

    it('reads a repeated key and a comma-joined one the same way', () => {
      expect(
        toTourRequest('get', '/api/v1/x?f=a&f=b', '/api/v1').query
      ).toEqual(toTourRequest('get', '/api/v1/x?f=a,b', '/api/v1').query);
    });

    it('keeps a path given relative to the API base', () => {
      expect(toTourRequest('get', '/glossaries', '/api/v1').path).toBe(
        '/glossaries'
      );
    });

    it('keeps the body of a read sent as a POST', () => {
      expect(
        toTourRequest('post', '/search/query', '/api/v1', { size: 1 }).body
      ).toBe('{"size":1}');
    });
  });

  describe('getTourRequestKey', () => {
    it('ignores parameter order and the volatile time window', () => {
      expect(
        getTourRequestKey({
          method: 'GET',
          path: '/dataQuality/summary',
          query: { b: '2', a: '1', startTs: '1', endTs: '2' },
        })
      ).toBe(
        getTourRequestKey({
          method: 'get',
          path: '/dataQuality/summary',
          query: { a: '1', b: '2', startTs: '9', endTs: '10' },
        })
      );
    });
  });

  it('matches a body whose time window has moved on', () => {
    const body = (startTs: number) =>
      JSON.stringify({ q: `{"range":{"timestamp":{"gte":${startTs}}}}` });

    expect(
      getTourRequestKey({
        method: 'post',
        path: '/dataQuality/testSuites/dataQualityReport/batch',
        query: {},
        body: body(1792000000000),
      })
    ).toBe(
      getTourRequestKey({
        method: 'post',
        path: '/dataQuality/testSuites/dataQualityReport/batch',
        query: {},
        body: body(1792600000000),
      })
    );
  });

  it('leaves auth, the signed-in user and permissions to the server', () => {
    [
      '/auth/refresh',
      '/users/login',
      '/users/loggedInUser',
      '/users/95cb4e45-02b7-4271-b3a9-7c874cc54d8f',
      '/users/95cb4e45-02b7-4271-b3a9-7c874cc54d8f/preferences',
      '/permissions',
    ].forEach((path) => expect(isTourPassThroughPath(path)).toBe(true));

    ['/search/query', '/users'].forEach((path) =>
      expect(isTourPassThroughPath(path)).toBe(false)
    );
  });

  describe('findTourFixture', () => {
    const index = buildTourFixtureIndex([
      SEARCH,
      { ...SEARCH, query: { index: 'dashboard', q: '*' }, data: 'dashboards' },
    ]);

    it('answers a request with the fixture recorded for the same query', () => {
      expect(
        findTourFixture(index, {
          method: 'get',
          path: '/search/query',
          query: { q: '*', index: 'dashboard' },
        })?.data
      ).toBe('dashboards');
    });

    it('falls back to the first fixture for the path when the query differs', () => {
      expect(
        findTourFixture(index, {
          method: 'get',
          path: '/search/query',
          query: { index: 'table', q: '*', size: '50' },
        })?.data
      ).toEqual({ hits: 'tables' });
    });

    it('finds nothing for a path that was not recorded', () => {
      expect(
        findTourFixture(index, {
          method: 'get',
          path: '/glossaries',
          query: {},
        })
      ).toBeUndefined();
    });

    it('does not answer a write with a read of the same path', () => {
      expect(
        findTourFixture(index, {
          method: 'post',
          path: '/search/query',
          query: {},
        })
      ).toBeUndefined();
    });
  });
});
