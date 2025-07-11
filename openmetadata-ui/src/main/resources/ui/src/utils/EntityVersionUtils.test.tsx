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

import { EntityField } from '../constants/Feeds.constants';
import {
  Column as ContainerColumn,
  DataType as ContainerDataType,
} from '../generated/entity/data/container';
import {
  Column as TableColumn,
  DataType as TableDataType,
} from '../generated/entity/data/table';
import { DataTypeTopic, Field } from '../generated/entity/data/topic';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import {
  getComputeRowCountDiffDisplay,
  getStringEntityDiff,
} from './EntityVersionUtils';

// Mock data for testing
const createMockTableColumn = (
  name: string,
  displayName?: string
): TableColumn => ({
  name,
  displayName,
  dataType: TableDataType.String,
  dataTypeDisplay: 'string',
  fullyQualifiedName: `test.table.${name}`,
  tags: [],
  children: [],
});

const createMockContainerColumn = (
  name: string,
  displayName?: string
): ContainerColumn => ({
  name,
  displayName,
  dataType: ContainerDataType.String,
  dataTypeDisplay: 'string',
  fullyQualifiedName: `test.container.${name}`,
  tags: [],
  children: [],
});

const createMockField = (name: string, displayName?: string): Field => ({
  name,
  displayName,
  dataType: DataTypeTopic.String,
  dataTypeDisplay: 'string',
  fullyQualifiedName: `test.topic.${name}`,
  tags: [],
  children: [],
});

const createMockFieldChange = (
  name: string,
  oldValue: string,
  newValue: string
): FieldChange => ({
  name,
  oldValue,
  newValue,
});

const createMockEntityDiff = (
  added?: FieldChange,
  deleted?: FieldChange,
  updated?: FieldChange
) => ({
  added,
  deleted,
  updated,
});

