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
import { isExternalTestDefinition } from './TestDefinitionUtils';

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
});
