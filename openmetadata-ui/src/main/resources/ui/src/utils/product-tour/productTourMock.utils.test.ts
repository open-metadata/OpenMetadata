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
    it('reads the path under the API base and merges the URL query with params', () => {
      expect(
        toTourRequest('GET', '/api/v1/search/query?q=*', '/api/v1', {
          index: 'table',
          size: 10,
          fields: ['a', 'b'],
          empty: undefined,
        })
      ).toEqual({
        method: 'get',
        path: '/search/query',
        query: { q: '*', index: 'table', size: '10', fields: 'a,b' },
        body: undefined,
      });
    });

    it('keeps a path given relative to the API base', () => {
      expect(toTourRequest('get', '/glossaries', '/api/v1').path).toBe(
        '/glossaries'
      );
    });

    it('keeps the body of a read sent as a POST', () => {
      expect(
        toTourRequest('post', '/search/query', '/api/v1', {}, { size: 1 }).body
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
