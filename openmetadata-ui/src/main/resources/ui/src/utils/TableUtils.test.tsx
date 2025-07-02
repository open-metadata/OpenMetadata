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
import { Column } from '../generated/entity/data/table';
import {
  ExtraTableDropdownOptions,
  findColumnByEntityLink,
  getEntityIcon,
  getTableColumnConfigSelections,
  getTagsWithoutTier,
  getTierTags,
  handleUpdateTableColumnSelections,
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

  describe('getTableColumnConfigSelections', () => {
    const mockSetPreference = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return existing selections when entityType exists and has selections', () => {
      const entityType = 'table';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2', 'column3'],
      };
      const defaultColumns = ['column1', 'column2'];

      const result = getTableColumnConfigSelections(
        entityType,
        false,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2', 'column3']);
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should return default columns and update preferences when entityType exists but no selections', () => {
      const entityType = 'table';
      const selectedEntityTableColumns = {};
      const defaultColumns = ['column1', 'column2'];

      const result = getTableColumnConfigSelections(
        entityType,
        false,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1', 'column2'],
        },
      });
    });

    it('should return empty array when defaultColumns is undefined', () => {
      const entityType = 'table';
      const selectedEntityTableColumns = {};
      const defaultColumns = undefined;

      const result = getTableColumnConfigSelections(
        entityType,
        false,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual([]);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: [],
        },
      });
    });

    it('should return empty array when isFullViewTable is true', () => {
      const entityType = 'table';
      const selectedEntityTableColumns = {};
      const defaultColumns = ['column1', 'column2'];

      const result = getTableColumnConfigSelections(
        entityType,
        true,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual([]);
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should return empty array when entityType is undefined', () => {
      const entityType = undefined;
      const selectedEntityTableColumns = {};
      const defaultColumns = ['column1', 'column2'];

      const result = getTableColumnConfigSelections(
        entityType,
        false,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual([]);
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should return empty array when entityType is empty string', () => {
      const entityType = '';
      const selectedEntityTableColumns = {};
      const defaultColumns = ['column1', 'column2'];

      const result = getTableColumnConfigSelections(
        entityType,
        false,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual([]);
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should preserve existing selections for other entity types', () => {
      const entityType = 'table';
      const selectedEntityTableColumns = {
        dashboard: ['dashboard1', 'dashboard2'],
      };
      const defaultColumns = ['column1', 'column2'];

      const result = getTableColumnConfigSelections(
        entityType,
        false,
        defaultColumns,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          dashboard: ['dashboard1', 'dashboard2'],
          table: ['column1', 'column2'],
        },
      });
    });
  });

  describe('handleUpdateTableColumnSelections', () => {
    const mockSetPreference = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should add column to selections when selected is true', () => {
      const selected = true;
      const key = 'column3';
      const columnDropdownSelections = ['column1', 'column2'];
      const entityType = 'table';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2', 'column3']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1', 'column2', 'column3'],
        },
      });
    });

    it('should remove column from selections when selected is false', () => {
      const selected = false;
      const key = 'column2';
      const columnDropdownSelections = ['column1', 'column2', 'column3'];
      const entityType = 'table';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2', 'column3'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column3']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1', 'column3'],
        },
      });
    });

    it('should handle adding duplicate column gracefully', () => {
      const selected = true;
      const key = 'column2';
      const columnDropdownSelections = ['column1', 'column2'];
      const entityType = 'table';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2', 'column2']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1', 'column2', 'column2'],
        },
      });
    });

    it('should handle removing non-existent column gracefully', () => {
      const selected = false;
      const key = 'nonExistentColumn';
      const columnDropdownSelections = ['column1', 'column2'];
      const entityType = 'table';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1', 'column2'],
        },
      });
    });

    it('should not call setPreference when entityType is undefined', () => {
      const selected = true;
      const key = 'column3';
      const columnDropdownSelections = ['column1', 'column2'];
      const entityType = undefined;
      const selectedEntityTableColumns = {
        table: ['column1', 'column2'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2', 'column3']);
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should not call setPreference when entityType is empty string', () => {
      const selected = false;
      const key = 'column2';
      const columnDropdownSelections = ['column1', 'column2'];
      const entityType = '';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1']);
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should preserve existing selections for other entity types', () => {
      const selected = true;
      const key = 'column3';
      const columnDropdownSelections = ['column1', 'column2'];
      const entityType = 'table';
      const selectedEntityTableColumns = {
        table: ['column1', 'column2'],
        dashboard: ['dashboard1', 'dashboard2'],
      };

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1', 'column2', 'column3']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1', 'column2', 'column3'],
          dashboard: ['dashboard1', 'dashboard2'],
        },
      });
    });

    it('should handle empty columnDropdownSelections array', () => {
      const selected = true;
      const key = 'column1';
      const columnDropdownSelections: string[] = [];
      const entityType = 'table';
      const selectedEntityTableColumns = {};

      const result = handleUpdateTableColumnSelections(
        selected,
        key,
        columnDropdownSelections,
        entityType,
        selectedEntityTableColumns,
        mockSetPreference
      );

      expect(result).toEqual(['column1']);
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['column1'],
        },
      });
    });
  });
});
