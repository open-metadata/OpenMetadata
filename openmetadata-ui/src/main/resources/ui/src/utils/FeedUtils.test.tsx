/*
 *  Copyright 2024 Collate.
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

import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { getPartialNameFromTableFQN } from './CommonUtils';
import {
  entityDisplayName,
  getBackendFormat,
  getEntityField,
  getEntityFQN,
  getEntityType,
  suggestions,
} from './FeedUtils';

jest.mock('../rest/miscAPI', () => ({
  getSearchedUsers: jest.fn().mockResolvedValue({
    data: {
      hits: {
        hits: [
          {
            _source: {
              entityType: 'User',
              name: 'John Doe',
              deleted: false,
            },
            _id: '1',
          },
        ],
      },
    },
  }),
  getUserSuggestions: jest.fn().mockResolvedValue({
    data: {
      suggest: {
        'metadata-suggest': [
          {
            options: [
              {
                _source: {
                  entityType: 'User',
                  name: 'John Doe',
                  deleted: false,
                },
                _id: '1',
              },
            ],
          },
        ],
      },
    },
  }),
  searchData: jest.fn().mockResolvedValue({
    data: {
      hits: {
        hits: [
          {
            _source: {
              entityType: 'Table',
              name: 'Table1',
              displayName: 'Table 1',
              fullyQualifiedName: 'db.schema.Table1',
            },
            _id: '1',
          },
        ],
      },
    },
  }),
}));

jest.mock('./StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  getDecodedFqn: jest.fn().mockImplementation((fqn) => fqn),
}));

jest.mock('./FeedUtils', () => ({
  ...jest.requireActual('./FeedUtils'),
  getEntityField: jest.fn().mockReturnValue('entityField'),
  getEntityFQN: jest.fn().mockReturnValue('123'),
  getEntityType: jest.fn().mockReturnValue('entityType'),
  buildMentionLink: jest.fn().mockReturnValue('buildMentionLink'),
  getEntityBreadcrumbs: jest.fn().mockReturnValue('entityBreadcrumbs'),
}));

jest.mock('./CommonUtils', () => ({
  getPartialNameFromTableFQN: jest.fn(),
  getEntityPlaceHolder: jest.fn().mockReturnValue('entityPlaceHolder'),
}));

describe('Feed Utils', () => {
  it('should getEntityType return the correct entity type', () => {
    expect(getEntityType('#E::Type::123')).toBe('entityType');
  });

  it('should getEntityFQN return the correct entity FQN', () => {
    expect(getEntityFQN('#E::Type::123')).toBe('123');
  });

  it('should getEntityField return the correct entity field', () => {
    expect(getEntityField('entityField')).toBe('entityField');
  });

  it('should return mention suggestions for "@" mentionChar', async () => {
    const searchTerm = '';
    const mentionChar = '@';

    const result = await suggestions(searchTerm, mentionChar);

    expect(result).toEqual([
      {
        displayName: 'Table 1',
        id: '1',
        value: 'entityPlaceHolder',
        link: 'http://localhost/undefined/Table1',
        name: 'Table1',
        type: 'team',
      },
    ]);
  });

  it('should return correct backend format for a given message', () => {
    const message = `<#E::user::"admin"|[@admin](http://localhost:3000/users/admin)> test`;
    const result = getBackendFormat(message);

    // eslint-disable-next-line no-useless-escape
    const expectedResult = `<#E::user::\"admin\"|<#E::user::admin|[@admin](http://localhost:3000/users/admin)>> test`;

    expect(result).toStrictEqual(expectedResult);
  });

  it('should return correct backend format for a given message having . in username', () => {
    const message = `<#E::user::"admin.test"|[@admin.test](http://localhost:3000/users/%22admin.test%22)> test`;
    const result = getBackendFormat(message);

    // eslint-disable-next-line no-useless-escape
    const expectedResult = `<#E::user::\"admin.test\"|<#E::user::%22admin.test%22|[@admin.test](http://localhost:3000/users/%22admin.test%22)>> test`;

    expect(result).toStrictEqual(expectedResult);
  });

  // entityDisplayName
  it('should call getPartialNameFromTableFQN when entity type is TestSuite', () => {
    const fqn = 'test.testSuite';

    entityDisplayName(EntityType.TEST_SUITE, fqn);

    expect(getPartialNameFromTableFQN).toHaveBeenCalledWith(
      fqn,
      [FqnPart.TestCase],
      FQN_SEPARATOR_CHAR
    );
  });
});
