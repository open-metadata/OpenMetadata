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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertTriangle, InfoCircle, XCircle } from '@untitledui/icons';
import { TFunction } from 'i18next';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OdcsImportIssue,
  OdcsImportIssueCategory,
  OdcsQualityRuleOutcome,
  Outcome,
} from '../../../generated/entity/datacontract/contractValidation';
import { ODCSImportReportProps } from './ODCSImportReport.types';
import { getReportSections } from './ODCSImportReport.utils';

const BLOCKING_SECTION = 'blocking';
const QUALITY_RULES_SECTION = 'quality-rules';
const NOT_IMPORTED_SECTION = 'not-imported';
const KEPT_FOR_EXPORT_SECTION = 'kept-for-export';

type IssueTone = 'error' | 'warning' | 'info';

const ISSUE_ICONS = {
  error: { Icon: XCircle, className: 'tw:text-utility-error-600' },
  warning: { Icon: AlertTriangle, className: 'tw:text-utility-warning-600' },
  info: { Icon: InfoCircle, className: 'tw:text-utility-gray-500' },
} as const;

const getCategoryLabel = (category: OdcsImportIssueCategory, t: TFunction) => {
  const labels: Record<OdcsImportIssueCategory, string> = {
    [OdcsImportIssueCategory.Document]: t('label.document'),
    [OdcsImportIssueCategory.Schema]: t('label.schema'),
    [OdcsImportIssueCategory.Quality]: t('label.quality'),
    [OdcsImportIssueCategory.Sla]: t('label.sla'),
    [OdcsImportIssueCategory.Team]: t('label.team'),
    [OdcsImportIssueCategory.Roles]: t('label.role-plural'),
    [OdcsImportIssueCategory.Servers]: t('label.server-plural'),
    [OdcsImportIssueCategory.Support]: t('label.support'),
    [OdcsImportIssueCategory.Other]: t('label.other'),
  };

  return labels[category];
};

const SectionTitle = ({ label, count }: { label: string; count: number }) => (
  <Box align="center" gap={2}>
    <Typography size="text-sm" weight="semibold">
      {label}
    </Typography>
    <Badge color="gray" size="sm" type="color">
      {count}
    </Badge>
  </Box>
);

const IssueRow = ({
  issue,
  tone,
}: {
  issue: OdcsImportIssue;
  tone: IssueTone;
}) => {
  const { t } = useTranslation();
  const { Icon, className } = ISSUE_ICONS[tone];
  const occurrences = issue.occurrences ?? 1;

  return (
    <li className="tw:flex tw:items-start tw:gap-2">
      <Icon
        aria-hidden="true"
        className={`${className} tw:mt-0.5 tw:shrink-0`}
        size={16}
      />
      <div className="tw:min-w-0 tw:flex-1">
        <Typography as="p" className="tw:wrap-break-word" size="text-sm">
          {issue.message}
        </Typography>
        {issue.path && (
          <Typography
            as="p"
            className="tw:font-mono tw:text-tertiary tw:wrap-break-word"
            size="text-xs">
            {issue.path}
          </Typography>
        )}
      </div>
      {occurrences > 1 && (
        <Badge color="gray" size="sm" type="color">
          {t('label.occurrence-count', { count: occurrences })}
        </Badge>
      )}
    </li>
  );
};

const IssueList = ({
  issues,
  tone,
  testId,
}: {
  issues: OdcsImportIssue[];
  tone: IssueTone;
  testId: string;
}) => (
  <ul
    className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0"
    data-testid={testId}>
    {issues.map((issue) => (
      <IssueRow
        issue={issue}
        key={`${issue.severity}-${issue.field}-${issue.message}`}
        tone={tone}
      />
    ))}
  </ul>
);

const RuleOutcomeBadge = ({ outcome }: { outcome: Outcome }) => {
  const { t } = useTranslation();
  const badges = {
    [Outcome.TestCase]: { color: 'success', label: t('label.test-case') },
    [Outcome.Sla]: { color: 'blue', label: t('label.sla') },
    [Outcome.NotExecuted]: { color: 'gray', label: t('label.not-run') },
  } as const;
  const { color, label } = badges[outcome];

  return (
    <Badge color={color} size="sm" type="color">
      {label}
    </Badge>
  );
};

