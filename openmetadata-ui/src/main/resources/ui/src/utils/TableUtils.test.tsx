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
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { TagLabel } from '../generated/entity/data/container';
import { Column, DataType, Table } from '../generated/entity/data/table';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State, TagSource } from '../generated/type/tagLabel';
import { MOCK_TABLE, MOCK_TABLE_DBT } from '../mocks/TableData.mock';
import {
  extractColumnsFromData,
  ExtraTableDropdownOptions,
  fieldExistsByFQN,
  findColumnByEntityLink,
  getColumnOptionsFromTableColumn,
  getEntityIcon,
  getExpandAllKeysToDepth,
  getHighlightedRowClassName,
  getNestedSectionTitle,
  getParentKeysToExpand,
  getSafeExpandAllKeys,
  getSchemaDepth,
  getSchemaFieldCount,
  getTableDetailPageBaseTabs,
  getTagsWithoutTier,
  getTierTags,
  isLargeSchema,
  normalizeTags,
  pruneEmptyChildren,
  shouldCollapseSchema,
  updateColumnInNestedStructure,
  updateFieldExtension,
} from '../utils/TableUtils';
import EntityLink from './EntityLink';
import { TableDetailPageTabProps } from './TableClassBase';
import { extractTableColumns } from './TableUtils';
import { TableFieldsInfoCommonEntities } from './TableUtils.interface';

