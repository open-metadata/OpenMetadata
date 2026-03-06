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

import { TestCase } from '../../../generated/tests/testCase';
import {
  filterTestCasesByTableAndColumn,
  getColumnFilterOptions,
  getSelectedOptionsFromKeys,
  getTableFilterOptions,
} from './AddTestCaseList.utils';

jest.mock('../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn((fqn: string) => fqn),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn((link: string) => link),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getColumnNameFromEntityLink: jest.fn((link: string) => {
    const match = link?.match(/::columns::([^>]+)/);

    return match ? match[1] : link;
  }),
}));

const mockTableCase: TestCase = {
  id: 'tc-1',
  name: 'test_1',
  entityLink: '<#E::table::service.db.schema.tableA>',
} as TestCase;

const mockColumnCase1: TestCase = {
  id: 'tc-2',
  name: 'test_2',
  entityLink: '<#E::table::service.db.schema.tableA::columns::col1>',
} as TestCase;

const mockColumnCase2: TestCase = {
  id: 'tc-3',
  name: 'test_3',
  entityLink: '<#E::table::service.db.schema.tableB::columns::col2>',
} as TestCase;

describe('AddTestCaseList.utils', () => {
  describe('getTableFilterOptions', () => {
    it('returns empty array for empty items', () => {
      expect(getTableFilterOptions([])).toEqual([]);
    });

    it('returns one option per unique table FQN', () => {
      const items = [mockTableCase, mockColumnCase1];

      expect(getTableFilterOptions(items)).toEqual([
        { key: mockTableCase.entityLink!, label: mockTableCase.entityLink! },
        {
          key: mockColumnCase1.entityLink!,
          label: mockColumnCase1.entityLink!,
        },
      ]);
    });

    it('deduplicates by table FQN', () => {
      const sameTableLink = mockTableCase.entityLink!;
      const items = [
        mockTableCase,
        { ...mockColumnCase1, entityLink: sameTableLink },
      ];

      expect(getTableFilterOptions(items)).toHaveLength(1);
      expect(getTableFilterOptions(items)[0].key).toBe(sameTableLink);
    });
  });

  describe('getColumnFilterOptions', () => {
    it('returns empty array for empty items', () => {
      expect(getColumnFilterOptions([])).toEqual([]);
    });

    it('returns empty array when no items have column links', () => {
      expect(getColumnFilterOptions([mockTableCase])).toEqual([]);
    });

    it('returns one option per unique table::column key', () => {
      const items = [mockColumnCase1, mockColumnCase2];

      expect(getColumnFilterOptions(items)).toEqual([
        {
          key: `${mockColumnCase1.entityLink!}::col1`,
          label: 'col1',
        },
        {
          key: `${mockColumnCase2.entityLink!}::col2`,
          label: 'col2',
        },
      ]);
    });

    it('deduplicates by table::column key', () => {
      const sameCol = {
        ...mockColumnCase1,
        id: 'tc-4',
        name: 'test_4',
      };
      const items = [mockColumnCase1, sameCol];

      expect(getColumnFilterOptions(items)).toHaveLength(1);
      expect(getColumnFilterOptions(items)[0].label).toBe('col1');
    });
  });

  describe('getSelectedOptionsFromKeys', () => {
    const options = [
      { key: 'k1', label: 'Label 1' },
      { key: 'k2', label: 'Label 2' },
    ];

    it('returns empty array for empty keys', () => {
      expect(
        getSelectedOptionsFromKeys([], options, (k) => `default-${k}`)
      ).toEqual([]);
    });

    it('returns matching options for keys found in options', () => {
      expect(
        getSelectedOptionsFromKeys(['k1', 'k2'], options, (k) => `default-${k}`)
      ).toEqual([
        { key: 'k1', label: 'Label 1' },
        { key: 'k2', label: 'Label 2' },
      ]);
    });

    it('uses getDefaultLabel for keys not in options', () => {
      expect(
        getSelectedOptionsFromKeys(['k1', 'missing'], options, (k) => `fallback-${k}`)
      ).toEqual([
        { key: 'k1', label: 'Label 1' },
        { key: 'missing', label: 'fallback-missing' },
      ]);
    });
  });

  describe('filterTestCasesByTableAndColumn', () => {
    const items = [mockTableCase, mockColumnCase1, mockColumnCase2];

    it('returns all items when no filters applied', () => {
      expect(
        filterTestCasesByTableAndColumn(items, [], [])
      ).toHaveLength(3);
    });

    it('filters by table when filterTables is non-empty', () => {
      const tableKey = mockTableCase.entityLink!;

      expect(
        filterTestCasesByTableAndColumn(items, [tableKey], [])
      ).toEqual([mockTableCase]);
    });

    it('filters by column when filterColumns is non-empty', () => {
      const columnKey = `${mockColumnCase1.entityLink!}::col1`;

      expect(
        filterTestCasesByTableAndColumn(items, [], [columnKey])
      ).toEqual([mockColumnCase1]);
    });

    it('excludes table-only test cases when filtering by column', () => {
      const columnKey = `${mockColumnCase1.entityLink!}::col1`;

      expect(
        filterTestCasesByTableAndColumn(items, [], [columnKey])
      ).not.toContainEqual(mockTableCase);
    });

    it('applies both table and column filters when both provided', () => {
      const tableKey = mockColumnCase1.entityLink!;
      const columnKey = `${mockColumnCase1.entityLink!}::col1`;

      expect(
        filterTestCasesByTableAndColumn(items, [tableKey], [columnKey])
      ).toEqual([mockColumnCase1]);
    });

    it('returns empty array when table filter matches no items', () => {
      expect(
        filterTestCasesByTableAndColumn(items, ['nonexistent.table'], [])
      ).toEqual([]);
    });
  });
});
