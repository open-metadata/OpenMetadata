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
  OdcsImportIssue,
  OdcsImportIssueCategory,
  OdcsImportIssueSeverity,
  ODCSImportReport,
  Outcome,
} from '../../../generated/entity/datacontract/contractValidation';
import {
  ImportStatus,
  IssueGroup,
  QualityRuleSummary,
  ReportSections,
} from './ODCSImportReport.types';

const CATEGORY_ORDER: OdcsImportIssueCategory[] = [
  OdcsImportIssueCategory.Document,
  OdcsImportIssueCategory.Schema,
  OdcsImportIssueCategory.Quality,
  OdcsImportIssueCategory.Sla,
  OdcsImportIssueCategory.Team,
  OdcsImportIssueCategory.Roles,
  OdcsImportIssueCategory.Servers,
  OdcsImportIssueCategory.Support,
  OdcsImportIssueCategory.Other,
];

const issuesWithSeverity = (
  report: ODCSImportReport | undefined,
  severity: OdcsImportIssueSeverity
): OdcsImportIssue[] =>
  (report?.issues ?? []).filter((issue) => issue.severity === severity);

const groupByCategory = (issues: OdcsImportIssue[]): IssueGroup[] =>
  CATEGORY_ORDER.map((category) => ({
    category,
    issues: issues.filter((issue) => issue.category === category),
  })).filter((group) => group.issues.length > 0);

export const getReportSections = (
  report: ODCSImportReport | undefined
): ReportSections => ({
  blocking: issuesWithSeverity(report, OdcsImportIssueSeverity.Blocking),
  warnings: groupByCategory(
    issuesWithSeverity(report, OdcsImportIssueSeverity.Warning)
  ),
  info: issuesWithSeverity(report, OdcsImportIssueSeverity.Info),
});

export const getQualityRuleSummary = (
  report: ODCSImportReport | undefined
): QualityRuleSummary => {
  const rules = report?.qualityRules ?? [];

  return {
    total: rules.length,
    testCases: rules.filter((rule) => rule.outcome === Outcome.TestCase).length,
    sla: rules.filter((rule) => rule.outcome === Outcome.Sla).length,
    notExecuted: rules.filter((rule) => rule.outcome === Outcome.NotExecuted)
      .length,
  };
};

export const getWarningCount = (report: ODCSImportReport | undefined) =>
  issuesWithSeverity(report, OdcsImportIssueSeverity.Warning).length;

export const getImportStatus = (
  report: ODCSImportReport | undefined
): ImportStatus => {
  if (report?.canImport === false) {
    return ImportStatus.Blocked;
  }

  return getWarningCount(report) > 0
    ? ImportStatus.ReadyWithWarnings
    : ImportStatus.Ready;
};