type ParentFieldObject = {
  fullyQualifiedName?: string;
  children?: ParentFieldObject[];
  name?: string;
};

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

    it('should update a deeply nested column (3 levels deep)', () => {
      const columns: Column[] = [
        {
          name: 'level1',
          dataType: DataType.Struct,
          fullyQualifiedName: 'table.level1',
          description: 'level 1 description',
          children: [
            {
              name: 'level2',
              dataType: DataType.Struct,
              fullyQualifiedName: 'table.level1.level2',
              description: 'level 2 description',
              children: [
                {
                  name: 'level3',
                  dataType: DataType.String,
                  fullyQualifiedName: 'table.level1.level2.level3',
                  description: 'original deep description',
                } as Column,
              ],
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn = 'table.level1.level2.level3';
      const update = { description: 'updated deep description' };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].description).toBe('level 1 description');
      expect(result[0].children?.[0].description).toBe('level 2 description');
      expect(result[0].children?.[0].children?.[0].description).toBe(
        'updated deep description'
      );
    });

    it('should update tags on a nested column', () => {
      const columns: Column[] = [
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          fullyQualifiedName: 'table.parentColumn',
          tags: [],
          children: [
            {
              name: 'childColumn',
              dataType: DataType.String,
              fullyQualifiedName: 'table.parentColumn.childColumn',
              tags: [],
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn = 'table.parentColumn.childColumn';
      const update = {
        tags: [
          {
            tagFQN: 'PII.Sensitive',
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ] as TagLabel[],
      };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].children?.[0].tags).toHaveLength(1);
      expect(result[0].children?.[0].tags?.[0].tagFQN).toBe('PII.Sensitive');
    });

    it('should update displayName on a nested column', () => {
      const columns: Column[] = [
        {
          name: 'products',
          dataType: DataType.Array,
          fullyQualifiedName: 'table.products',
          children: [
            {
              name: 'product_id',
              dataType: DataType.String,
              fullyQualifiedName: 'table.products.product_id',
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn = 'table.products.product_id';
      const update = { displayName: 'Product Identifier' };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].children?.[0].displayName).toBe('Product Identifier');
    });

    it('should update multiple properties on a nested column at once', () => {
      const columns: Column[] = [
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          fullyQualifiedName: 'table.parentColumn',
          children: [
            {
              name: 'childColumn',
              dataType: DataType.String,
              fullyQualifiedName: 'table.parentColumn.childColumn',
              description: 'old description',
              tags: [],
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn = 'table.parentColumn.childColumn';
      const update = {
        description: 'new description',
        displayName: 'Child Column Display',
        tags: [
          {
            tagFQN: 'Test.Tag',
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ] as TagLabel[],
      };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].children?.[0].description).toBe('new description');
      expect(result[0].children?.[0].displayName).toBe('Child Column Display');
      expect(result[0].children?.[0].tags).toHaveLength(1);
    });

    it('should not modify other nested columns when updating one', () => {
      const columns: Column[] = [
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          fullyQualifiedName: 'table.parentColumn',
          children: [
            {
              name: 'child1',
              dataType: DataType.String,
              fullyQualifiedName: 'table.parentColumn.child1',
              description: 'child 1 description',
            } as Column,
            {
              name: 'child2',
              dataType: DataType.String,
              fullyQualifiedName: 'table.parentColumn.child2',
              description: 'child 2 description',
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn = 'table.parentColumn.child1';
      const update = { description: 'updated child 1 description' };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].children?.[0].description).toBe(
        'updated child 1 description'
      );
      expect(result[0].children?.[1].description).toBe('child 2 description');
    });

    it('should preserve the children property when updating a parent column', () => {
      const columns: Column[] = [
        {
          name: 'parentColumn',
          dataType: DataType.Struct,
          fullyQualifiedName: 'table.parentColumn',
          description: 'old parent description',
          children: [
            {
              name: 'childColumn',
              dataType: DataType.String,
              fullyQualifiedName: 'table.parentColumn.childColumn',
              description: 'child description',
            } as Column,
          ],
        } as Column,
      ];

      const targetFqn = 'table.parentColumn';
      const update = { description: 'new parent description' };

      const result = updateColumnInNestedStructure(columns, targetFqn, update);

      expect(result[0].description).toBe('new parent description');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].description).toBe('child description');
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

  describe('normalizeTags', () => {
    it('should remove style property from glossary terms', () => {
      const tags: TagLabel[] = [
        {
          tagFQN: 'glossary.term1',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#FF0000' },
        } as TagLabel,
        {
          tagFQN: 'glossary.term2',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#00FF00' },
        } as TagLabel,
      ];

      const result = normalizeTags(tags);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('style');
      expect(result[1]).not.toHaveProperty('style');
      expect(result[0].tagFQN).toBe('glossary.term1');
      expect(result[1].tagFQN).toBe('glossary.term2');
    });

    it('should keep style property for classification tags', () => {
      const tags: TagLabel[] = [
        {
          tagFQN: 'Classification.Tag1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#FF0000' },
        } as TagLabel,
        {
          tagFQN: 'Classification.Tag2',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#00FF00' },
        } as TagLabel,
      ];

      const result = normalizeTags(tags);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('style');
      expect(result[1]).toHaveProperty('style');
      expect(result[0].style).toEqual({ color: '#FF0000' });
      expect(result[1].style).toEqual({ color: '#00FF00' });
    });

    it('should handle mixed glossary and classification tags', () => {
      const tags: TagLabel[] = [
        {
          tagFQN: 'glossary.term1',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#FF0000' },
        } as TagLabel,
        {
          tagFQN: 'Classification.Tag1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#00FF00' },
        } as TagLabel,
        {
          tagFQN: 'glossary.term2',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#0000FF' },
        } as TagLabel,
      ];

      const result = normalizeTags(tags);

      expect(result).toHaveLength(3);
      // Glossary terms should not have style
      expect(result[0]).not.toHaveProperty('style');
      expect(result[2]).not.toHaveProperty('style');
      // Classification tag should have style
      expect(result[1]).toHaveProperty('style');
      expect(result[1].style).toEqual({ color: '#00FF00' });
    });

    it('should handle tags without style property', () => {
      const tags: TagLabel[] = [
        {
          tagFQN: 'glossary.term1',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        } as TagLabel,
        {
          tagFQN: 'Classification.Tag1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        } as TagLabel,
      ];

      const result = normalizeTags(tags);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('style');
      expect(result[1]).not.toHaveProperty('style');
    });

    it('should handle empty array', () => {
      const tags: TagLabel[] = [];

      const result = normalizeTags(tags);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should preserve all other tag properties', () => {
      const tags: TagLabel[] = [
        {
          tagFQN: 'glossary.term1',
          name: 'term1',
          displayName: 'Term 1',
          description: 'Description',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          style: { color: '#FF0000' },
        } as TagLabel,
      ];

      const result = normalizeTags(tags);

      expect(result[0]).not.toHaveProperty('style');
      expect(result[0].tagFQN).toBe('glossary.term1');
      expect(result[0].name).toBe('term1');
      expect(result[0].displayName).toBe('Term 1');
      expect(result[0].description).toBe('Description');
      expect(result[0].source).toBe('Glossary');
      expect(result[0].labelType).toBe('Manual');
      expect(result[0].state).toBe('Confirmed');
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

  const mockProps: TableDetailPageTabProps = {
    activeTab: EntityTabs.DBT,
    deleted: false,
    editCustomAttributePermission: true,
    editLineagePermission: true,
    feedCount: {
      closedTaskCount: 0,
      conversationCount: 0,
      mentionCount: 0,
      openTaskCount: 0,
      totalCount: 0,
      totalTasksCount: 0,
    },
    viewCustomPropertiesPermission: true,
    fetchTableDetails: jest.fn(),
    getEntityFeedCount: jest.fn(),
    handleFeedCount: jest.fn(),
    isTourOpen: false,
    isViewTableType: true,
    queryCount: 0,
    viewAllPermission: true,
    viewQueriesPermission: true,
    viewSampleDataPermission: true,
    viewProfilerPermission: true,
    tablePermissions: {
      Create: true,
      Delete: true,
      EditAll: true,
      EditCertification: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditEntityRelationship: true,
      EditGlossaryTerms: true,
      EditLineage: true,
      EditOwners: true,
      EditQueries: true,
      EditSampleData: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewBasic: true,
      ViewDataProfile: true,
      ViewProfilerGlobalConfiguration: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    } as OperationPermission,
    tableDetails: { ...MOCK_TABLE, dataModel: MOCK_TABLE_DBT },
  };

  describe('TableDetailPage Tabs', () => {
    it('dbt tab should render dbtSourceProject with value', () => {
      const result = getTableDetailPageBaseTabs(mockProps);
      const stringifyResult = JSON.stringify(result[7].children);

      expect(stringifyResult).toContain('label.dbt-source-project:');
      expect(stringifyResult).toContain(
        '{"data-testid":"dbt-source-project-id","children":"jaffle_shop"}'
      );
    });

    it('dbt tab should render dbtSourceProject with value No data placeholder', () => {
      const result = getTableDetailPageBaseTabs({
        ...mockProps,
        tableDetails: {
          ...MOCK_TABLE,
          dataModel: { ...MOCK_TABLE_DBT, dbtSourceProject: undefined },
        },
      });
      const stringifyResult = JSON.stringify(result[7].children);

      expect(stringifyResult).toContain('label.dbt-source-project:');
      expect(stringifyResult).toContain(
        '{"data-testid":"dbt-source-project-id","children":"--"}'
      );
    });
  });

  describe('extractColumnsFromData', () => {
    it('should extract columns from TABLE entity', () => {
      const tableData = {
        id: '1',
        name: 'test_table',
        columns: [
          {
            name: 'col1',
            fullyQualifiedName: 'test.col1',
            dataType: 'STRING',
            tags: [{ tagFQN: 'tag1' }],
          },
          {
            name: 'col2',
            fullyQualifiedName: 'test.col2',
            dataType: 'INT',
            tags: undefined,
          },
        ],
      };

      const result = extractColumnsFromData(tableData, EntityType.TABLE);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'col1',
        tags: [{ tagFQN: 'tag1' }],
      });
      expect(result[1]).toMatchObject({
        name: 'col2',
        tags: [],
      });
    });

    it('should extract fields from API_ENDPOINT entity (request and response schemas)', () => {
      const apiEndpointData = {
        id: '1',
        name: 'test_api',
        requestSchema: {
          schemaFields: [
            {
              name: 'reqField1',
              fullyQualifiedName: 'test.reqField1',
              tags: [{ tagFQN: 'tag1' }],
            },
          ],
        },
        responseSchema: {
          schemaFields: [
            {
              name: 'resField1',
              fullyQualifiedName: 'test.resField1',
              tags: [{ tagFQN: 'tag2' }],
            },
          ],
        },
      };

      const result = extractColumnsFromData(
        apiEndpointData,
        EntityType.API_ENDPOINT
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'reqField1',
        tags: [{ tagFQN: 'tag1' }],
      });
      expect(result[1]).toMatchObject({
        name: 'resField1',
        tags: [{ tagFQN: 'tag2' }],
      });
    });

    it('should extract columns from DASHBOARD_DATA_MODEL entity', () => {
      const dataModelData = {
        id: '1',
        name: 'test_model',
        columns: [
          {
            name: 'modelCol1',
            fullyQualifiedName: 'test.modelCol1',
            tags: [{ tagFQN: 'tag1' }],
          },
        ],
      };

      const result = extractColumnsFromData(
        dataModelData,
        EntityType.DASHBOARD_DATA_MODEL
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'modelCol1',
        tags: [{ tagFQN: 'tag1' }],
      });
    });

    it('should extract features from MLMODEL entity', () => {
      const mlModelData = {
        id: '1',
        name: 'test_ml_model',
        mlFeatures: [
          {
            name: 'feature1',
            fullyQualifiedName: 'test.feature1',
            dataType: 'NUMERIC',
          },
          {
            name: 'feature2',
            fullyQualifiedName: 'test.feature2',
            dataType: 'CATEGORICAL',
          },
        ],
      };

      const result = extractColumnsFromData(mlModelData, EntityType.MLMODEL);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'feature1',
        dataType: 'NUMERIC',
      });
      expect(result[1]).toMatchObject({
        name: 'feature2',
        dataType: 'CATEGORICAL',
      });
    });

    it('should extract tasks from PIPELINE entity', () => {
      const pipelineData = {
        id: '1',
        name: 'test_pipeline',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'test.task1',
            taskType: 'Ingestion',
            tags: [{ tagFQN: 'tag1' }],
          },
          {
            name: 'task2',
            fullyQualifiedName: 'test.task2',
            taskType: 'Transformation',
            tags: undefined,
          },
        ],
      };

      const result = extractColumnsFromData(pipelineData, EntityType.PIPELINE);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'task1',
        tags: [{ tagFQN: 'tag1' }],
      });
      expect(result[1]).toMatchObject({
        name: 'task2',
        tags: [],
      });
    });

    it('should extract schema fields from TOPIC entity', () => {
      const topicData = {
        id: '1',
        name: 'test_topic',
        messageSchema: {
          schemaFields: [
            {
              name: 'field1',
              fullyQualifiedName: 'test.field1',
              dataType: 'STRING',
            },
            {
              name: 'field2',
              fullyQualifiedName: 'test.field2',
              dataType: 'INT',
            },
          ],
        },
      };

      const result = extractColumnsFromData(topicData, EntityType.TOPIC);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'field1',
        dataType: 'STRING',
      });
      expect(result[1]).toMatchObject({
        name: 'field2',
        dataType: 'INT',
      });
    });

    it('should extract columns from CONTAINER entity', () => {
      const containerData = {
        id: '1',
        name: 'test_container',
        dataModel: {
          columns: [
            {
              name: 'containerCol1',
              fullyQualifiedName: 'test.containerCol1',
              tags: [{ tagFQN: 'tag1' }],
            },
          ],
        },
      };

      const result = extractColumnsFromData(
        containerData,
        EntityType.CONTAINER
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'containerCol1',
        tags: [{ tagFQN: 'tag1' }],
      });
    });

    it('should extract fields from SEARCH_INDEX entity', () => {
      const searchIndexData = {
        id: '1',
        name: 'test_index',
        fields: [
          {
            name: 'indexField1',
            fullyQualifiedName: 'test.indexField1',
            dataType: 'TEXT',
            tags: [{ tagFQN: 'tag1' }],
          },
          {
            name: 'indexField2',
            fullyQualifiedName: 'test.indexField2',
            dataType: 'KEYWORD',
            tags: undefined,
          },
        ],
      };

      const result = extractColumnsFromData(
        searchIndexData,
        EntityType.SEARCH_INDEX
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'indexField1',
        tags: [{ tagFQN: 'tag1' }],
      });
      expect(result[1]).toMatchObject({
        name: 'indexField2',
        tags: [],
      });
    });

    it('should return empty array for unsupported entity type', () => {
      const unknownData = {
        id: '1',
        name: 'unknown',
      };

      const result = extractColumnsFromData(unknownData, EntityType.DASHBOARD);

      expect(result).toEqual([]);
    });

    it('should handle missing columns/fields arrays gracefully', () => {
      const tableDataWithoutColumns = {
        id: '1',
        name: 'test_table',
        columns: undefined,
      };

      const result = extractColumnsFromData(
        tableDataWithoutColumns,
        EntityType.TABLE
      );

      expect(result).toEqual([]);
    });

    it('should handle empty columns/fields arrays', () => {
      const tableDataWithEmptyColumns = {
        id: '1',
        name: 'test_table',
        columns: [],
      };

      const result = extractColumnsFromData(
        tableDataWithEmptyColumns,
        EntityType.TABLE
      );

      expect(result).toEqual([]);
    });

    it('should handle API_ENDPOINT with missing schemas', () => {
      const apiEndpointData = {
        id: '1',
        name: 'test_api',
        requestSchema: undefined,
        responseSchema: undefined,
      };

      const result = extractColumnsFromData(
        apiEndpointData,
        EntityType.API_ENDPOINT
      );

      expect(result).toEqual([]);
    });

    it('should handle API_ENDPOINT with only request schema', () => {
      const apiEndpointData = {
        id: '1',
        name: 'test_api',
        requestSchema: {
          schemaFields: [
            {
              name: 'reqField1',
              fullyQualifiedName: 'test.reqField1',
            },
          ],
        },
        responseSchema: undefined,
      };

      const result = extractColumnsFromData(
        apiEndpointData,
        EntityType.API_ENDPOINT
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'reqField1' });
    });

    it('should handle CONTAINER with missing dataModel', () => {
      const containerData = {
        id: '1',
        name: 'test_container',
        dataModel: undefined,
      };

      const result = extractColumnsFromData(
        containerData,
        EntityType.CONTAINER
      );

      expect(result).toEqual([]);
    });

    it('should handle TOPIC with missing messageSchema', () => {
      const topicData = {
        id: '1',
        name: 'test_topic',
        messageSchema: undefined,
      };

      const result = extractColumnsFromData(topicData, EntityType.TOPIC);

      expect(result).toEqual([]);
    });

    it('should ensure all columns have tags array (default to empty)', () => {
      const tableData = {
        id: '1',
        name: 'test_table',
        columns: [
          {
            name: 'col1',
            fullyQualifiedName: 'test.col1',
            tags: undefined,
          },
          {
            name: 'col2',
            fullyQualifiedName: 'test.col2',
            tags: null,
          },
        ],
      };

      const result = extractColumnsFromData(tableData, EntityType.TABLE);

      expect(result).toHaveLength(2);
      expect(result[0].tags).toEqual([]);
      expect(result[1].tags).toEqual([]);
    });
  });

  describe('extractTableColumns', () => {
    it('should extract columns from table with tags filled', () => {
      const mockTable = {
        id: 'test-id',
        columns: [
          {
            name: 'column1',
            dataType: DataType.String,
            fullyQualifiedName: 'table.column1',
          },
          {
            name: 'column2',
            dataType: DataType.Int,
            fullyQualifiedName: 'table.column2',
            tags: [
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ],
          },
        ],
      } as Partial<Table> & Pick<Omit<EntityReference, 'type'>, 'id'>;

      const result = extractTableColumns(mockTable);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('column1');
      expect(result[0].tags).toEqual([]);
      expect(result[1].name).toBe('column2');
      expect(result[1].tags).toHaveLength(1);
    });

    it('should return empty array when columns are undefined', () => {
      const mockTable = {
        id: 'test-id',
      } as Partial<Table> & Pick<Omit<EntityReference, 'type'>, 'id'>;

      const result = extractTableColumns(mockTable);

      expect(result).toEqual([]);
    });

    it('should add empty tags array to columns without tags', () => {
      const mockTable = {
        id: 'test-id',
        columns: [
          {
            name: 'column1',
            dataType: DataType.String,
            fullyQualifiedName: 'table.column1',
          },
        ],
      } as Partial<Table> & Pick<Omit<EntityReference, 'type'>, 'id'>;

      const result = extractTableColumns(mockTable);

      expect(result[0].tags).toEqual([]);
    });
  });

  describe('fieldExistsByFQN', () => {
    it('should return true when field exists at root level', () => {
      const items = [
        { fullyQualifiedName: 'table.column1' },
        { fullyQualifiedName: 'table.column2' },
        { fullyQualifiedName: 'table.column3' },
      ];

      expect(fieldExistsByFQN(items, 'table.column2')).toBe(true);
    });

    it('should return true when field exists in nested children', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent',
          children: [
            { fullyQualifiedName: 'table.parent.child1' },
            { fullyQualifiedName: 'table.parent.child2' },
          ],
        },
        { fullyQualifiedName: 'table.other' },
      ];

      expect(fieldExistsByFQN(items, 'table.parent.child1')).toBe(true);
      expect(fieldExistsByFQN(items, 'table.parent.child2')).toBe(true);
    });

    it('should return true when targetFqn starts with item FQN prefix', () => {
      const items = [
        { fullyQualifiedName: 'table.parent' },
        { fullyQualifiedName: 'table.other' },
      ];

      expect(fieldExistsByFQN(items, 'table.parent.child')).toBe(true);
      expect(fieldExistsByFQN(items, 'table.parent.child.grandchild')).toBe(
        true
      );
    });

    it('should return false when field does not exist', () => {
      const items = [
        { fullyQualifiedName: 'table.column1' },
        { fullyQualifiedName: 'table.column2' },
      ];

      expect(fieldExistsByFQN(items, 'table.nonexistent')).toBe(false);
      expect(fieldExistsByFQN(items, 'other.table.column1')).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(fieldExistsByFQN([], 'table.column1')).toBe(false);
    });

    it('should handle deeply nested structures', () => {
      const items = [
        {
          fullyQualifiedName: 'table.level1',
          children: [
            {
              fullyQualifiedName: 'table.level1.level2',
              children: [
                {
                  fullyQualifiedName: 'table.level1.level2.level3',
                  children: [
                    {
                      fullyQualifiedName: 'table.level1.level2.level3.level4',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      expect(fieldExistsByFQN(items, 'table.level1.level2.level3.level4')).toBe(
        true
      );
      expect(fieldExistsByFQN(items, 'table.level1.level2.level3')).toBe(true);
    });

    it('should handle items with undefined fullyQualifiedName', () => {
      const items = [
        { fullyQualifiedName: undefined },
        { fullyQualifiedName: 'table.column1' },
      ];

      expect(fieldExistsByFQN(items, 'table.column1')).toBe(true);
      expect(fieldExistsByFQN(items, 'table.undefined')).toBe(false);
    });

    it('should handle items with empty children array', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent',
          children: [],
        },
        { fullyQualifiedName: 'table.column1' },
      ];

      expect(fieldExistsByFQN(items, 'table.column1')).toBe(true);
      expect(fieldExistsByFQN(items, 'table.parent.child')).toBe(true); // prefix match
    });

    it('should handle multiple levels of nesting with mixed results', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent1',
          children: [
            { fullyQualifiedName: 'table.parent1.child1', children: [] },
            {
              fullyQualifiedName: 'table.parent1.child2',
              children: [
                {
                  fullyQualifiedName: 'table.parent1.child2.grandchild',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          fullyQualifiedName: 'table.parent2',
          children: [
            { fullyQualifiedName: 'table.parent2.child1', children: [] },
          ],
        },
      ];

      expect(fieldExistsByFQN(items, 'table.parent1.child1')).toBe(true);
      expect(fieldExistsByFQN(items, 'table.parent1.child2.grandchild')).toBe(
        true
      );
      expect(fieldExistsByFQN(items, 'table.parent2.child1')).toBe(true);
      expect(fieldExistsByFQN(items, 'table.parent1.nonexistent')).toBe(true); // prefix match
      expect(fieldExistsByFQN(items, 'table.nonexistent')).toBe(false);
    });
  });

  describe('getParentKeysToExpand', () => {
    it('should return empty array when field is at root level', () => {
      const items = [
        { fullyQualifiedName: 'table.column1' },
        { fullyQualifiedName: 'table.column2' },
      ];

      expect(getParentKeysToExpand(items, 'table.column1')).toEqual([]);
      expect(getParentKeysToExpand(items, 'table.column2')).toEqual([]);
    });

    it('should return parent keys for field in one level of nesting', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent',
          children: [
            { fullyQualifiedName: 'table.parent.child1', children: [] },
            { fullyQualifiedName: 'table.parent.child2', children: [] },
          ],
        },
      ];

      expect(getParentKeysToExpand(items, 'table.parent.child1')).toEqual([
        'table.parent',
      ]);
      expect(getParentKeysToExpand(items, 'table.parent.child2')).toEqual([
        'table.parent',
      ]);
    });

    it('should return all parent keys for deeply nested field', () => {
      const items = [
        {
          fullyQualifiedName: 'table.level1',
          children: [
            {
              fullyQualifiedName: 'table.level1.level2',
              children: [
                {
                  fullyQualifiedName: 'table.level1.level2.level3',
                  children: [
                    {
                      fullyQualifiedName: 'table.level1.level2.level3.level4',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      expect(
        getParentKeysToExpand(items, 'table.level1.level2.level3.level4')
      ).toEqual([
        'table.level1',
        'table.level1.level2',
        'table.level1.level2.level3',
      ]);
    });

    it('should return empty array when field does not exist', () => {
      const items = [
        { fullyQualifiedName: 'table.column1' },
        {
          fullyQualifiedName: 'table.parent',
          children: [{ fullyQualifiedName: 'table.parent.child1' }],
        },
      ];

      expect(getParentKeysToExpand(items, 'table.nonexistent')).toEqual([]);
      expect(getParentKeysToExpand(items, 'table.parent.nonexistent')).toEqual(
        []
      );
    });

    it('should return empty array for empty items array', () => {
      expect(getParentKeysToExpand([], 'table.column1')).toEqual([]);
    });

    it('should use name as fallback when fullyQualifiedName is undefined', () => {
      const items = [
        {
          name: 'parent',
          fullyQualifiedName: undefined,
          children: [
            { fullyQualifiedName: 'table.parent.child1', children: [] },
            { fullyQualifiedName: 'table.parent.child2', children: [] },
          ],
        },
      ];

      expect(
        getParentKeysToExpand(
          items as ParentFieldObject[],
          'table.parent.child1'
        )
      ).toEqual(['parent']);
    });

    it('should use empty string when both fullyQualifiedName and name are undefined', () => {
      const items = [
        {
          name: undefined,
          fullyQualifiedName: undefined,
          children: [{ fullyQualifiedName: 'table.child1', children: [] }],
        },
      ];

      expect(
        getParentKeysToExpand(items as ParentFieldObject[], 'table.child1')
      ).toEqual(['']);
    });

    it('should handle multiple parents with different children', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent1',
          children: [
            { fullyQualifiedName: 'table.parent1.child1', children: [] },
            { fullyQualifiedName: 'table.parent1.child2', children: [] },
          ],
        },
        {
          fullyQualifiedName: 'table.parent2',
          children: [
            {
              fullyQualifiedName: 'table.parent2.child1',
              children: [
                {
                  fullyQualifiedName: 'table.parent2.child1.grandchild',
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      expect(getParentKeysToExpand(items, 'table.parent1.child1')).toEqual([
        'table.parent1',
      ]);
      expect(
        getParentKeysToExpand(items, 'table.parent2.child1.grandchild')
      ).toEqual(['table.parent2', 'table.parent2.child1']);
    });

    it('should handle parent keys parameter correctly', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent',
          children: [
            { fullyQualifiedName: 'table.parent.child1', children: [] },
          ],
        },
      ];

      const initialParentKeys = ['table.root'];

      expect(
        getParentKeysToExpand(items, 'table.parent.child1', initialParentKeys)
      ).toEqual(['table.root', 'table.parent']);
    });

    it('should return correct path when target is direct child', () => {
      const items = [
        {
          fullyQualifiedName: 'table.parent',
          children: [
            { fullyQualifiedName: 'table.parent.child1', children: [] },
            {
              fullyQualifiedName: 'table.parent.child2',
              children: [
                {
                  fullyQualifiedName: 'table.parent.child2.grandchild',
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      // Direct child should return parent
      expect(getParentKeysToExpand(items, 'table.parent.child1')).toEqual([
        'table.parent',
      ]);

      // Nested child should return all parents
      expect(
        getParentKeysToExpand(items, 'table.parent.child2.grandchild')
      ).toEqual(['table.parent', 'table.parent.child2']);
    });

    it('should handle items without children property', () => {
      const items = [
        { fullyQualifiedName: 'table.column1' },
        { fullyQualifiedName: 'table.column2' },
      ];

      expect(getParentKeysToExpand(items, 'table.column1')).toEqual([]);
    });
  });

  describe('getHighlightedRowClassName', () => {
    it('should return "highlighted-row" when highlightedFqn matches record fullyQualifiedName', () => {
      const record = {
        fullyQualifiedName: 'test.database.schema.table.column1',
      };
      const highlightedFqn = 'test.database.schema.table.column1';

      const result = getHighlightedRowClassName(record, highlightedFqn);

      expect(result).toBe('highlighted-row');
    });

    it('should return empty string when highlightedFqn does not match record fullyQualifiedName', () => {
      const record = {
        fullyQualifiedName: 'test.database.schema.table.column1',
      };
      const highlightedFqn = 'test.database.schema.table.column2';

      const result = getHighlightedRowClassName(record, highlightedFqn);

      expect(result).toBe('');
    });

    it('should return empty string when highlightedFqn is undefined', () => {
      const record = {
        fullyQualifiedName: 'test.database.schema.table.column1',
      };

      const result = getHighlightedRowClassName(record);

      expect(result).toBe('');
    });

    it('should return empty string when highlightedFqn is empty string', () => {
      const record = {
        fullyQualifiedName: 'test.database.schema.table.column1',
      };

      const result = getHighlightedRowClassName(record, '');

      expect(result).toBe('');
    });

    it('should return empty string when record fullyQualifiedName is undefined', () => {
      const record = {
        fullyQualifiedName: undefined,
      };
      const highlightedFqn = 'test.database.schema.table.column1';

      const result = getHighlightedRowClassName(record, highlightedFqn);

      expect(result).toBe('');
    });

    it('should return empty string when both highlightedFqn and record fullyQualifiedName are undefined', () => {
      const record = {
        fullyQualifiedName: undefined,
      };

      const result = getHighlightedRowClassName(record);

      expect(result).toBe('');
    });

    it('should work with Column type', () => {
      const column = {
        name: 'column1',
        fullyQualifiedName: 'test.database.schema.table.column1',
        dataType: 'STRING',
      } as Column;

      expect(
        getHighlightedRowClassName(column, 'test.database.schema.table.column1')
      ).toBe('highlighted-row');
      expect(
        getHighlightedRowClassName(column, 'test.database.schema.table.column2')
      ).toBe('');
    });

    it('should work with SearchIndexField type', () => {
      const field = {
        name: 'field1',
        fullyQualifiedName: 'test.index.field1',
        dataType: 'TEXT',
      };

      expect(getHighlightedRowClassName(field, 'test.index.field1')).toBe(
        'highlighted-row'
      );
      expect(getHighlightedRowClassName(field, 'test.index.field2')).toBe('');
    });

    it('should handle case-sensitive FQN matching', () => {
      const record = {
        fullyQualifiedName: 'Test.Database.Schema.Table.Column1',
      };
      const highlightedFqn = 'test.database.schema.table.column1';

      const result = getHighlightedRowClassName(record, highlightedFqn);

      expect(result).toBe('');
    });

    it('should handle records with additional properties', () => {
      const record = {
        fullyQualifiedName: 'test.database.schema.table.column1',
        name: 'column1',
        description: 'Test column',
        tags: [],
      };

      expect(
        getHighlightedRowClassName(record, 'test.database.schema.table.column1')
      ).toBe('highlighted-row');
    });
  });

  describe('updateFieldExtension', () => {
    it('should update extension for a field at root level', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
        } as Column,
        {
          name: 'column2',
          fullyQualifiedName: 'table.column2',
          dataType: DataType.Int,
        } as Column,
      ];

      const newExtension = { customProperty: 'value1', anotherProp: 123 };
      updateFieldExtension('table.column1', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
      expect(fields[1].extension).toBeUndefined();
    });

    it('should update extension for a field in nested children', () => {
      const fields: Column[] = [
        {
          name: 'parentColumn',
          fullyQualifiedName: 'table.parentColumn',
          dataType: DataType.Struct,
          children: [
            {
              name: 'nestedColumn',
              fullyQualifiedName: 'table.parentColumn.nestedColumn',
              dataType: DataType.String,
            } as Column,
            {
              name: 'anotherNestedColumn',
              fullyQualifiedName: 'table.parentColumn.anotherNestedColumn',
              dataType: DataType.Int,
            } as Column,
          ],
        } as Column,
      ];

      const newExtension = { nestedProperty: 'nestedValue' };
      updateFieldExtension(
        'table.parentColumn.nestedColumn',
        newExtension,
        fields
      );

      expect(fields[0].children?.[0].extension).toEqual(newExtension);
      expect(fields[0].children?.[1].extension).toBeUndefined();
      expect(fields[0].extension).toBeUndefined();
    });

    it('should update extension for a field in deeply nested children', () => {
      const fields: Column[] = [
        {
          name: 'level1',
          fullyQualifiedName: 'table.level1',
          dataType: DataType.Struct,
          children: [
            {
              name: 'level2',
              fullyQualifiedName: 'table.level1.level2',
              dataType: DataType.Struct,
              children: [
                {
                  name: 'level3',
                  fullyQualifiedName: 'table.level1.level2.level3',
                  dataType: DataType.String,
                } as Column,
              ],
            } as Column,
          ],
        } as Column,
      ];

      const newExtension = { deepProperty: 'deepValue' };
      updateFieldExtension('table.level1.level2.level3', newExtension, fields);

      expect(fields[0].children?.[0].children?.[0].extension).toEqual(
        newExtension
      );
    });

    it('should not modify fields when target FQN does not exist', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
          extension: { existing: 'value' },
        } as Column,
      ];

      const originalExtension = { ...fields[0].extension };
      const newExtension = { newProperty: 'newValue' };

      updateFieldExtension('table.nonexistent', newExtension, fields);

      expect(fields[0].extension).toEqual(originalExtension);
    });

    it('should handle empty array', () => {
      const fields: Column[] = [];
      const newExtension = { property: 'value' };

      expect(() => {
        updateFieldExtension('table.column1', newExtension, fields);
      }).not.toThrow();
    });

    it('should handle undefined searchIndexFields', () => {
      const newExtension = { property: 'value' };

      expect(() => {
        updateFieldExtension('table.column1', newExtension);
      }).not.toThrow();
    });

    it('should replace existing extension with new extension', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
          extension: { oldProperty: 'oldValue' },
        } as Column,
      ];

      const newExtension = { newProperty: 'newValue', anotherProp: 456 };
      updateFieldExtension('table.column1', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
      expect(fields[0].extension).not.toHaveProperty('oldProperty');
    });

    it('should update extension for multiple fields with same FQN pattern', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
        } as Column,
        {
          name: 'parentColumn',
          fullyQualifiedName: 'table.parentColumn',
          dataType: DataType.Struct,
          children: [
            {
              name: 'column1',
              fullyQualifiedName: 'table.parentColumn.column1',
              dataType: DataType.String,
            } as Column,
          ],
        } as Column,
      ];

      const newExtension = { property: 'value' };
      updateFieldExtension('table.column1', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
      expect(fields[1].children?.[0].extension).toBeUndefined();
    });

    it('should work with SearchIndexField type', () => {
      const fields: TableFieldsInfoCommonEntities[] = [
        {
          name: 'field1',
          fullyQualifiedName: 'index.field1',
          dataType: DataType.Text,
        },
        {
          name: 'field2',
          fullyQualifiedName: 'index.field2',
          dataType: DataType.Geometry,
        },
      ];

      const newExtension = { searchProperty: 'searchValue' };
      updateFieldExtension('index.field1', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
      expect(fields[1].extension).toBeUndefined();
    });

    it('should work with Field type (Topic)', () => {
      const fields: TableFieldsInfoCommonEntities[] = [
        {
          name: 'topicField1',
          fullyQualifiedName: 'topic.field1',
          dataType: DataType.String,
        },
        {
          name: 'topicField2',
          fullyQualifiedName: 'topic.field2',
          dataType: DataType.Int,
        },
      ];

      const newExtension = { topicProperty: 'topicValue' };
      updateFieldExtension('topic.field1', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
      expect(fields[1].extension).toBeUndefined();
    });

    it('should handle fields with undefined children', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
          children: undefined,
        } as Column,
      ];

      const newExtension = { property: 'value' };
      updateFieldExtension('table.column1', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
    });

    it('should handle fields with empty children array', () => {
      const fields: Column[] = [
        {
          name: 'parentColumn',
          fullyQualifiedName: 'table.parentColumn',
          dataType: DataType.Struct,
          children: [],
        } as Column,
      ];

      const newExtension = { property: 'value' };
      updateFieldExtension('table.parentColumn', newExtension, fields);

      expect(fields[0].extension).toEqual(newExtension);
    });

    it('should update extension with complex nested object', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
        } as Column,
      ];

      const complexExtension = {
        metadata: {
          source: 'external',
          version: 1,
        },
        tags: ['tag1', 'tag2'],
        config: {
          enabled: true,
          settings: {
            timeout: 5000,
            retries: 3,
          },
        },
      };

      updateFieldExtension('table.column1', complexExtension, fields);

      expect(fields[0].extension).toEqual(complexExtension);
      expect(fields[0].extension?.metadata?.source).toBe('external');
      expect(fields[0].extension?.config?.settings?.timeout).toBe(5000);
    });

    it('should handle multiple nested fields and update only the target', () => {
      const fields: Column[] = [
        {
          name: 'parent1',
          fullyQualifiedName: 'table.parent1',
          dataType: DataType.Struct,
          children: [
            {
              name: 'child1',
              fullyQualifiedName: 'table.parent1.child1',
              dataType: DataType.String,
            } as Column,
            {
              name: 'child2',
              fullyQualifiedName: 'table.parent1.child2',
              dataType: DataType.Int,
            } as Column,
          ],
        } as Column,
        {
          name: 'parent2',
          fullyQualifiedName: 'table.parent2',
          dataType: DataType.Struct,
          children: [
            {
              name: 'child1',
              fullyQualifiedName: 'table.parent2.child1',
              dataType: DataType.String,
            } as Column,
          ],
        } as Column,
      ];

      const newExtension = { targetProperty: 'targetValue' };
      updateFieldExtension('table.parent1.child2', newExtension, fields);

      expect(fields[0].children?.[1].extension).toEqual(newExtension);
      expect(fields[0].children?.[0].extension).toBeUndefined();
      expect(fields[1].children?.[0].extension).toBeUndefined();
      expect(fields[0].extension).toBeUndefined();
      expect(fields[1].extension).toBeUndefined();
    });

    it('should handle empty extension object', () => {
      const fields: Column[] = [
        {
          name: 'column1',
          fullyQualifiedName: 'table.column1',
          dataType: DataType.String,
          extension: { existing: 'value' },
        } as Column,
      ];

      const emptyExtension = {};
      updateFieldExtension('table.column1', emptyExtension, fields);

      expect(fields[0].extension).toEqual(emptyExtension);
    });
  });
});

describe('getColumnOptionsFromTableColumn', () => {
  it('should use fullyQualifiedName when useFullyQualifiedName is true', () => {
    const columns = [
      {
        name: 'column1',
        fullyQualifiedName: 'table.column1',
        dataType: 'STRING',
        children: [],
      },
      {
        name: 'nested',
        fullyQualifiedName: 'table.nested',
        dataType: 'STRUCT',
        children: [
          {
            name: 'field1',
            fullyQualifiedName: 'table.nested.field1',
            dataType: 'STRING',
            children: [],
          },
        ],
      },
    ] as Column[];

    const result = getColumnOptionsFromTableColumn(columns, true);

    expect(result).toEqual([
      { label: 'column1', value: 'table.column1' },
      { label: 'nested', value: 'table.nested' },
      { label: 'field1', value: 'table.nested.field1' },
    ]);
  });

  it('should use name when useFullyQualifiedName is false', () => {
    const columns = [
      {
        name: 'column1',
        fullyQualifiedName: 'table.column1',
        dataType: 'STRING',
        children: [],
      },
    ] as Column[];

    const result = getColumnOptionsFromTableColumn(columns, false);

    expect(result).toEqual([{ label: 'column1', value: 'column1' }]);
  });

  it('should use name by default when useFullyQualifiedName is not provided', () => {
    const columns = [
      {
        name: 'column1',
        fullyQualifiedName: 'table.column1',
        dataType: 'STRING',
        children: [],
      },
    ] as Column[];

    const result = getColumnOptionsFromTableColumn(columns);

    expect(result).toEqual([{ label: 'column1', value: 'column1' }]);
  });
});

describe('getNestedSectionTitle', () => {
  it('should return schema-field-plural for TOPIC', () => {
    expect(getNestedSectionTitle(EntityType.TOPIC)).toBe(
      'label.schema-field-plural'
    );
  });

  it('should return schema-field-plural for API_ENDPOINT', () => {
    expect(getNestedSectionTitle(EntityType.API_ENDPOINT)).toBe(
      'label.schema-field-plural'
    );
  });

  it('should return field-plural for SEARCH_INDEX', () => {
    expect(getNestedSectionTitle(EntityType.SEARCH_INDEX)).toBe(
      'label.field-plural'
    );
  });

  it.each([
    EntityType.TABLE,
    EntityType.DASHBOARD_DATA_MODEL,
    EntityType.CONTAINER,
    undefined,
  ])('should return nested-column-plural for %s', (entityType) => {
    expect(getNestedSectionTitle(entityType)).toBe(
      'label.nested-column-plural'
    );
  });
});
