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

import { clearSchemaCache, resolveJsonSchema } from './schemaResolver';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(jest.fn());
});

afterAll(() => {
  jest.spyOn(console, 'error').mockRestore();
});

beforeEach(() => {
  clearSchemaCache();
  jest.clearAllMocks();
});

describe('schemaResolver', () => {
  describe('resolveJsonSchema', () => {
    it('should return schema unchanged when there are no $ref properties', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          age: { type: 'number' as const },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result).toEqual(schema);
      expect(result).not.toBe(schema); // Should be a clone
    });

    it('should resolve internal references within the same schema', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          user: { $ref: '#/definitions/User' },
        },
        definitions: {
          User: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
              email: { type: 'string' as const },
            },
          },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.properties?.user).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      });
      expect(result.definitions).toEqual(schema.definitions);
    });

    it('should resolve nested internal references', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          data: { $ref: '#/definitions/Data' },
        },
        definitions: {
          Data: {
            type: 'object' as const,
            properties: {
              user: { $ref: '#/definitions/User' },
            },
          },
          User: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
            },
          },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.properties?.data).toEqual({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      });
    });

    it('should handle circular references by stopping recursion', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          self: { $ref: '#/definitions/Node' },
        },
        definitions: {
          Node: {
            type: 'object' as const,
            properties: {
              value: { type: 'string' as const },
              next: { $ref: '#/definitions/Node' },
            },
          },
        },
      };

      const result = await resolveJsonSchema(schema);

      // Should resolve the first level but keep the circular reference
      expect(result.properties?.self).toEqual({
        type: 'object',
        properties: {
          value: { type: 'string' },
          next: { $ref: '#/definitions/Node' },
        },
      });
    });

    it('should merge additional properties with resolved schema', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          user: {
            $ref: '#/definitions/User',
            description: 'User information',
            required: ['name'],
          },
        },
        definitions: {
          User: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
            },
          },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.properties?.user).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        description: 'User information',
        required: ['name'],
      });
    });

    it('should handle oneOf with $ref', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          value: {
            oneOf: [
              { $ref: '#/definitions/String' },
              { $ref: '#/definitions/Number' },
            ],
          },
        },
        definitions: {
          String: { type: 'string' as const },
          Number: { type: 'number' as const },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.properties?.value.oneOf).toEqual([
        { type: 'string' },
        { type: 'number' },
      ]);
    });

    it('should handle allOf with $ref', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          combined: {
            allOf: [
              { $ref: '#/definitions/Base' },
              { properties: { extra: { type: 'boolean' as const } } },
            ],
          },
        },
        definitions: {
          Base: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
            },
          },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.properties?.combined.allOf).toEqual([
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        { properties: { extra: { type: 'boolean' } } },
      ]);
    });

    it('should handle anyOf with $ref', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          value: {
            anyOf: [
              { $ref: '#/definitions/Option1' },
              { $ref: '#/definitions/Option2' },
            ],
          },
        },
        definitions: {
          Option1: { type: 'string' as const, minLength: 5 },
          Option2: { type: 'number' as const, minimum: 0 },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.properties?.value.anyOf).toEqual([
        { type: 'string', minLength: 5 },
        { type: 'number', minimum: 0 },
      ]);
    });

    it('should handle array items with $ref', async () => {
      const schema = {
        type: 'array' as const,
        items: { $ref: '#/definitions/Item' },
        definitions: {
          Item: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
            },
          },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.items).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      });
    });

    it('should handle tuple items with $ref', async () => {
      const schema = {
        type: 'array' as const,
        items: [
          { $ref: '#/definitions/First' },
          { $ref: '#/definitions/Second' },
        ],
        definitions: {
          First: { type: 'string' as const },
          Second: { type: 'number' as const },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.items).toEqual([{ type: 'string' }, { type: 'number' }]);
    });

    it('should handle nested properties with $ref', async () => {
      const schema = {
        type: 'object' as const,
        properties: {
          level1: {
            type: 'object' as const,
            properties: {
              level2: {
                type: 'object' as const,
                properties: {
                  value: { $ref: '#/definitions/Value' },
                },
              },
            },
          },
        },
        definitions: {
          Value: { type: 'string' as const, pattern: '^[A-Z]+$' },
        },
      };

      const result = await resolveJsonSchema(schema);

      const level1 = result.properties?.level1 as Record<string, unknown>;
      const level2Properties = (level1?.properties as Record<string, unknown>)
        ?.level2 as Record<string, unknown>;
      const value = (level2Properties?.properties as Record<string, unknown>)
        ?.value;

      expect(value).toEqual({
        type: 'string',
        pattern: '^[A-Z]+$',
      });
    });

    it('should preserve non-ref properties when resolving', async () => {
      const schema = {
        type: 'object' as const,
        title: 'Main Schema',
        description: 'Test schema',
        properties: {
          ref: { $ref: '#/definitions/Item' },
          normal: { type: 'boolean' as const },
        },
        required: ['ref', 'normal'],
        definitions: {
          Item: { type: 'string' as const },
        },
      };

      const result = await resolveJsonSchema(schema);

      expect(result.title).toBe('Main Schema');
      expect(result.description).toBe('Test schema');
      expect(result.required).toEqual(['ref', 'normal']);
      expect(result.properties?.ref).toEqual({ type: 'string' });
      expect(result.properties?.normal).toEqual({ type: 'boolean' });
    });
  });

  describe('clearSchemaCache', () => {
    it('should clear the schema cache', () => {
      // Just test that the function doesn't throw
      expect(() => clearSchemaCache()).not.toThrow();
    });
  });
});
