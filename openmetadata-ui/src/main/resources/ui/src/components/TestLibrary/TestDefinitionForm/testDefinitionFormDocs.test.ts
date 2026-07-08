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
import { TEST_DEFINITION_FIELD_DOCS } from './testDefinitionFormDocs';

// The Test Definition form fields whose per-field docs are deferred but seamed.
const EXPECTED_FIELDS = [
  'name',
  'displayName',
  'description',
  'sqlExpression',
  'entityType',
  'testPlatforms',
  'dataQualityDimension',
  'supportedServices',
  'supportedDataTypes',
  'parameterDefinition',
];

describe('TEST_DEFINITION_FIELD_DOCS', () => {
  it('has a doc key for every form field and no extras', () => {
    expect(Object.keys(TEST_DEFINITION_FIELD_DOCS).sort()).toEqual(
      [...EXPECTED_FIELDS].sort()
    );
  });

  it('maps every field to a non-empty i18n key string', () => {
    Object.values(TEST_DEFINITION_FIELD_DOCS).forEach((docKey) => {
      expect(typeof docKey).toBe('string');
      expect(docKey.length).toBeGreaterThan(0);
    });
  });

  it('reuses the existing drawer helper keys for the fields that already have them', () => {
    expect(TEST_DEFINITION_FIELD_DOCS.sqlExpression).toBe(
      'message.test-definition-sql-query-help'
    );
    expect(TEST_DEFINITION_FIELD_DOCS.supportedServices).toBe(
      'message.supported-services-help'
    );
    expect(TEST_DEFINITION_FIELD_DOCS.parameterDefinition).toBe(
      'message.test-definition-parameters-description'
    );
  });
});
