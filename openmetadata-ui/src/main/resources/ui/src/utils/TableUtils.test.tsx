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
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { TagLabel } from '../generated/entity/data/container';
import { Column, DataType } from '../generated/entity/data/table';
import {
  ExtraTableDropdownOptions,
  findColumnByEntityLink,
  getEntityIcon,
  getExpandAllKeysToDepth,
  getSafeExpandAllKeys,
  getSchemaDepth,
  getSchemaFieldCount,
  getTagsWithoutTier,
  getTierTags,
  isLargeSchema,
  pruneEmptyChildren,
  shouldCollapseSchema,
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

// Mock EntityLink methods
jest.mock('./EntityLink', () => ({
  getTableColumnNameFromColumnFqn: jest.fn(),
  getTableEntityLink: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

const navigate = jest.fn();

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

      const result = ExtraTableDropdownOptions(
        'tableFqn',
        permission,
        false,
        navigate
      );

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('import-button');
    });

    it('should render export button when user has viewAll permission', () => {
      const permission = {
        ViewAll: true,
        EditAll: false,
      } as OperationPermission;

      const result = ExtraTableDropdownOptions(
        'tableFqn',
        permission,
        false,
        navigate
      );

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('export-button');
    });

    it('should render both button when user has viewAll & editAll permission', () => {
      const permission = {
        ViewAll: true,
        EditAll: true,
      } as OperationPermission;

      const result = ExtraTableDropdownOptions(
        'tableFqn',
        permission,
        false,
        navigate
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
      const result = ExtraTableDropdownOptions(
        'tableFqn',
        permission,
        false,
        navigate
      );

      expect(result).toHaveLength(0);
      expect(result).toStrictEqual([]);
    });

    it('should not render any buttons when the entity is deleted', () => {
      const permission = {
        ViewAll: true,
        EditAll: true,
      } as OperationPermission;
      const result = ExtraTableDropdownOptions(
        'tableFqn',
        permission,
        true,
        navigate
      );

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

  describe('Schema Performance Functions', () => {
    // Mock field structure for testing
    type MockField = { name?: string; children?: MockField[] };

    const mockNestedFields: MockField[] = [
      {
        name: 'level1_field1',
        children: [
          {
            name: 'level2_field1',
            children: [{ name: 'level3_field1' }, { name: 'level3_field2' }],
          },
          {
            name: 'level2_field2',
            children: [{ name: 'level3_field3' }],
          },
        ],
      },
      {
        name: 'level1_field2',
        children: [
          {
            name: 'level2_field3',
            children: [{ name: 'level3_field4' }, { name: 'level3_field5' }],
          },
        ],
      },
      {
        name: 'level1_field3',
      },
    ];

    describe('getSchemaFieldCount', () => {
      it('should count all fields in a flat structure', () => {
        const flatFields: MockField[] = [
          { name: 'field1' },
          { name: 'field2' },
          { name: 'field3' },
        ];

        expect(getSchemaFieldCount(flatFields)).toBe(3);
      });

      it('should count all fields recursively in nested structure', () => {
        expect(getSchemaFieldCount(mockNestedFields)).toBe(11); // 3 level1 + 3 level2 + 5 level3 = 11 total fields
      });

      it('should return 0 for empty array', () => {
        expect(getSchemaFieldCount([])).toBe(0);
      });

      it('should handle fields without children property', () => {
        const fieldsWithoutChildren: MockField[] = [
          { name: 'field1' },
          { name: 'field2', children: undefined },
        ];

        expect(getSchemaFieldCount(fieldsWithoutChildren)).toBe(2);
      });
    });

    describe('getSchemaDepth', () => {
      it('should return 0 for empty array', () => {
        expect(getSchemaDepth([])).toBe(0);
      });

      it('should return 1 for flat structure', () => {
        const flatFields: MockField[] = [
          { name: 'field1' },
          { name: 'field2' },
        ];

        expect(getSchemaDepth(flatFields)).toBe(1);
      });

      it('should calculate correct depth for nested structure', () => {
        expect(getSchemaDepth(mockNestedFields)).toBe(3); // 3 levels deep
      });

      it('should handle mixed depth structure correctly', () => {
        const mixedDepthFields: MockField[] = [
          {
            name: 'shallow',
            children: [{ name: 'level2' }],
          },
          {
            name: 'deep',
            children: [
              {
                name: 'level2',
                children: [
                  {
                    name: 'level3',
                    children: [{ name: 'level4' }],
                  },
                ],
              },
            ],
          },
        ];

        expect(getSchemaDepth(mixedDepthFields)).toBe(4); // Should return maximum depth
      });
    });

    describe('isLargeSchema', () => {
      it('should return false for small schemas', () => {
        const smallFields: MockField[] = Array.from({ length: 10 }, (_, i) => ({
          name: `field${i}`,
        }));

        expect(isLargeSchema(smallFields)).toBe(false);
      });

      it('should return true for large schemas with default threshold', () => {
        const largeFields: MockField[] = Array.from(
          { length: 600 },
          (_, i) => ({
            name: `field${i}`,
          })
        );

        expect(isLargeSchema(largeFields)).toBe(true);
      });

      it('should respect custom threshold', () => {
        const fields: MockField[] = Array.from({ length: 100 }, (_, i) => ({
          name: `field${i}`,
        }));

        expect(isLargeSchema(fields, 50)).toBe(true);
        expect(isLargeSchema(fields, 150)).toBe(false);
      });
    });

    describe('shouldCollapseSchema', () => {
      it('should return false for small schemas', () => {
        const smallFields: MockField[] = Array.from({ length: 10 }, (_, i) => ({
          name: `field${i}`,
        }));

        expect(shouldCollapseSchema(smallFields)).toBe(false);
      });

      it('should return true for schemas above default threshold', () => {
        const largeFields: MockField[] = Array.from({ length: 60 }, (_, i) => ({
          name: `field${i}`,
        }));

        expect(shouldCollapseSchema(largeFields)).toBe(true);
      });

      it('should respect custom threshold', () => {
        const fields: MockField[] = Array.from({ length: 30 }, (_, i) => ({
          name: `field${i}`,
        }));

        expect(shouldCollapseSchema(fields, 20)).toBe(true);
        expect(shouldCollapseSchema(fields, 40)).toBe(false);
      });
    });

    describe('getExpandAllKeysToDepth', () => {
      it('should return empty array for empty fields', () => {
        expect(getExpandAllKeysToDepth([], 2)).toEqual([]);
      });

      it('should return all expandable keys up to specified depth', () => {
        const result = getExpandAllKeysToDepth(mockNestedFields, 2);

        // Should include level 1 and level 2 fields that have children
        expect(result).toContain('level1_field1');
        expect(result).toContain('level1_field2');
        expect(result).toContain('level2_field1');
        expect(result).toContain('level2_field2');
        expect(result).toContain('level2_field3');

        // Should not include level 3 fields (depth 2 stops before level 3)
        expect(result).not.toContain('level3_field1');
        expect(result).not.toContain('level3_field2');
      });

      it('should respect depth limit', () => {
        const result1 = getExpandAllKeysToDepth(mockNestedFields, 1);
        const result2 = getExpandAllKeysToDepth(mockNestedFields, 3);

        // Depth 1 should only include top-level expandable fields
        expect(result1).toContain('level1_field1');
        expect(result1).toContain('level1_field2');
        expect(result1).not.toContain('level2_field1');

        // Depth 3 should include all expandable fields
        expect(result2).toContain('level1_field1');
        expect(result2).toContain('level2_field1');
        expect(result2.length).toBeGreaterThan(result1.length);
      });

      it('should not include fields without children', () => {
        const result = getExpandAllKeysToDepth(mockNestedFields, 2);

        // level1_field3 has no children, so should not be included
        expect(result).not.toContain('level1_field3');
      });
    });

    describe('getSafeExpandAllKeys', () => {
      it('should return all keys for small schemas', () => {
        const allKeys = ['key1', 'key2', 'key3'];
        const smallFields: MockField[] = [{ name: 'field1' }];

        const result = getSafeExpandAllKeys(smallFields, false, allKeys);

        expect(result).toEqual(allKeys);
      });

      it('should return limited keys for large schemas', () => {
        const allKeys = ['key1', 'key2', 'key3', 'key4', 'key5'];

        const result = getSafeExpandAllKeys(mockNestedFields, true, allKeys);

        // Should return depth-limited keys, not all keys
        expect(result).not.toEqual(allKeys);
        expect(result.length).toBeLessThanOrEqual(allKeys.length);
      });

      it('should use depth-based expansion for large schemas', () => {
        const allKeys = [
          'level1_field1',
          'level1_field2',
          'level2_field1',
          'level2_field2',
        ];

        const result = getSafeExpandAllKeys(mockNestedFields, true, allKeys);

        // Should include top-level and second-level expandable fields
        expect(result).toContain('level1_field1');
        expect(result).toContain('level1_field2');
        expect(result).toContain('level2_field1');
      });
    });
  });
});
