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

import { SearchIndex } from '../enums/search.enum';
import APIClient from './axiosClient';
import { getAggregateFieldOptions, postAggregateFieldOptions } from './miscAPI';

jest.mock('./axiosClient');

const mockedGet = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const mockedPost = APIClient.post as jest.MockedFunction<typeof APIClient.post>;

describe('miscAPI aggregate field options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ data: {} } as never);
    mockedPost.mockResolvedValue({ data: {} } as never);
  });

  describe('getAggregateFieldOptions', () => {
    it('wraps the value in .*….* without pre-escaping (server owns Lucene escaping)', async () => {
      await getAggregateFieldOptions(
        SearchIndex.TABLE,
        'tags.tagFQN',
        'Pii.Phone (mobile)',
        '*'
      );

      expect(mockedGet).toHaveBeenCalledWith(
        '/search/aggregate',
        expect.objectContaining({
          params: expect.objectContaining({
            value: '.*Pii.Phone (mobile).*',
          }),
        })
      );
    });

    it.each([
      ['C++', '.*C++.*'],
      ['R&D Team', '.*R&D Team.*'],
      ['A|B', '.*A|B.*'],
      ['Revenue (net of tax) [US]', '.*Revenue (net of tax) [US].*'],
      ['john?', '.*john?.*'],
      ['user.id', '.*user.id.*'],
    ])(
      'does NOT escape Lucene regexp metacharacters in "%s" (sent raw as %s)',
      async (value, expectedWildCardValue) => {
        await getAggregateFieldOptions(
          SearchIndex.TABLE,
          'owner.displayName.keyword',
          value,
          '*'
        );

        expect(mockedGet).toHaveBeenCalledWith(
          '/search/aggregate',
          expect.objectContaining({
            params: expect.objectContaining({ value: expectedWildCardValue }),
          })
        );
        // No backslash-escaping should have been applied client-side — that would
        // double-escape once the server runs SearchUtils.escapeLuceneRegexp.
        expect(expectedWildCardValue).not.toContain('\\');
      }
    );

    it('sends the bare match-all wildcard when value is empty', async () => {
      await getAggregateFieldOptions(SearchIndex.TABLE, 'tags.tagFQN', '', '*');

      expect(mockedGet).toHaveBeenCalledWith(
        '/search/aggregate',
        expect.objectContaining({
          params: expect.objectContaining({ value: '.*' }),
        })
      );
    });

    it('targets the NLQ aggregate endpoint when isNLPEnabled is true', async () => {
      await getAggregateFieldOptions(
        SearchIndex.TABLE,
        'tags.tagFQN',
        'name',
        '*',
        undefined,
        false,
        true
      );

      expect(mockedGet).toHaveBeenCalledWith(
        '/hybrid/nlq/search/aggregate',
        expect.anything()
      );
    });
  });

  describe('postAggregateFieldOptions', () => {
    it('wraps fieldValue in .*….* without pre-escaping (server owns Lucene escaping)', async () => {
      await postAggregateFieldOptions({
        index: SearchIndex.TABLE,
        fieldName: 'tags.tagFQN',
        fieldValue: 'Pii.Phone (mobile)',
        size: 10,
      });

      expect(mockedPost).toHaveBeenCalledWith('/search/aggregate', {
        index: SearchIndex.TABLE,
        fieldName: 'tags.tagFQN',
        fieldValue: '.*Pii.Phone (mobile).*',
        size: 10,
      });
    });

    it.each([
      ['C++', '.*C++.*'],
      ['R&D Team', '.*R&D Team.*'],
      ['A|B', '.*A|B.*'],
      ['Revenue (net of tax) [US]', '.*Revenue (net of tax) [US].*'],
      ['user.id', '.*user.id.*'],
    ])(
      'sends "%s" raw as %s (no client-side backslash escaping)',
      async (fieldValue, expectedWildCardValue) => {
        await postAggregateFieldOptions({
          index: SearchIndex.TABLE,
          fieldName: 'owner.displayName.keyword',
          fieldValue,
          size: 10,
        });

        expect(mockedPost).toHaveBeenCalledWith('/search/aggregate', {
          index: SearchIndex.TABLE,
          fieldName: 'owner.displayName.keyword',
          fieldValue: expectedWildCardValue,
          size: 10,
        });
        expect(expectedWildCardValue).not.toContain('\\');
      }
    );

    it('sends the bare match-all wildcard when fieldValue is empty', async () => {
      await postAggregateFieldOptions({
        index: SearchIndex.TABLE,
        fieldName: 'tags.tagFQN',
        fieldValue: '',
        size: 10,
      });

      expect(mockedPost).toHaveBeenCalledWith('/search/aggregate', {
        index: SearchIndex.TABLE,
        fieldName: 'tags.tagFQN',
        fieldValue: '.*',
        size: 10,
      });
    });
  });
});
