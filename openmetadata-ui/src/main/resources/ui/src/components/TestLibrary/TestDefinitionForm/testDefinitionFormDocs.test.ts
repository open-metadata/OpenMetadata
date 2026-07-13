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
import enUs from '../../../locale/languages/en-us.json';
import { TEST_DEFINITION_FIELD_DOCS } from './testDefinitionFormDocs';

// Every Test Definition form field whose per-field doc backs the modal Form-Hint
// popover. The popover sources its copy from TestDefinitionForm.md at runtime and
// falls back to these i18n keys, so each key MUST resolve in en-US.
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

// Fields whose docs intentionally reuse an existing, already-localized drawer
// helper key instead of a dedicated `doc-field-*` key.
const REUSED_FIELDS: Record<string, string> = {
  sqlExpression: 'message.test-definition-sql-query-help',
  supportedServices: 'message.supported-services-help',
  parameterDefinition: 'message.test-definition-parameters-description',
};

const messages = enUs.message as unknown as Record<string, string>;
const resolvesInEnUs = (docKey: string): boolean =>
  Boolean(messages[docKey.replace('message.', '')]);

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

  it('every field doc key resolves in en-US so the popover always has fallback copy', () => {
    EXPECTED_FIELDS.forEach((field) => {
      expect(resolvesInEnUs(TEST_DEFINITION_FIELD_DOCS[field])).toBe(true);
    });
  });

  it('reuses the existing drawer helper keys for the shared fields', () => {
    Object.entries(REUSED_FIELDS).forEach(([field, key]) => {
      expect(TEST_DEFINITION_FIELD_DOCS[field]).toBe(key);
    });
  });
});