// Rules sharing a name on one column get distinct test case names, so the key stays unique.
const getRuleKey = (rule: OdcsQualityRuleOutcome) =>
  [rule.column, rule.name, rule.outcome, rule.testCaseName ?? rule.reason].join(
    '|'
  );

const QualityRuleRow = ({ rule }: { rule: OdcsQualityRuleOutcome }) => {
  const detail =
    rule.outcome === Outcome.TestCase
      ? `${rule.testDefinition} · ${rule.testCaseName}`
      : rule.reason;

  return (
    <li className="tw:flex tw:items-start tw:justify-between tw:gap-3">
      <div className="tw:min-w-0 tw:flex-1">
        <Typography as="p" size="text-sm" weight="medium">
          {rule.name}
          {rule.column && (
            <span className="tw:text-tertiary"> · {rule.column}</span>
          )}
        </Typography>
        {detail && (
          <Typography
            as="p"
            className="tw:text-tertiary tw:wrap-break-word"
            size="text-xs">
            {detail}
          </Typography>
        )}
      </div>
      <RuleOutcomeBadge outcome={rule.outcome} />
    </li>
  );
};

const ODCSImportReport: FC<ODCSImportReportProps> = ({ report }) => {
  const { t } = useTranslation();
  const sections = useMemo(() => getReportSections(report), [report]);
  const rules = report.qualityRules ?? [];
  const notImportedCount = sections.warnings.reduce(
    (total, group) => total + group.issues.length,
    0
  );
  const defaultExpandedKeys = useMemo(
    () =>
      sections.blocking.length > 0
        ? [BLOCKING_SECTION]
        : [QUALITY_RULES_SECTION],
    [sections.blocking.length]
  );

  return (
    <Accordion
      allowsMultipleExpanded
      className="tw:mt-4"
      data-testid="odcs-import-report"
      defaultExpandedKeys={defaultExpandedKeys}>
      {sections.blocking.length > 0 && (
        <AccordionItem id={BLOCKING_SECTION}>
          <AccordionHeader>
            <SectionTitle
              count={sections.blocking.length}
              label={t('label.blocking-issue-plural')}
            />
          </AccordionHeader>
          <AccordionPanel>
            <IssueList
              issues={sections.blocking}
              testId="odcs-report-blocking-issues"
              tone="error"
            />
          </AccordionPanel>
        </AccordionItem>
      )}
      {rules.length > 0 && (
        <AccordionItem id={QUALITY_RULES_SECTION}>
          <AccordionHeader>
            <SectionTitle
              count={rules.length}
              label={t('label.quality-rule-plural')}
            />
          </AccordionHeader>
          <AccordionPanel>
            <ul
              className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0"
              data-testid="odcs-report-quality-rules">
              {rules.map((rule) => (
                <QualityRuleRow key={getRuleKey(rule)} rule={rule} />
              ))}
            </ul>
          </AccordionPanel>
        </AccordionItem>
      )}
      {notImportedCount > 0 && (
        <AccordionItem id={NOT_IMPORTED_SECTION}>
          <AccordionHeader>
            <SectionTitle
              count={notImportedCount}
              label={t('label.not-imported')}
            />
          </AccordionHeader>
          <AccordionPanel>
            <Box data-testid="odcs-report-not-imported" direction="col" gap={4}>
              {sections.warnings.map((group) => (
                <div key={group.category}>
                  <Typography
                    as="p"
                    className="tw:mb-2 tw:text-secondary"
                    size="text-xs"
                    weight="semibold">
                    {getCategoryLabel(group.category, t)}
                  </Typography>
                  <IssueList
                    issues={group.issues}
                    testId={`odcs-report-not-imported-${group.category}`}
                    tone="warning"
                  />
                </div>
              ))}
            </Box>
          </AccordionPanel>
        </AccordionItem>
      )}
      {sections.info.length > 0 && (
        <AccordionItem id={KEPT_FOR_EXPORT_SECTION}>
          <AccordionHeader>
            <SectionTitle
              count={sections.info.length}
              label={t('label.kept-for-export-only')}
            />
          </AccordionHeader>
          <AccordionPanel>
            <IssueList
              issues={sections.info}
              testId="odcs-report-info"
              tone="info"
            />
          </AccordionPanel>
        </AccordionItem>
      )}
    </Accordion>
  );
};

export default ODCSImportReport;
