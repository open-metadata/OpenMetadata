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
 * Per-field documentation i18n keys for the Test Definition form.
 *
 * SETUP-READY SEAM: the `modal` variant's per-field "Form Hint" popover is
 * deferred until the core-components `FieldProp.doc` / `useFieldDoc` primitive
 * lands on `main` (see reference PR open-metadata/OpenMetadata#29784). When it
 * does, wire these into each field def via `doc: t(TEST_DEFINITION_FIELD_DOCS.x)`
 * and enable `showFieldDocs` in the modal branch — no other change required.
 * The `drawer` variant continues to use ServiceDocPanel and ignores this map.
 */
export const TEST_DEFINITION_FIELD_DOCS: Record<string, string> = {
  name: 'message.doc-field-test-definition-name',
  displayName: 'message.doc-field-display-name',
  description: 'message.doc-field-description',
  sqlExpression: 'message.test-definition-sql-query-help',
  entityType: 'message.doc-field-entity-type',
  testPlatforms: 'message.doc-field-test-platforms',
  dataQualityDimension: 'message.doc-field-data-quality-dimension',
  supportedServices: 'message.supported-services-help',
  supportedDataTypes: 'message.doc-field-supported-data-types',
  parameterDefinition: 'message.test-definition-parameters-description',
};
