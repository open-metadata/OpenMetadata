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
import { TableColumnDropdownList } from '../components/common/Table/Table.interface';
import {
  getCustomizeColumnDetails,
  getReorderedColumns,
} from './CustomizeColumnUtils';

describe('CustomizeColumnUtils', () => {
  describe('getCustomizeColumnDetails', () => {
    it('should return the correct structure for customizable and static columns', () => {
      const columns = [
        { key: 'col1', title: 'Column 1', defaultVisible: true },
        { key: 'col2', title: 'Column 2', defaultVisible: false },
        { key: 'col3', title: 'Column 3' }, // no defaultVisible property
      ];

      const result = getCustomizeColumnDetails(columns);

      expect(result).toEqual({
        staticColumns: ['col3'],
        customizeColumns: ['col1', 'col2'],
        columnDropdownSelections: ['col1'],
        dropdownColumnList: [
          { label: 'Column 1', value: 'col1' },
          { label: 'Column 2', value: 'col2' },
        ],
      });
    });

    it('should return an empty result when no columns are passed', () => {
      const result = getCustomizeColumnDetails([]);

      expect(result).toEqual({
        staticColumns: [],
        customizeColumns: [],
        columnDropdownSelections: [],
        dropdownColumnList: [],
      });
    });

    it('should handle columns without "defaultVisible" correctly', () => {
      const columns = [
        { key: 'col1', title: 'Column 1' },
        { key: 'col2', title: 'Column 2' },
      ];

      const result = getCustomizeColumnDetails(columns);

      expect(result).toEqual({
        staticColumns: ['col1', 'col2'],
        customizeColumns: [],
        columnDropdownSelections: [],
        dropdownColumnList: [],
      });
    });

    it('should handle columns with "defaultVisible" set to false', () => {
      const columns = [
        { key: 'col1', title: 'Column 1', defaultVisible: false },
        { key: 'col2', title: 'Column 2', defaultVisible: false },
      ];

      const result = getCustomizeColumnDetails(columns);

      expect(result).toEqual({
        staticColumns: [],
        customizeColumns: ['col1', 'col2'],
        columnDropdownSelections: [],
        dropdownColumnList: [
          { label: 'Column 1', value: 'col1' },
          { label: 'Column 2', value: 'col2' },
        ],
      });
    });
  });

  describe('getReorderedColumns', () => {
    it('should reorder columns based on updatedColumnDropdownList', () => {
      const updatedColumnDropdownList = [
        { label: 'Column 3' },
        { label: 'Column 1' },
        { label: 'Column 2' },
      ];

      const propsColumns = [
        { title: 'Column 1', key: 'col1' },
        { title: 'Column 2', key: 'col2' },
        { title: 'Column 3', key: 'col3' },
      ];

      const result = getReorderedColumns(
        updatedColumnDropdownList as TableColumnDropdownList[],
        propsColumns
      );

      // The expected order after reordering: Column 3, Column 1, Column 2
      expect(result).toEqual([
        { title: 'Column 3', key: 'col3' },
        { title: 'Column 1', key: 'col1' },
        { title: 'Column 2', key: 'col2' },
      ]);
    });

    it('should handle columns in the same order if the dropdown list matches the initial order', () => {
      const updatedColumnDropdownList = [
        { label: 'Column 1' },
        { label: 'Column 2' },
        { label: 'Column 3' },
      ];

      const propsColumns = [
        { title: 'Column 1', key: 'col1' },
        { title: 'Column 2', key: 'col2' },
        { title: 'Column 3', key: 'col3' },
      ];

      const result = getReorderedColumns(
        updatedColumnDropdownList as TableColumnDropdownList[],
        propsColumns
      );

      // The order should stay the same because the updated list matches the initial order
      expect(result).toEqual(propsColumns);
    });

    it('should return the same columns if the updatedColumnDropdownList is empty', () => {
      const updatedColumnDropdownList: TableColumnDropdownList[] = [];

      const propsColumns = [
        { title: 'Column 1', key: 'col1' },
        { title: 'Column 2', key: 'col2' },
        { title: 'Column 3', key: 'col3' },
      ];

      const result = getReorderedColumns(
        updatedColumnDropdownList,
        propsColumns
      );

      // No change should happen when the dropdown list is empty
      expect(result).toEqual(propsColumns);
    });

    it('should return an empty array when both inputs are empty', () => {
      const updatedColumnDropdownList: TableColumnDropdownList[] = [];
      const propsColumns: {
        title: string;
        key: string;
      }[] = [];

      const result = getReorderedColumns(
        updatedColumnDropdownList,
        propsColumns
      );

      // No columns to reorder
      expect(result).toEqual([]);
    });

    it('should handle missing columns in updatedColumnDropdownList', () => {
      const updatedColumnDropdownList = [
        { label: 'Column 3' },
        { label: 'Column 2' },
      ];

      const propsColumns = [
        { title: 'Column 1', key: 'col1' },
        { title: 'Column 2', key: 'col2' },
        { title: 'Column 3', key: 'col3' },
      ];

      const result = getReorderedColumns(
        updatedColumnDropdownList as TableColumnDropdownList[],
        propsColumns
      );

      // Column 1 should be placed last, as it's not in the updated list
      expect(result).toEqual([
        { title: 'Column 1', key: 'col1' },
        { title: 'Column 3', key: 'col3' },
        { title: 'Column 2', key: 'col2' },
      ]);
    });
  });
});
