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

/**
 * Per-field documentation i18n keys for the Test Definition form's `modal`
 * variant "Form Hint" popover.
 *
 * The popover sources its copy from `TestDefinitionForm.md` at runtime (the same
 * markdown that backs the drawer's ServiceDocPanel) via `loadFormFieldDocs`, and
 * falls back to these keys when the markdown is unavailable — so every key must
 * resolve in the locales. `TestDefinitionFormBody` wires them into each field as
 * `doc: fieldDocs[x] ?? t(TEST_DEFINITION_FIELD_DOCS.x)`; the `drawer` variant
 * keeps the full ServiceDocPanel and ignores this map.
 */
export const TEST_DEFINITION_FIELD_DOCS: Record<string, string> = {
  name: 'message.doc-field-test-definition-name',
  displayName: 'message.doc-field-test-definition-display-name',
  description: 'message.doc-field-test-definition-description',
  sqlExpression: 'message.test-definition-sql-query-help',
  entityType: 'message.doc-field-test-definition-entity-type',
  testPlatforms: 'message.doc-field-test-definition-test-platforms',
  dataQualityDimension:
    'message.doc-field-test-definition-data-quality-dimension',
  supportedServices: 'message.supported-services-help',
  supportedDataTypes: 'message.doc-field-test-definition-supported-data-types',
  parameterDefinition: 'message.test-definition-parameters-description',
};
