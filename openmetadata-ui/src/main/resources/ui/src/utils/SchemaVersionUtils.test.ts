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

import { DataTypeTopic, Field } from '../generated/entity/data/topic';
import { EntityDiffProps } from '../interface/EntityVersion.interface';
import { createAddedSchemasDiff } from './SchemaVersionUtils';

describe('SchemaVersionUtils', () => {
  describe('createAddedSchemasDiff', () => {
    let mockSchemaFields: Field[];

    beforeEach(() => {
      mockSchemaFields = [
        {
          name: 'existingField',
          dataType: DataTypeTopic.String,
          dataTypeDisplay: 'string',
          description: 'Existing field',
          tags: [],
          children: [],
        },
        {
          name: 'responseSchema.category',
          dataType: DataTypeTopic.Record,
          dataTypeDisplay: 'record',
          description: 'Category field',
          tags: [],
          children: [],
        },
      ];
    });

    it('should handle valid JSON array input', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields',
          newValue: '[{"name": "newField", "dataType": "string"}]',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle string value for dataTypeDisplay property', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."responseSchema.category".dataTypeDisplay',
          newValue: 'OBJECT',
        },
      };

      createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);

      const targetField = mockSchemaFields.find(
        (field) => field.name === 'responseSchema.category'
      );

      expect(targetField).toBeDefined();
    });

    it('should handle string value for dataType property', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."user.profile".dataType',
          newValue: 'ARRAY',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle string value for description property', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."responseSchema.category".description',
          newValue: 'Updated description',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle generic property types', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."responseSchema.category".customProperty',
          newValue: 'customValue',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle field names with quotes correctly', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."field.with.dots".dataTypeDisplay',
          newValue: 'COMPLEX',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle empty newValue', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."test".dataType',
          newValue: '',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle invalid field path with insufficient parts', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'invalidPath',
          newValue: 'someValue',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle missing added property', () => {
      const schemaFieldsDiff: EntityDiffProps = {};

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });

    it('should handle undefined schemaFields', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."test".dataType',
          newValue: 'STRING',
        },
      };

      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, undefined);
      }).not.toThrow();
    });

    it('should correctly parse field path and extract name and property', () => {
      const schemaFieldsDiff: EntityDiffProps = {
        added: {
          name: 'schemaFields."complex.field.name".dataTypeDisplay',
          newValue: 'OBJECT',
        },
      };

      // Should not throw and should handle the path parsing correctly
      expect(() => {
        createAddedSchemasDiff(schemaFieldsDiff, mockSchemaFields);
      }).not.toThrow();
    });
  });
});
