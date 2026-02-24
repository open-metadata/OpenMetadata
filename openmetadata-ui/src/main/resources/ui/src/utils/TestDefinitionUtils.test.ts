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

import {
  TestDefinition,
  TestPlatform,
} from '../generated/tests/testDefinition';
import {
  isExternalTestDefinition,
  mapUrlValueToOption,
} from './TestDefinitionUtils';

describe('TestDefinitionUtils', () => {
  describe('isExternalTestDefinition', () => {
    it('should return true when testPlatforms does not include OpenMetadata', () => {
      const externalTest: TestDefinition = {
        id: 'test-1',
        name: 'dbtTest',
        testPlatforms: [TestPlatform.Dbt],
      } as TestDefinition;

      expect(isExternalTestDefinition(externalTest)).toBe(true);
    });

    it('should return true when testPlatforms includes only external platforms', () => {
      const externalTest: TestDefinition = {
        id: 'test-2',
        name: 'multiPlatformTest',
        testPlatforms: [
          TestPlatform.Dbt,
          TestPlatform.GreatExpectations,
          TestPlatform.Soda,
        ],
      } as TestDefinition;

      expect(isExternalTestDefinition(externalTest)).toBe(true);
    });

    it('should return false when testPlatforms includes OpenMetadata', () => {
      const openMetadataTest: TestDefinition = {
        id: 'test-3',
        name: 'omTest',
        testPlatforms: [TestPlatform.OpenMetadata],
      } as TestDefinition;

      expect(isExternalTestDefinition(openMetadataTest)).toBe(false);
    });

    it('should return false when testPlatforms includes OpenMetadata and other platforms', () => {
      const mixedTest: TestDefinition = {
        id: 'test-4',
        name: 'mixedTest',
        testPlatforms: [TestPlatform.OpenMetadata, TestPlatform.Dbt],
      } as TestDefinition;

      expect(isExternalTestDefinition(mixedTest)).toBe(false);
    });

    it('should return false when testPlatforms is undefined', () => {
      const testWithoutPlatforms: TestDefinition = {
        id: 'test-5',
        name: 'noPlatformTest',
      } as TestDefinition;

      expect(isExternalTestDefinition(testWithoutPlatforms)).toBe(false);
    });

    it('should return false when testPlatforms is empty array', () => {
      const testWithEmptyPlatforms = {
        id: 'test-6',
        name: 'emptyPlatformTest',
        testPlatforms: [],
      } as unknown as TestDefinition;

      expect(isExternalTestDefinition(testWithEmptyPlatforms)).toBe(false);
    });

    it('should return false when testDefinition is undefined', () => {
      expect(isExternalTestDefinition()).toBe(false);
    });

    it('should handle Great Expectations platform correctly', () => {
      const geTest: TestDefinition = {
        id: 'test-7',
        name: 'geTest',
        testPlatforms: [TestPlatform.GreatExpectations],
      } as TestDefinition;

      expect(isExternalTestDefinition(geTest)).toBe(true);
    });

    it('should handle Soda platform correctly', () => {
      const sodaTest: TestDefinition = {
        id: 'test-8',
        name: 'sodaTest',
        testPlatforms: [TestPlatform.Soda],
      } as TestDefinition;

      expect(isExternalTestDefinition(sodaTest)).toBe(true);
    });

    it('should handle Deequ platform correctly', () => {
      const deequTest: TestDefinition = {
        id: 'test-9',
        name: 'deequTest',
        testPlatforms: [TestPlatform.Deequ],
      } as TestDefinition;

      expect(isExternalTestDefinition(deequTest)).toBe(true);
    });

    it('should handle Other platform correctly', () => {
      const otherTest: TestDefinition = {
        id: 'test-10',
        name: 'otherTest',
        testPlatforms: [TestPlatform.Other],
      } as TestDefinition;

      expect(isExternalTestDefinition(otherTest)).toBe(true);
    });
  });

  describe('mapUrlValueToOption', () => {
    const mockOptions = [
      { key: 'TABLE', label: 'Table' },
      { key: 'COLUMN', label: 'Column' },
      { key: 'DATABASE', label: 'Database' },
    ];

    it('should map value to option label when option is found', () => {
      const result = mapUrlValueToOption('TABLE', mockOptions);

      expect(result).toEqual({ key: 'TABLE', label: 'Table' });
    });

    it('should map value to option label for different keys', () => {
      const result = mapUrlValueToOption('COLUMN', mockOptions);

      expect(result).toEqual({ key: 'COLUMN', label: 'Column' });
    });

    it('should use value as label when option is not found', () => {
      const result = mapUrlValueToOption('UNKNOWN_KEY', mockOptions);

      expect(result).toEqual({ key: 'UNKNOWN_KEY', label: 'UNKNOWN_KEY' });
    });

    it('should use value as label when options array is empty', () => {
      const result = mapUrlValueToOption('TABLE', []);

      expect(result).toEqual({ key: 'TABLE', label: 'TABLE' });
    });

    it('should use value as label when options is undefined', () => {
      const result = mapUrlValueToOption('TABLE');

      expect(result).toEqual({ key: 'TABLE', label: 'TABLE' });
    });

    it('should handle empty string value', () => {
      const result = mapUrlValueToOption('', mockOptions);

      expect(result).toEqual({ key: '', label: '' });
    });

    it('should handle case-sensitive matching', () => {
      const result = mapUrlValueToOption('table', mockOptions);

      expect(result).toEqual({ key: 'table', label: 'table' });
    });

    it('should preserve the original value key even when label is different', () => {
      const customOptions = [{ key: 'TEST_KEY', label: 'Test Label' }];
      const result = mapUrlValueToOption('TEST_KEY', customOptions);

      expect(result.key).toBe('TEST_KEY');
      expect(result.label).toBe('Test Label');
    });

    it('should work with localized labels', () => {
      const localizedOptions = [
        { key: 'TABLE', label: 'Tableau' },
        { key: 'COLUMN', label: 'Colonne' },
      ];
      const result = mapUrlValueToOption('TABLE', localizedOptions);

      expect(result).toEqual({ key: 'TABLE', label: 'Tableau' });
    });

    it('should return consistent structure for found and not found values', () => {
      const foundResult = mapUrlValueToOption('TABLE', mockOptions);
      const notFoundResult = mapUrlValueToOption('NOTFOUND', mockOptions);

      expect(foundResult).toHaveProperty('key');
      expect(foundResult).toHaveProperty('label');
      expect(notFoundResult).toHaveProperty('key');
      expect(notFoundResult).toHaveProperty('label');
    });
  });
});
