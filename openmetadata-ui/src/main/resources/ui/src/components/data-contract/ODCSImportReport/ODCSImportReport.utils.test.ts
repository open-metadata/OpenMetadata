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
import { OdcsImportIssueCategory } from '../../../generated/entity/datacontract/contractValidation';
import {
  MOCK_BLOCKED_IMPORT_REPORT,
  MOCK_IMPORT_REPORT,
} from './ODCSImportReport.mock';
import { ImportStatus } from './ODCSImportReport.types';
import {
  getImportStatus,
  getQualityRuleSummary,
  getReportSections,
  getWarningCount,
} from './ODCSImportReport.utils';

describe('ODCSImportReport utils', () => {
  it('splits issues by severity and groups warnings by category in a fixed order', () => {
    const sections = getReportSections(MOCK_IMPORT_REPORT);

    expect(sections.blocking).toHaveLength(0);
    expect(sections.info).toHaveLength(1);
    expect(sections.warnings.map((group) => group.category)).toEqual([
      OdcsImportIssueCategory.Schema,
      OdcsImportIssueCategory.Servers,
    ]);
  });

  it('counts what the quality rules become', () => {
    expect(getQualityRuleSummary(MOCK_IMPORT_REPORT)).toEqual({
      total: 3,
      testCases: 1,
      sla: 1,
      notExecuted: 1,
    });
  });

  it('counts warnings once per reported field, not per occurrence', () => {
    expect(getWarningCount(MOCK_IMPORT_REPORT)).toBe(2);
  });

  it('reports a document with warnings as ready with warnings', () => {
    expect(getImportStatus(MOCK_IMPORT_REPORT)).toBe(
      ImportStatus.ReadyWithWarnings
    );
  });

  it('reports a document that cannot be imported as blocked', () => {
    expect(getImportStatus(MOCK_BLOCKED_IMPORT_REPORT)).toBe(
      ImportStatus.Blocked
    );
  });

  it('reports a clean document as ready', () => {
    expect(getImportStatus({ canImport: true, issues: [] })).toBe(
      ImportStatus.Ready
    );
  });

  it('treats a missing report as empty', () => {
    expect(getReportSections(undefined)).toEqual({
      blocking: [],
      warnings: [],
      info: [],
    });
    expect(getQualityRuleSummary(undefined).total).toBe(0);
  });
});
