/*
 *  Copyright 2025 Collate.
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
import { useNavigate } from 'react-router-dom';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import {
  buildSchemaQueryFilter,
  ExtraDatabaseSchemaDropdownOptions,
} from './DatabaseSchemaDetailsUtils';

jest.mock(
  '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn().mockReturnValue({
      showModal: jest.fn(),
    }),
  })
);
jest.mock(
  '../components/common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(() => <div>ManageButtonItemLabel</div>),
  })
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

const mockNavigate = jest.fn();

describe('buildSchemaQueryFilter', () => {
  it('should return a filter with only the field term when no searchValue is provided', () => {
    const result = buildSchemaQueryFilter(
      'service.fullyQualifiedName.keyword',
      'my-service'
    );

    expect(result).toEqual({
      query: {
        bool: {
          must: [
            { term: { 'service.fullyQualifiedName.keyword': 'my-service' } },
          ],
        },
      },
    });
  });

  it('should include displayName and name wildcard should-queries when searchValue is provided', () => {
    const result = buildSchemaQueryFilter(
      'service.fullyQualifiedName.keyword',
      'my-service',
      'PowerBI'
    );

    expect(result).toEqual({
      query: {
        bool: {
          must: [
            { term: { 'service.fullyQualifiedName.keyword': 'my-service' } },
            {
              bool: {
                should: [
                  { wildcard: { 'displayName.keyword': '*PowerBI*' } },
                  { wildcard: { 'name.keyword': '*PowerBI*' } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    });
  });

  it('should preserve the original casing of the search value in wildcard patterns', () => {
    const result = buildSchemaQueryFilter(
      'service.fullyQualifiedName.keyword',
      'my-service',
      'PowerBIBigquery'
    );

    const mustClauses = result.query.bool.must as Record<string, unknown>[];
    const nestedBool = mustClauses.find((clause) => 'bool' in clause) as {
      bool: { should: { wildcard: Record<string, string> }[] };
    };

    nestedBool.bool.should.forEach((s) => {
      const value = Object.values(s.wildcard)[0];

      expect(value).toBe('*PowerBIBigquery*');
    });
  });

  it('should search across displayName.keyword and name.keyword fields only', () => {
    const result = buildSchemaQueryFilter(
      'service.fullyQualifiedName.keyword',
      'my-service',
      'test'
    );

    const mustClauses = result.query.bool.must as Record<string, unknown>[];
    const nestedBool = mustClauses.find((clause) => 'bool' in clause) as {
      bool: { should: { wildcard: Record<string, string> }[] };
    };

    const searchedFields = nestedBool.bool.should.map(
      (s) => Object.keys(s.wildcard)[0]
    );

    expect(searchedFields).toEqual(['displayName.keyword', 'name.keyword']);
  });
});

describe('ExtraDatabaseSchemaDropdownOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  it('should render import button when user has editAll permission', () => {
    const permission = {
      ViewAll: false,
      EditAll: true,
    } as OperationPermission;

    const result = ExtraDatabaseSchemaDropdownOptions(
      'databaseSchemaFqn',
      permission,
      false,
      mockNavigate
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('import-button');
  });

  it('should render export button when user has viewAll permission', () => {
    const permission = {
      ViewAll: true,
      EditAll: false,
    } as OperationPermission;

    const result = ExtraDatabaseSchemaDropdownOptions(
      'databaseSchemaFqn',
      permission,
      false,
      mockNavigate
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('export-button');
  });

  it('should render both button when user has viewAll & editAll permission', () => {
    const permission = {
      ViewAll: true,
      EditAll: true,
    } as OperationPermission;

    const result = ExtraDatabaseSchemaDropdownOptions(
      'databaseSchemaFqn',
      permission,
      false,
      mockNavigate
    );

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('import-button');
    expect(result[1].key).toBe('export-button');
  });

  it('should not render any buttons when user has neither viewAll nor editAll permission', () => {
    const permission = {
      ViewAll: false,
      EditAll: false,
    } as OperationPermission;
    const result = ExtraDatabaseSchemaDropdownOptions(
      'databaseSchemaFqn',
      permission,
      false,
      mockNavigate
    );

    expect(result).toHaveLength(0);
    expect(result).toStrictEqual([]);
  });

  it('should not render any buttons when the entity is deleted', () => {
    const permission = {
      ViewAll: true,
      EditAll: true,
    } as OperationPermission;
    const result = ExtraDatabaseSchemaDropdownOptions(
      'databaseSchemaFqn',
      permission,
      true,
      mockNavigate
    );

    expect(result).toHaveLength(0);
    expect(result).toStrictEqual([]);
  });
});
