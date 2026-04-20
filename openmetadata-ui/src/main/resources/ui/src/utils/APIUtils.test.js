/*
 *  Copyright 2022 Collate.
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

import { isNil } from 'lodash';
import {
  formatTeamsResponse,
  isBlobLikeResponse,
  omitDeep,
  parseExportErrorMessage,
} from './APIUtils';

const APIHits = [
  {
    _source: {
      description: 'this is the table to hold data on dim_shop',
      fqdn: 'hive.dim_shop',
      tableName: 'dim_shop',
      tableId: 'd2b34d55-8cc5-4a7e-9064-04dd37ef27b8',
      tableType: 'REGULAR',
    },
  },
];
const formatDataResponse = jest.fn().mockImplementation((hist) => {
  const formatedData = hist.map((hit) => {
    const newData = {};
    newData.id = hit._source.tableId;
    newData.name = hit._source.tableName;
    newData.description = hit._source.description;
    newData.fullyQualifiedName = hit._source.fqdn;
    newData.tableType = hit._source.tableType;

    return newData;
  });

  return formatedData;
});

describe('Test APIUtils utility', () => {
  it('Returns the proper formatted data', () => {
    const formattedData = formatDataResponse(APIHits);

    expect(formattedData).toStrictEqual([
      {
        fullyQualifiedName: 'hive.dim_shop',
        description: 'this is the table to hold data on dim_shop',
        name: 'dim_shop',
        id: 'd2b34d55-8cc5-4a7e-9064-04dd37ef27b8',
        tableType: 'REGULAR',
      },
    ]);
  });

  describe('formatTeamsResponse', () => {
    it('maps search hits to teams including fullyQualifiedName', () => {
      const teamHits = [
        {
          _source: {
            name: 'Engineering',
            displayName: 'Engineering Team',
            fullyQualifiedName: 'Engineering',
            entityType: 'Team',
            id: 'team-uuid-1',
            isJoinable: true,
            teamType: 'Group',
            href: 'http://localhost/team/Engineering',
          },
        },
      ];

      const result = formatTeamsResponse(teamHits);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Engineering',
        displayName: 'Engineering Team',
        fullyQualifiedName: 'Engineering',
        type: 'Team',
        id: 'team-uuid-1',
        isJoinable: true,
        teamType: 'Group',
        href: 'http://localhost/team/Engineering',
      });
    });

    it('returns empty array when hits is empty', () => {
      const result = formatTeamsResponse([]);

      expect(result).toEqual([]);
    });

    it('maps multiple hits with distinct fullyQualifiedName values', () => {
      const teamHits = [
        {
          _source: {
            name: 'TeamA',
            displayName: 'Team A',
            fullyQualifiedName: 'org.TeamA',
            entityType: 'Team',
            id: 'id-1',
            isJoinable: false,
            teamType: 'Group',
            href: '/team/TeamA',
          },
        },
        {
          _source: {
            name: 'TeamB',
            displayName: 'Team B',
            fullyQualifiedName: 'org.TeamB',
            entityType: 'Team',
            id: 'id-2',
            isJoinable: true,
            teamType: 'Department',
            href: '/team/TeamB',
          },
        },
      ];

      const result = formatTeamsResponse(teamHits);

      expect(result).toHaveLength(2);
      expect(result[0].fullyQualifiedName).toBe('org.TeamA');
      expect(result[1].fullyQualifiedName).toBe('org.TeamB');
    });
  });

  it('omitDeep w isNil removes nested undefined and null', () => {
    const obj = {
      key1: undefined,
      key2: null,
      key3: {
        key4: undefined,
        key5: null,
        key6: [
          {
            key7: undefined,
            key8: null,
          },
        ],
      },
    };

    const omitObj = omitDeep(obj, isNil);

    expect(omitObj).toEqual({
      key3: { key6: [{}] },
    });
  });

  describe('isBlobLikeResponse', () => {
    it('returns true for Blob instance', () => {
      const blob = new Blob(['hello'], { type: 'text/plain' });

      expect(isBlobLikeResponse(blob)).toBe(true);
    });

    it('returns true for blob-like object', () => {
      const blobLike = {
        size: 0,
        slice: jest.fn(),
        text: jest.fn().mockResolvedValue(''),
        type: 'text/plain',
      };

      expect(isBlobLikeResponse(blobLike)).toBe(true);
    });

    it('returns false for plain error object', () => {
      const errorObject = {
        message: 'failed',
        size: 0,
        text: jest.fn(),
      };

      expect(isBlobLikeResponse(errorObject)).toBe(false);
    });
  });

  describe('parseExportErrorMessage', () => {
    const fallback = 'Something went wrong';

    const makeBlobLike = (content) => ({
      size: content.length,
      type: 'text/plain',
      text: jest.fn().mockResolvedValue(content),
      slice: jest.fn(),
    });

    it('should extract message from JSON blob response', async () => {
      const error = {
        response: {
          data: makeBlobLike(
            JSON.stringify({ message: 'Export limit exceeded' })
          ),
        },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe('Export limit exceeded');
    });

    it('should return raw text when blob contains non-JSON text', async () => {
      const error = {
        response: {
          data: makeBlobLike('plain error text'),
        },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe('plain error text');
    });

    it('should return fallback when blob contains empty text', async () => {
      const error = {
        response: { data: makeBlobLike('') },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe(fallback);
    });

    it('should return raw text when JSON blob has no message field', async () => {
      const jsonText = JSON.stringify({ code: 500 });
      const error = {
        response: {
          data: makeBlobLike(jsonText),
        },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe(jsonText);
    });

    it('should return string response data directly', async () => {
      const error = {
        response: { data: 'Server error' },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe('Server error');
    });

    it('should return fallback for empty string response data', async () => {
      const error = {
        response: { data: '' },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe(fallback);
    });

    it('should extract message from object response data', async () => {
      const error = {
        response: { data: { message: 'Rate limited' } },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe('Rate limited');
    });

    it('should return fallback when object has no message', async () => {
      const error = {
        response: { data: { code: 403 } },
      };

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe(fallback);
    });

    it('should return fallback when response is undefined', async () => {
      const error = {};

      const result = await parseExportErrorMessage(error, fallback);

      expect(result).toBe(fallback);
    });
  });
});
