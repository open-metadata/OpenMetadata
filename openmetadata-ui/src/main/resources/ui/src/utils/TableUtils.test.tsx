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
import React from 'react';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { TagLabel } from '../generated/entity/data/container';
import { Column, DataType } from '../generated/entity/data/table';
import {
  ExtraTableDropdownOptions,
  findColumnByEntityLink,
  getEntityIcon,
  getTagsWithoutTier,
  getTierTags,
  pruneEmptyChildren,
  updateColumnInNestedStructure,
} from '../utils/TableUtils';
import EntityLink from './EntityLink';

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
  useHistory: jest.fn(),
}));

// Mock EntityLink methods
jest.mock('./EntityLink', () => ({
  getTableColumnNameFromColumnFqn: jest.fn(),
  getTableEntityLink: jest.fn(),
}));

describe('TableUtils', () => {
  it('getTierTags should return the correct usage percentile', () => {
    const tags = [
      { tagFQN: 'Tier.Tier1' },
      { tagFQN: 'RandomTag' },
      { tagFQN: 'OtherTag' },
    ] as TagLabel[];
    const result = getTierTags(tags);

    expect(result).toStrictEqual({ tagFQN: 'Tier.Tier1' });
  });

  it('getTagsWithoutTier should return the tier tag FQN', () => {
    const tags = [
      { tagFQN: 'Tier.Gold' },
      { tagFQN: 'RandomTag' },
      { tagFQN: 'OtherTag' },
    ];
    const result = getTagsWithoutTier(tags);

    expect(result).toStrictEqual([
      { tagFQN: 'RandomTag' },
      { tagFQN: 'OtherTag' },
    ]);
  });

  it('getEntityIcon should return null if no icon is found', () => {
    const result = getEntityIcon('entity');

    expect(result).toBeNull();
  });

  describe('findColumnByEntityLink', () => {
    const mockTableFqn = 'sample_data.ecommerce_db.shopify.dim_location';
    const mockEntityLink =
      '<#E::table::sample_data.ecommerce_db.shopify.dim_location::columns::column1>';

    beforeEach(() => {
      jest.clearAllMocks();
      (
        EntityLink.getTableColumnNameFromColumnFqn as jest.Mock
      ).mockImplementation((fqn) => fqn.split('.').pop() || '');
      (EntityLink.getTableEntityLink as jest.Mock).mockImplementation(
        (tableFqn, columnName) =>
          `<#E::table::${tableFqn}::columns::${columnName}>`
      );
    });

    it('should find a column by entity link in a flat structure', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column1',
        } as Column,
        {
          name: 'column2',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column2',
        } as Column,
      ];

      const result = findColumnByEntityLink(
        mockTableFqn,
        columns,
        mockEntityLink
      );

      expect(result).toEqual(columns[0]);
      expect(EntityLink.getTableColumnNameFromColumnFqn).toHaveBeenCalledWith(
        'sample_data.ecommerce_db.shopify.dim_location.column1',
        false
      );
      expect(EntityLink.getTableEntityLink).toHaveBeenCalledWith(
        mockTableFqn,
        'column1'
      );
    });

    it('should return null if no matching column is found', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column1',
        } as Column,
      ];

      const nonExistentEntityLink =
        '<#E::table::sample_data.ecommerce_db.shopify.dim_location::columns::nonExistentColumn>';

      const result = findColumnByEntityLink(
        mockTableFqn,
        columns,
        nonExistentEntityLink
      );

      expect(result).toBeNull();
    });
  });

  describe('updateColumnInNestedStructure', () => {
    it('should update a column in a flat structure', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column1',
          description: 'old description',
        } as Column,
        {
          name: 'column2',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column2',
          description: 'description 2',
        } as Column,
      ];

      const targetFqn = 'sample_data.ecommerce_db.shopify.dim_location.column1';
      const update = { description: 'new description' };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].description).toBe('new description');
      expect(result[1].description).toBe('description 2');
    });

    it('should update a column in a nested structure', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column1',
          description: 'description 1',
        } as Column,
        {
          name: 'parentColumn',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.parentColumn',
          description: 'parent description',
          children: [
            {
              name: 'nestedColumn',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_location.parentColumn.nestedColumn',
              description: 'nested description',
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn =
        'sample_data.ecommerce_db.shopify.dim_location.parentColumn.nestedColumn';
      const update = { description: 'updated nested description' };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].description).toBe('description 1');
      expect(result[1].description).toBe('parent description');
      expect(result[1].children?.[0].description).toBe(
        'updated nested description'
      );
    });

    it('should return the original columns if no matching column is found', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_location.column1',
          description: 'description 1',
        } as Column,
      ];

      const nonExistentFqn =
        'sample_data.ecommerce_db.shopify.dim_location.nonExistentColumn';
      const update = { description: 'new description' };

      const result = updateColumnInNestedStructure(
        columns,
        nonExistentFqn,
        update
      );

      expect(result).toEqual(columns);
    });
  });

  describe('ExtraTableDropdownOptions', () => {
    it('should render import button when user has editAll permission', () => {
      const permission = {
        ViewAll: false,
        EditAll: true,
      } as OperationPermission;

      const result = ExtraTableDropdownOptions('tableFqn', permission, false);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('import-button');
    });

    it('should render export button when user has viewAll permission', () => {
      const permission = {
        ViewAll: true,
        EditAll: false,
      } as OperationPermission;

      const result = ExtraTableDropdownOptions('tableFqn', permission, false);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('export-button');
    });

    it('should render both button when user has viewAll & editAll permission', () => {
      const permission = {
        ViewAll: true,
        EditAll: true,
      } as OperationPermission;

      const result = ExtraTableDropdownOptions('tableFqn', permission, false);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('import-button');
      expect(result[1].key).toBe('export-button');
    });

    it('should not render any buttons when user has neither viewAll nor editAll permission', () => {
      const permission = {
        ViewAll: false,
        EditAll: false,
      } as OperationPermission;
      const result = ExtraTableDropdownOptions('tableFqn', permission, false);

      expect(result).toHaveLength(0);
      expect(result).toStrictEqual([]);
    });

    it('should not render any buttons when the entity is deleted', () => {
      const permission = {
        ViewAll: true,
        EditAll: true,
      } as OperationPermission;
      const result = ExtraTableDropdownOptions('tableFqn', permission, true);

      expect(result).toHaveLength(0);
      expect(result).toStrictEqual([]);
    });
  });

  describe('pruneEmptyChildren', () => {
    it('should remove children property when children array is empty', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          dataType: DataType.String,
          children: [],
        } as Column,
        {
          name: 'column2',
          dataType: DataType.Int,
          children: [],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).not.toHaveProperty('children');
      expect(result[1]).not.toHaveProperty('children');
      expect(result[0].name).toBe('column1');
      expect(result[1].name).toBe('column2');
    });

    it('should keep children property when children array has items', () => {
      const columns: Column[] = [
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          children: [
            {
              name: 'childColumn1',
              dataType: DataType.String,
            } as Column,
          ],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).toHaveProperty('children');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].name).toBe('childColumn1');
    });

    it('should handle columns without children property', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          dataType: DataType.String,
        } as Column,
        {
          name: 'column2',
          dataType: DataType.Int,
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).not.toHaveProperty('children');
      expect(result[1]).not.toHaveProperty('children');
      expect(result[0].name).toBe('column1');
      expect(result[1].name).toBe('column2');
    });

    it('should handle mixed columns with and without empty children', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          dataType: DataType.String,
          children: [],
        } as Column,
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          children: [
            {
              name: 'childColumn1',
              dataType: DataType.String,
            } as Column,
          ],
        } as Column,
        {
          name: 'column3',
          dataType: DataType.Int,
        } as Column,
        {
          name: 'column4',
          dataType: DataType.Boolean,
          children: [],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).not.toHaveProperty('children');
      expect(result[1]).toHaveProperty('children');
      expect(result[1].children).toHaveLength(1);
      expect(result[2]).not.toHaveProperty('children');
      expect(result[3]).not.toHaveProperty('children');
    });

    it('should handle nested empty children recursively', () => {
      const columns: Column[] = [
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          children: [
            {
              name: 'childColumn1',
              dataType: DataType.String,
              children: [],
            } as Column,
            {
              name: 'childColumn2',
              dataType: DataType.Int,
              children: [
                {
                  name: 'grandchildColumn',
                  dataType: DataType.Boolean,
                  children: [],
                } as Column,
              ],
            } as Column,
          ],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).toHaveProperty('children');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children?.[0]).not.toHaveProperty('children');
      expect(result[0].children?.[1]).toHaveProperty('children');
      expect(result[0].children?.[1].children?.[0]).not.toHaveProperty(
        'children'
      );
    });

    it('should return empty array when input is empty', () => {
      const columns: Column[] = [];

      const result = pruneEmptyChildren(columns);

      expect(result).toEqual([]);
    });

    it('should preserve all other column properties', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          dataType: DataType.String,
          description: 'Test description',
          displayName: 'Test Display Name',
          fullyQualifiedName: 'test.table.column1',
          ordinalPosition: 1,
          precision: 10,
          scale: 2,
          dataLength: 255,
          children: [],
          tags: [],
          customMetrics: [],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).not.toHaveProperty('children');
      expect(result[0].name).toBe('column1');
      expect(result[0].dataType).toBe(DataType.String);
      expect(result[0].description).toBe('Test description');
      expect(result[0].displayName).toBe('Test Display Name');
      expect(result[0].fullyQualifiedName).toBe('test.table.column1');
      expect(result[0].ordinalPosition).toBe(1);
      expect(result[0].precision).toBe(10);
      expect(result[0].scale).toBe(2);
      expect(result[0].dataLength).toBe(255);
      expect(result[0].tags).toEqual([]);
      expect(result[0].customMetrics).toEqual([]);
    });

    it('should handle complex nested structure with multiple empty children levels', () => {
      const columns: Column[] = [
        {
          name: 'level1',
          dataType: DataType.Struct,
          children: [
            {
              name: 'level2a',
              dataType: DataType.Struct,
              children: [],
            } as Column,
            {
              name: 'level2b',
              dataType: DataType.Struct,
              children: [
                {
                  name: 'level3a',
                  dataType: DataType.String,
                  children: [],
                } as Column,
                {
                  name: 'level3b',
                  dataType: DataType.Int,
                  children: [
                    {
                      name: 'level4',
                      dataType: DataType.Boolean,
                      children: [],
                    } as Column,
                  ],
                } as Column,
              ],
            } as Column,
          ],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).toHaveProperty('children');
      expect(result[0].children).toHaveLength(2);

      // level2a should have children removed
      expect(result[0].children?.[0]).not.toHaveProperty('children');

      // level2b should keep children
      expect(result[0].children?.[1]).toHaveProperty('children');
      expect(result[0].children?.[1].children).toHaveLength(2);

      // level3a should have children removed
      expect(result[0].children?.[1].children?.[0]).not.toHaveProperty(
        'children'
      );

      // level3b should keep children but level4 should have children removed
      expect(result[0].children?.[1].children?.[1]).toHaveProperty('children');
      expect(
        result[0].children?.[1].children?.[1].children?.[0]
      ).not.toHaveProperty('children');
    });

    it('should handle columns with undefined children property', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          dataType: DataType.String,
          children: undefined,
        } as Column,
        {
          name: 'column2',
          dataType: DataType.Int,
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).not.toHaveProperty('children');
      expect(result[1]).not.toHaveProperty('children');
      expect(result[0].name).toBe('column1');
      expect(result[1].name).toBe('column2');
    });

    it('should handle columns with null children property', () => {
      const columns: Column[] = [
        {
          name: 'column1',
          dataType: DataType.String,
          children: null as any,
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).not.toHaveProperty('children');
      expect(result[0].name).toBe('column1');
    });

    it('should handle deeply nested structure where all children become empty after pruning', () => {
      const columns: Column[] = [
        {
          name: 'parent',
          dataType: DataType.Struct,
          children: [
            {
              name: 'child1',
              dataType: DataType.Struct,
              children: [
                {
                  name: 'grandchild1',
                  dataType: DataType.String,
                  children: [],
                } as Column,
                {
                  name: 'grandchild2',
                  dataType: DataType.Int,
                  children: [],
                } as Column,
              ],
            } as Column,
            {
              name: 'child2',
              dataType: DataType.Struct,
              children: [
                {
                  name: 'grandchild3',
                  dataType: DataType.Boolean,
                  children: [],
                } as Column,
              ],
            } as Column,
          ],
        } as Column,
      ];

      const result = pruneEmptyChildren(columns);

      expect(result[0]).toHaveProperty('children');
      expect(result[0].children).toHaveLength(2);

      // child1 should keep children but grandchildren should have children removed
      expect(result[0].children?.[0]).toHaveProperty('children');
      expect(result[0].children?.[0].children).toHaveLength(2);
      expect(result[0].children?.[0].children?.[0]).not.toHaveProperty(
        'children'
      );
      expect(result[0].children?.[0].children?.[1]).not.toHaveProperty(
        'children'
      );

      // child2 should keep children but grandchild should have children removed
      expect(result[0].children?.[1]).toHaveProperty('children');
      expect(result[0].children?.[1].children).toHaveLength(1);
      expect(result[0].children?.[1].children?.[0]).not.toHaveProperty(
        'children'
      );
    });
  });
});
