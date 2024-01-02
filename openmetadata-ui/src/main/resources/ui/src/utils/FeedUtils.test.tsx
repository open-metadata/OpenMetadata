import {
  getEntityField,
  getEntityFQN,
  getEntityType,
  suggestions,
} from './FeedUtils';

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
  getSuggestions: jest.fn().mockResolvedValue({
    data: {
      suggest: {
        'metadata-suggest': [
          {
            options: [
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
        ],
      },
    },
  }),
}));

jest.mock('./StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
}));

jest.mock('./TableUtils', () => ({
  getEntityLink: jest.fn(),
}));

jest.mock('./FeedUtils', () => ({
  ...jest.requireActual('./FeedUtils'),
  getEntityField: jest.fn().mockReturnValue('entityField'),
  getEntityFQN: jest.fn().mockReturnValue('123'),
  getEntityType: jest.fn().mockReturnValue('entityType'),
  getEntityPlaceHolder: jest.fn().mockReturnValue('entityPlaceHolder'),
  buildMentionLink: jest.fn().mockReturnValue('buildMentionLink'),
  getEntityBreadcrumbs: jest.fn().mockReturnValue('entityBreadcrumbs'),
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
        id: '1',
        value: '@John Doe',
        link: 'http://localhost/undefined/John Doe',
        type: 'team',
        name: 'John Doe',
      },
    ]);
  });
});