describe('EntityVersionUtils', () => {
  describe('getStringEntityDiff', () => {
    describe('TableColumn entity', () => {
      it('should update displayName with diff when entity name matches', () => {
        const oldDisplayName = 'Old Display Name';
        const newDisplayName = 'New Display Name';
        const entityName = 'testColumn';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', oldDisplayName, newDisplayName)
        );

        const columns = [
          createMockTableColumn(entityName, oldDisplayName),
          createMockTableColumn('otherColumn', 'Other Display Name'),
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          entityName,
          columns
        );

        expect(result).toHaveLength(2);
        expect(result[0].displayName).toContain('diff-removed');
        expect(result[0].displayName).toContain('diff-added');
        expect(result[1].displayName).toBe('Other Display Name');
      });

      it('should update description field when DESCRIPTION field is passed', () => {
        const oldDescription = 'Old description';
        const newDescription = 'New description';
        const entityName = 'testColumn';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('description', oldDescription, newDescription)
        );

        const columns = [
          { ...createMockTableColumn(entityName), description: oldDescription },
          createMockTableColumn('otherColumn', 'Other Display Name'),
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DESCRIPTION,
          entityName,
          columns
        );

        expect(result).toHaveLength(2);
        expect(result[0].description).toContain('diff-removed');
        expect(result[0].description).toContain('diff-added');
        expect(result[1].description).toBeUndefined();
      });

      it('should handle nested children entities', () => {
        const oldDisplayName = 'Old Child Display Name';
        const newDisplayName = 'New Child Display Name';
        const childEntityName = 'childColumn';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', oldDisplayName, newDisplayName)
        );

        const childColumn = createMockTableColumn(
          childEntityName,
          oldDisplayName
        );
        const parentColumn = {
          ...createMockTableColumn('parentColumn', 'Parent Display Name'),
          children: [childColumn],
        };

        const columns = [parentColumn];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          childEntityName,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].children?.[0].displayName).toContain('diff-removed');
        expect(result[0].children?.[0].displayName).toContain('diff-added');
        expect(result[0].displayName).toBe('Parent Display Name');
      });

      it('should not modify entities when name does not match', () => {
        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', 'Old Name', 'New Name')
        );

        const columns = [
          createMockTableColumn('differentColumn', 'Original Display Name'),
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          'nonExistentColumn',
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toBe('Original Display Name');
      });
    });

    describe('ContainerColumn entity', () => {
      it('should update displayName for ContainerColumn', () => {
        const oldDisplayName = 'Old Container Display Name';
        const newDisplayName = 'New Container Display Name';
        const entityName = 'containerColumn';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', oldDisplayName, newDisplayName)
        );

        const columns = [createMockContainerColumn(entityName, oldDisplayName)];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          entityName,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toContain('diff-removed');
        expect(result[0].displayName).toContain('diff-added');
      });
    });

    describe('Field entity', () => {
      it('should update displayName for Field', () => {
        const oldDisplayName = 'Old Field Display Name';
        const newDisplayName = 'New Field Display Name';
        const entityName = 'fieldName';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', oldDisplayName, newDisplayName)
        );

        const fields = [createMockField(entityName, oldDisplayName)];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          entityName,
          fields
        );

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toContain('diff-removed');
        expect(result[0].displayName).toContain('diff-added');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty entity list', () => {
        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', 'Old', 'New')
        );

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          'anyEntity',
          []
        );

        expect(result).toHaveLength(0);
      });

      it('should handle undefined changedEntityName', () => {
        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', 'Old', 'New')
        );

        const columns = [
          createMockTableColumn('testColumn', 'Test Display Name'),
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          undefined,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toBe('Test Display Name');
      });

      it('should handle empty old and new values', () => {
        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('displayName', '', '')
        );

        const columns = [
          createMockTableColumn('testColumn', 'Existing Display Name'),
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          'testColumn',
          columns
        );

        expect(result).toHaveLength(1);
        // Should preserve the existing display name when both old and new are empty
        expect(result[0].displayName).toBe('Existing Display Name');
      });

      it('should handle added field change', () => {
        const newDisplayName = 'New Added Display Name';
        const entityName = 'testColumn';

        const entityDiff = createMockEntityDiff(
          createMockFieldChange('displayName', '', newDisplayName),
          undefined,
          undefined
        );

        const columns = [createMockTableColumn(entityName, '')];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          entityName,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toContain('diff-added');
      });

      it('should handle deleted field change', () => {
        const oldDisplayName = 'Deleted Display Name';
        const entityName = 'testColumn';

        const entityDiff = createMockEntityDiff(
          undefined,
          createMockFieldChange('displayName', oldDisplayName, ''),
          undefined
        );

        const columns = [createMockTableColumn(entityName, oldDisplayName)];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DISPLAYNAME,
          entityName,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toContain('diff-removed');
      });
    });

    describe('Different EntityField values', () => {
      it('should handle DATA_TYPE_DISPLAY field', () => {
        const oldDataTypeDisplay = 'VARCHAR(255)';
        const newDataTypeDisplay = 'TEXT';
        const entityName = 'testColumn';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange(
            EntityField.DATA_TYPE_DISPLAY,
            oldDataTypeDisplay,
            newDataTypeDisplay
          )
        );

        const columns = [
          {
            ...createMockTableColumn(entityName),
            dataTypeDisplay: oldDataTypeDisplay,
          },
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.DATA_TYPE_DISPLAY,
          entityName,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].dataTypeDisplay).toContain('diff-removed');
        expect(result[0].dataTypeDisplay).toContain('diff-added');
      });

      it('should handle NAME field', () => {
        const oldName = 'oldColumnName';
        const newName = 'newColumnName';
        const entityName = 'oldColumnName';

        const entityDiff = createMockEntityDiff(
          undefined,
          undefined,
          createMockFieldChange('name', oldName, newName)
        );

        const columns = [
          { ...createMockTableColumn(entityName), name: oldName },
        ];

        const result = getStringEntityDiff(
          entityDiff,
          EntityField.NAME,
          entityName,
          columns
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toContain('diff-removed');
        expect(result[0].name).toContain('diff-added');
      });
    });
  });

  describe('getComputeRowCountDiffDisplay', () => {
    it('should return fallback value as string when no diff exists', () => {
      const changeDescription: ChangeDescription = {
        fieldsAdded: [],
        fieldsDeleted: [],
        fieldsUpdated: [],
      };

      const result = getComputeRowCountDiffDisplay(changeDescription, true);

      expect(result).toBe('true');
    });

    it('should return diff elements when field is updated', () => {
      const changeDescription: ChangeDescription = {
        fieldsAdded: [],
        fieldsDeleted: [],
        fieldsUpdated: [
          {
            name: 'computePassedFailedRowCount',
            oldValue: 'false',
            newValue: 'true',
          },
        ],
      };

      const result = getComputeRowCountDiffDisplay(changeDescription, false);

      // Should return an array of React elements for diff display
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return added diff element when field is added', () => {
      const changeDescription: ChangeDescription = {
        fieldsAdded: [
          {
            name: 'computePassedFailedRowCount',
            newValue: 'true',
          },
        ],
        fieldsDeleted: [],
        fieldsUpdated: [],
      };

      const result = getComputeRowCountDiffDisplay(changeDescription, false);

      // Should return a React element for added diff
      expect(result).toBeDefined();
    });

    it('should return removed diff element when field is deleted', () => {
      const changeDescription: ChangeDescription = {
        fieldsAdded: [],
        fieldsDeleted: [
          {
            name: 'computePassedFailedRowCount',
            oldValue: 'true',
          },
        ],
        fieldsUpdated: [],
      };

      const result = getComputeRowCountDiffDisplay(changeDescription, false);

      // Should return a React element for removed diff
      expect(result).toBeDefined();
    });
  });
});
