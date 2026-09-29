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
  BadgeWithIcon,
  Box,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  CheckCircle,
  CheckVerified01,
  XCircle,
  XClose,
} from '@untitledui/icons';
import { FC, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ODCSImportReport } from '../../../generated/entity/datacontract/contractValidation';
import { ImportStatus } from '../ODCSImportReport/ODCSImportReport.types';
import {
  getImportStatus,
  getQualityRuleSummary,
  getReportSections,
} from '../ODCSImportReport/ODCSImportReport.utils';

interface ODCSImportSummaryProps {
  report: ODCSImportReport;
}

const STATUS_BADGES = {
  [ImportStatus.Ready]: {
    color: 'success',
    icon: CheckVerified01,
    label: 'label.ready-to-import',
  },
  [ImportStatus.ReadyWithWarnings]: {
    color: 'warning',
    icon: AlertTriangle,
    label: 'label.ready-with-warnings',
  },
  [ImportStatus.Blocked]: {
    color: 'error',
    icon: XClose,
    label: 'label.cannot-import',
  },
} as const;

const SummaryLine = ({
  isOk,
  isWarning = false,
  children,
  testId,
}: {
  isOk: boolean;
  isWarning?: boolean;
  children: ReactNode;
  testId: string;
}) => {
  let icon = (
    <CheckCircle
      aria-hidden="true"
      className="tw:text-utility-success-700"
      size={16}
    />
  );
  if (!isOk) {
    icon = isWarning ? (
      <AlertTriangle
        aria-hidden="true"
        className="tw:text-utility-warning-600"
        size={16}
      />
    ) : (
      <XCircle
        aria-hidden="true"
        className="tw:text-utility-error-600"
        size={16}
      />
    );
  }

  return (
    <Box align="center" data-testid={testId} gap={2}>
      {icon}
      <Typography size="text-sm">{children}</Typography>
    </Box>
  );
};

/** Right-hand status card of the ODCS import dialog, summarising the import report. */
const ODCSImportSummary: FC<ODCSImportSummaryProps> = ({ report }) => {
  const { t } = useTranslation();
  const status = getImportStatus(report);
  const sections = useMemo(() => getReportSections(report), [report]);
  const rules = useMemo(() => getQualityRuleSummary(report), [report]);
  const notImported = sections.warnings.reduce(
    (total, group) => total + group.issues.length,
    0
  );
  const badge = STATUS_BADGES[status];

  return (
    <Box
      className="tw:bg-bg-secondary tw:rounded-lg tw:h-full"
      data-testid="odcs-import-summary"
      direction="col">
      <Box
        align="center"
        className="tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary"
        justify="between">
        <Typography weight="medium">{t('label.import-report')}</Typography>
        <BadgeWithIcon
          color={badge.color}
          iconLeading={badge.icon}
          size="sm"
          type="pill-color">
          {t(badge.label)}
        </BadgeWithIcon>
      </Box>
      <Box direction="col" gap={3}>
        <SummaryLine
          isOk={sections.blocking.length === 0}
          testId="odcs-summary-blocking">
          {t('label.blocking-issue-plural')} :{' '}
          <strong className="tw:font-medium">{sections.blocking.length}</strong>
        </SummaryLine>
        <SummaryLine
          isWarning
          isOk={notImported === 0}
          testId="odcs-summary-not-imported">
          {t('label.not-imported')} :{' '}
          <strong className="tw:font-medium">{notImported}</strong>
        </SummaryLine>
        {rules.total > 0 && (
          <SummaryLine
            isWarning
            isOk={rules.notExecuted === 0}
            testId="odcs-summary-quality-rules">
            {t('message.quality-rules-run-summary', {
              testCases: rules.testCases,
              total: rules.total,
            })}
          </SummaryLine>
        )}
      </Box>
    </Box>
  );
};

export default ODCSImportSummary;
