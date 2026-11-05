/*
 *  Copyright 2026 Collate.
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
  OdcsImportIssueCategory,
  OdcsImportIssueSeverity,
  ODCSImportReport,
  Outcome,
} from '../../../generated/entity/datacontract/contractValidation';

export const MOCK_IMPORT_REPORT: ODCSImportReport = {
  odcsVersion: 'v3.1.0',
  canImport: true,
  canCreateTestCases: true,
  issues: [
    {
      severity: OdcsImportIssueSeverity.Warning,
      category: OdcsImportIssueCategory.Schema,
      field: 'businessName',
      path: 'schema[0].properties[0].businessName',
      occurrences: 25,
      message:
        '`businessName` is not imported. OpenMetadata contract columns have no equivalent.',
    },
    {
      severity: OdcsImportIssueSeverity.Warning,
      category: OdcsImportIssueCategory.Servers,
      field: 'servers',
      path: 'servers',
      occurrences: 1,
      message:
        "`servers` is not imported. OpenMetadata takes connection details from the table's service.",
    },
    {
      severity: OdcsImportIssueSeverity.Info,
      category: OdcsImportIssueCategory.Schema,
      field: 'authoritativeDefinitions',
      path: 'schema[0].properties[2].authoritativeDefinitions',
      occurrences: 1,
      message:
        '`authoritativeDefinitions` is kept for ODCS export but not shown in OpenMetadata.',
    },
  ],
  qualityRules: [
    {
      name: 'Row count range',
      column: 'orders',
      outcome: Outcome.TestCase,
      testDefinition: 'tableRowCountToBeBetween',
      testCaseName: 'odcs_row_count_range',
    },
    {
      name: 'Updated recently',
      column: 'updated_at',
      outcome: Outcome.Sla,
      reason: "Sets the contract's refresh frequency to every 24 hour.",
    },
    {
      name: 'Steward review',
      outcome: Outcome.NotExecuted,
      reason:
        'It is a text rule: a prose expectation with nothing for OpenMetadata to run.',
    },
  ],
};

export const MOCK_BLOCKED_IMPORT_REPORT: ODCSImportReport = {
  ...MOCK_IMPORT_REPORT,
  canImport: false,
  issues: [
    {
      severity: OdcsImportIssueSeverity.Blocking,
      category: OdcsImportIssueCategory.Schema,
      field: 'e_mail',
      path: 'schema',
      occurrences: 1,
      message: 'Column `e_mail` is in the contract but not in the table.',
    },
    ...(MOCK_IMPORT_REPORT.issues ?? []),
  ],
};
