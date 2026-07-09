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

// Fields whose docs reuse an existing, already-localized drawer helper key —
// these MUST resolve in en-US today.
const REUSED_FIELDS = [
  'sqlExpression',
  'supportedServices',
  'parameterDefinition',
];
// Remaining fields point at deferred `doc-field-*` keys that are intentionally
// not in the locales until the modal Form-Hint seam is enabled.
const DEFERRED_FIELDS = EXPECTED_FIELDS.filter(
  (field) => !REUSED_FIELDS.includes(field)
);

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

  it('reuses existing drawer helper keys that already resolve in en-US', () => {
    REUSED_FIELDS.forEach((field) => {
      expect(resolvesInEnUs(TEST_DEFINITION_FIELD_DOCS[field])).toBe(true);
    });

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

  it('deferred field docs are placeholders not yet in en-US (add them before enabling the modal Form-Hint seam)', () => {
    DEFERRED_FIELDS.forEach((field) => {
      expect(resolvesInEnUs(TEST_DEFINITION_FIELD_DOCS[field])).toBe(false);
    });
  });
});
