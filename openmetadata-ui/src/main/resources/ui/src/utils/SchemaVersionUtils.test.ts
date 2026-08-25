/*
 *  Copyright 2023 Collate.
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

import {
  ChangeDescription,
  DataTypeTopic,
  Field,
  MessageSchemaObject,
  SchemaType,
} from '../generated/entity/data/topic';
import { FieldChange } from '../generated/entity/services/databaseService';
import { getVersionedSchema } from './SchemaVersionUtils';

// Mock data for testing
const createMockField = (
  name: string,
  dataTypeDisplay?: string,
  dataType: DataTypeTopic = DataTypeTopic.String
): Field => ({
  name,
  dataType,
  dataTypeDisplay,
  fullyQualifiedName: `test.topic.schema.${name}`,
  tags: [],
  children: [],
});

const createMockMessageSchema = (fields: Field[]): MessageSchemaObject => ({
  schemaFields: fields,
  schemaType: SchemaType.Avro,
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

const createMockChangeDescription = (
  fieldsAdded?: FieldChange[],
  fieldsDeleted?: FieldChange[],
  fieldsUpdated?: FieldChange[]
): ChangeDescription => ({
  fieldsAdded: fieldsAdded || [],
  fieldsDeleted: fieldsDeleted || [],
  fieldsUpdated: fieldsUpdated || [],
});

describe('SchemaVersionUtils', () => {
  describe('getVersionedSchema', () => {
    describe('DATA_TYPE_DISPLAY changes', () => {
      it('should update dataTypeDisplay with diff highlighting when field is changed', () => {
        const oldDataTypeDisplay = 'VARCHAR(255)';
        const newDataTypeDisplay = 'TEXT';
        const fieldName = 'testField';

        // Create mock schema with a field that has dataTypeDisplay
        const originalSchema = createMockMessageSchema([
          createMockField(fieldName, oldDataTypeDisplay),
          createMockField('otherField', 'INT'),
        ]);

        // Create change description for dataTypeDisplay update
        const changeDescription = createMockChangeDescription(
          undefined,
          undefined,
          [
            createMockFieldChange(
              `schemaFields.${fieldName}.dataTypeDisplay`,
              oldDataTypeDisplay,
              newDataTypeDisplay
            ),
          ]
        );

        // Execute the function
        const result = getVersionedSchema(originalSchema, changeDescription);

        // Verify the result
        expect(result.schemaFields).toHaveLength(2);
        expect(result.schemaFields?.[0].name).toBe(fieldName);
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          'diff-removed'
        );
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          'diff-added'
        );
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          oldDataTypeDisplay
        );
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          newDataTypeDisplay
        );

        // Other field should remain unchanged
        expect(result.schemaFields?.[1].dataTypeDisplay).toBe('INT');
      });

      it('should handle nested field dataTypeDisplay changes', () => {
        const oldDataTypeDisplay = 'STRUCT<id:INT>';
        const newDataTypeDisplay = 'STRUCT<id:BIGINT>';
        const parentFieldName = 'parentField';
        const childFieldName = 'childField';

        // Create mock schema with nested fields
        const childField = createMockField(childFieldName, oldDataTypeDisplay);
        const parentField = {
          ...createMockField(parentFieldName, 'STRUCT'),
          children: [childField],
        };
        const originalSchema = createMockMessageSchema([parentField]);

        // Create change description for nested field dataTypeDisplay update
        const changeDescription = createMockChangeDescription(
          undefined,
          undefined,
          [
            createMockFieldChange(
              `schemaFields.${parentFieldName}.children.${childFieldName}.dataTypeDisplay`,
              oldDataTypeDisplay,
              newDataTypeDisplay
            ),
          ]
        );

        // Execute the function
        const result = getVersionedSchema(originalSchema, changeDescription);

        // Verify the result
        expect(result.schemaFields).toHaveLength(1);
        expect(result.schemaFields?.[0].children).toHaveLength(1);
        expect(
          result.schemaFields?.[0].children?.[0].dataTypeDisplay
        ).toContain('diff-removed');
        expect(
          result.schemaFields?.[0].children?.[0].dataTypeDisplay
        ).toContain('diff-added');
      });

      it('should not modify fields when dataTypeDisplay change does not match', () => {
        const fieldName = 'testField';
        const originalDataTypeDisplay = 'VARCHAR(255)';

        // Create mock schema
        const originalSchema = createMockMessageSchema([
          createMockField(fieldName, originalDataTypeDisplay),
        ]);

        // Create change description for a different field
        const changeDescription = createMockChangeDescription(
          undefined,
          undefined,
          [
            createMockFieldChange(
              `schemaFields.differentField.dataTypeDisplay`,
              'OLD_VALUE',
              'NEW_VALUE'
            ),
          ]
        );

        // Execute the function
        const result = getVersionedSchema(originalSchema, changeDescription);

        // Verify the result - should remain unchanged
        expect(result.schemaFields).toHaveLength(1);
        expect(result.schemaFields?.[0].dataTypeDisplay).toBe(
          originalDataTypeDisplay
        );
      });

      it('should handle multiple dataTypeDisplay changes', () => {
        const field1Name = 'field1';
        const field2Name = 'field2';
        const oldDataType1 = 'INT';
        const newDataType1 = 'BIGINT';
        const oldDataType2 = 'STRING';
        const newDataType2 = 'TEXT';

        // Create mock schema with multiple fields
        const originalSchema = createMockMessageSchema([
          createMockField(field1Name, oldDataType1),
          createMockField(field2Name, oldDataType2),
        ]);

        // Create change description for multiple dataTypeDisplay updates
        const changeDescription = createMockChangeDescription(
          undefined,
          undefined,
          [
            createMockFieldChange(
              `schemaFields.${field1Name}.dataTypeDisplay`,
              oldDataType1,
              newDataType1
            ),
            createMockFieldChange(
              `schemaFields.${field2Name}.dataTypeDisplay`,
              oldDataType2,
              newDataType2
            ),
          ]
        );

        // Execute the function
        const result = getVersionedSchema(originalSchema, changeDescription);

        // Verify both fields are updated
        expect(result.schemaFields).toHaveLength(2);
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          'diff-removed'
        );
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          'diff-added'
        );
        expect(result.schemaFields?.[1].dataTypeDisplay).toContain(
          'diff-removed'
        );
        expect(result.schemaFields?.[1].dataTypeDisplay).toContain(
          'diff-added'
        );
      });

      it('should preserve other schema properties when updating dataTypeDisplay', () => {
        const fieldName = 'testField';
        const originalSchema = createMockMessageSchema([
          createMockField(fieldName, 'VARCHAR(255)'),
        ]);

        // Add additional schema properties
        const schemaWithExtraProps = {
          ...originalSchema,
          schemaType: SchemaType.JSON,
          schemaText: 'original schema text',
        };

        const changeDescription = createMockChangeDescription(
          undefined,
          undefined,
          [
            createMockFieldChange(
              `schemaFields.${fieldName}.dataTypeDisplay`,
              'VARCHAR(255)',
              'TEXT'
            ),
          ]
        );

        // Execute the function
        const result = getVersionedSchema(
          schemaWithExtraProps,
          changeDescription
        );

        // Verify schema properties are preserved
        expect(result.schemaType).toBe(SchemaType.JSON);
        expect(result.schemaText).toBe('original schema text');
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          'diff-removed'
        );
        expect(result.schemaFields?.[0].dataTypeDisplay).toContain(
          'diff-added'
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle empty schema fields', () => {
        const originalSchema = createMockMessageSchema([]);
        const changeDescription = createMockChangeDescription(
          undefined,
          undefined,
          [
            createMockFieldChange(
              'schemaFields.nonExistentField.dataTypeDisplay',
              'OLD',
              'NEW'
            ),
          ]
        );

        const result = getVersionedSchema(originalSchema, changeDescription);

        expect(result.schemaFields).toHaveLength(0);
      });

      it('should handle missing changeDescription fields', () => {
        const originalSchema = createMockMessageSchema([
          createMockField('testField', 'VARCHAR(255)'),
        ]);
        const changeDescription = createMockChangeDescription();

        const result = getVersionedSchema(originalSchema, changeDescription);

        expect(result.schemaFields).toHaveLength(1);
        expect(result.schemaFields?.[0].dataTypeDisplay).toBe('VARCHAR(255)');
      });
    });
  });
});
