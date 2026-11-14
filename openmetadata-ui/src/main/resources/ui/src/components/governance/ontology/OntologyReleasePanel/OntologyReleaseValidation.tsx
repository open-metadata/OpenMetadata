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
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  Check,
  Minus,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OntologyProfileReport,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import {
  FindingSeverity,
  LogicalCheck,
  OntologyReleaseValidation as OntologyReleaseValidationReport,
} from '../../../../generated/api/data/ontologyReleaseValidation';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { ONTOLOGY_RELEASE_VALIDATION_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyPublication';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getOntologyReleaseValidation,
  getOntologyWorkingValidation,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import { makeReadableViolationMessage } from '../../../OntologyExplorer/utils/conflictHighlight';

export const useReleaseValidation = (release?: OntologyRelease) => {
  const userId = useApplicationStore((store) => store.currentUser?.id);
  const validation = useQuery({
    queryKey: [
      ONTOLOGY_RELEASE_VALIDATION_QUERY_KEY,
      release?.id,
      release?.contentDigest,
      release?.baseReleaseId,
      userId,
    ],
    enabled: Boolean(release),
    queryFn: async ({ signal }) => {
      if (!release) {
        throw new Error('Missing ontology release');
      }
      const report = await getOntologyReleaseValidation(release.id, signal);
      const matchesRelease = [
        report.releaseId === release.id,
        report.contentDigest === release.contentDigest,
        report.baseReleaseId === release.baseReleaseId,
        report.structure.releaseId === release.id,
        report.structure.contentDigest === release.contentDigest,
      ].every(Boolean);
      if (!matchesRelease) {
        throw new Error(
          'Ontology validation does not match the captured release'
        );
      }

      return report;
    },
    retry: false,
    gcTime: 0,
  });

  return validation;
};

export const ONTOLOGY_WORKING_VALIDATION_QUERY_KEY =
  'ontology-working-validation';

export interface WorkingDraft {
  ontologyId: string;
  /** The working revision the report is for; a new revision asks again. */
  revision?: number;
}

/** Checks the whole working draft, so a structure error shows before any capture. */
export const useWorkingValidation = (draft: WorkingDraft | undefined) => {
  const userId = useApplicationStore((store) => store.currentUser?.id);

  return useQuery({
    queryKey: [
      ONTOLOGY_WORKING_VALIDATION_QUERY_KEY,
      draft?.ontologyId,
      draft?.revision,
      userId,
    ],
    enabled: Boolean(draft?.ontologyId),
    queryFn: () => getOntologyWorkingValidation(draft?.ontologyId ?? ''),
    retry: false,
    gcTime: 0,
  });
};

/** The error-severity messages of a working draft report, in report order. */
export const firstWorkingErrors = (
  report: OntologyProfileReport | undefined,
  limit = 3
) =>
  report
    ? report.violations
        .filter(({ severity }) => severity === Severity.Error)
        .map(({ message }) => message)
        .slice(0, limit)
    : [];

const settledReport = <T,>(validation: {
  isSuccess: boolean;
  isFetching: boolean;
  data?: T;
}) =>
  validation.isSuccess && !validation.isFetching ? validation.data : undefined;

export const useSettledValidationReport = (release?: OntologyRelease | null) =>
  settledReport(useReleaseValidation(release ?? undefined));

/** The first messages that stop a release from publishing, in report order. */
export const firstValidationErrors = (
  report: OntologyReleaseValidationReport | undefined,
  limit = 3
) =>
  report
    ? [
        ...report.structure.violations.map(
          ({ violation }) => violation.message
        ),
        ...report.shacl.findings
          .filter(({ severity }) => severity === FindingSeverity.Violation)
          .map(({ message }) => message),
      ].slice(0, limit)
    : [];

const structureStatus = (report?: OntologyReleaseValidationReport) => {
  if (!report) {
    return 'label.not-checked';
  }

  return report.structure.valid ? 'label.passed' : 'label.failed';
};

const shaclStatus = (report?: OntologyReleaseValidationReport) => {
  if (report?.shacl.violationCount) {
    return 'label.failed';
  }

  return report?.shacl.warningCount ? 'label.warning' : 'label.passed';
};

const workingStatus = (report?: OntologyProfileReport) => {
  if (!report) {
    return 'label.not-checked';
  }

  return report.valid ? 'label.passed' : 'label.failed';
};

const introKey = (working?: WorkingDraft) =>
  working
    ? 'message.ontology-working-validation'
    : 'message.ontology-structure-after-capture';

const QueryNotice = ({
  isFetching,
  isError,
  showLoading,
  onRetry,
}: {
  isFetching: boolean;
  isError: boolean;
  showLoading: boolean;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {showLoading && isFetching && <Loader size="small" />}
      {isError && (
        <Alert variant="error">
          {t('message.ontology-validation-unavailable')}
          <Button color="secondary" size="sm" onPress={onRetry}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
    </>
  );
};

type CheckTone = 'pass' | 'fail' | 'warn' | 'idle';

const CHECK_ICONS = {
  pass: Check,
  fail: XClose,
  warn: AlertCircle,
  idle: Minus,
};

const CHECK_TONES: Record<CheckTone, string> = {
  pass: 'tw:text-success-primary',
  fail: 'tw:text-error-primary',
  warn: 'tw:text-warning-primary',
  idle: 'tw:text-tertiary',
};

const STATUS_TONES: Record<string, CheckTone> = {
  'label.passed': 'pass',
  'label.failed': 'fail',
  'label.warning': 'warn',
};

/** One check: a status icon and title, its result on the right, details below. */
const CheckRow = ({
  title,
  status,
  tone,
  testId,
  children,
}: {
  title: string;
  status: string;
  tone: CheckTone;
  testId?: string;
  children?: ReactNode;
}) => {
  const Icon = CHECK_ICONS[tone];

  return (
    <Box
      className="tw:border-t tw:border-secondary tw:pt-3"
      data-testid={testId}
      direction="col"
      gap={1}>
      <Box align="center" gap={2}>
        <Icon
          aria-hidden
          className={classNames('tw:size-4 tw:shrink-0', CHECK_TONES[tone])}
        />
        <Typography className="tw:flex-1" size="text-sm" weight="medium">
          {title}
        </Typography>
        <Typography
          as="span"
          className={CHECK_TONES[tone]}
          size="text-xs"
          weight="semibold">
          {status}
        </Typography>
      </Box>
      {children ? (
        <Box className="tw:pl-6" direction="col" gap={2}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
};

/** Findings that block publishing, in the red box the design gives them. */
const FindingList = ({
  testId,
  items,
}: {
  testId?: string;
  items: { key: string; message: string; detail?: string }[];
}) =>
  items.length > 0 ? (
    <ul
      className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:p-3"
      data-testid={testId}>
      {items.map((item) => (
        <li key={item.key}>
          <Typography
            className="tw:whitespace-pre-wrap tw:break-words tw:text-utility-error-700"
            size="text-sm"
            weight="medium">
            {item.message}
          </Typography>
          {item.detail ? (
            <Typography
              className="tw:break-words tw:font-mono tw:text-utility-error-600"
              size="text-xs">
              {item.detail}
            </Typography>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null;

const NO_CONCEPTS: ReadonlyArray<{
  name: string;
  iri?: string;
  label: string;
}> = [];

const OntologyReleaseValidation = ({
  concepts = NO_CONCEPTS,
  release,
  working,
}: {
  /** The ontology's concepts, so messages name them by display name rather than internal name. */
  concepts?: ReadonlyArray<{ name: string; iri?: string; label: string }>;
  release?: OntologyRelease;
  /** When given, the structure section reports the working draft, not the capture. */
  working?: WorkingDraft;
}) => {
  const { t } = useTranslation();
  const readable = useMemo(
    () => makeReadableViolationMessage(concepts),
    [concepts]
  );
  const validation = useReleaseValidation(release);
  const report = settledReport(validation);
  const workingValidation = useWorkingValidation(working);
  const workingReport = working ? settledReport(workingValidation) : undefined;
  const truncated = (shown: number, total: number) => (
    <Typography color="secondary" size="text-xs">
      {t('message.ontology-findings-truncated', { shown, total })}
    </Typography>
  );

  const renderWorkingStructure = () => {
    const status = workingStatus(workingReport);

    return (
      <CheckRow
        status={t(status)}
        testId="ontology-structural-validation"
        title={t('label.structural-validation')}
        tone={STATUS_TONES[status] ?? 'idle'}>
        <FindingList
          items={(workingReport?.violations ?? []).map((issue) => ({
            key: JSON.stringify(issue),
            message: readable(issue.message),
            detail: issue.path,
          }))}
          testId="ontology-working-violations"
        />
      </CheckRow>
    );
  };
  const renderStructure = () => {
    const status = structureStatus(report);

    return (
      <CheckRow
        status={t(status)}
        testId="ontology-structural-validation"
        title={t('label.structural-validation')}
        tone={STATUS_TONES[status] ?? 'idle'}>
        {report && (
          <>
            {report.structure.violationCount > 0 && (
              <Typography color="secondary" size="text-xs">
                {t('message.ontology-structure-violations', {
                  count: report.structure.violationCount,
                })}
              </Typography>
            )}
            <FindingList
              items={report.structure.violations.map((issue) => ({
                key: JSON.stringify(issue),
                message: readable(issue.violation.message),
                detail: issue.violation.path,
              }))}
            />
            {report.structure.violationCount >
              report.structure.violations.length &&
              truncated(
                report.structure.violations.length,
                report.structure.violationCount
              )}
          </>
        )}
      </CheckRow>
    );
  };
  const renderShacl = () => {
    if (!report) {
      return null;
    }
    const status = shaclStatus(report);

    return (
      <CheckRow
        status={t(status)}
        testId="ontology-shacl-validation"
        title={t('label.shacl-validation')}
        tone={STATUS_TONES[status] ?? 'idle'}>
        <Typography
          color="secondary"
          data-testid="ontology-shacl-counts"
          size="text-xs">
          {report.shacl.violationCount} {t('label.violation-plural')} ·{' '}
          {report.shacl.warningCount} {t('label.warning-plural')}
        </Typography>
        {report.shacl.findings.length > 0 && (
          <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
            {report.shacl.findings.map((finding) => (
              <li key={JSON.stringify(finding)}>
                <Badge
                  color={
                    finding.severity === FindingSeverity.Violation
                      ? 'error'
                      : 'warning'
                  }
                  size="sm">
                  {t(
                    finding.severity === FindingSeverity.Violation
                      ? 'label.violation'
                      : 'label.warning'
                  )}
                </Badge>
                <Typography
                  className="tw:whitespace-pre-wrap tw:break-words"
                  size="text-sm">
                  {readable(finding.message)}
                </Typography>
                <Typography
                  className="tw:break-words"
                  color="secondary"
                  size="text-xs">
                  {finding.focusIri} · {finding.shapeIri}
                </Typography>
              </li>
            ))}
          </ul>
        )}
        {report.shacl.truncated &&
          truncated(
            report.shacl.findings.length,
            report.shacl.violationCount + report.shacl.warningCount
          )}
      </CheckRow>
    );
  };
  const renderImpacts = () => {
    if (!report) {
      return null;
    }

    const impactCount = report.deprecationImpacts.length;

    return (
      <CheckRow
        status={
          impactCount
            ? t('message.ontology-deprecation-impact-count', {
                count: impactCount,
              })
            : t('label.none')
        }
        testId="ontology-deprecation-impact"
        title={t('label.deprecation-impact')}
        tone={impactCount ? 'warn' : 'pass'}>
        <Typography color="secondary" size="text-xs">
          {t('message.ontology-current-binding-impact')}
        </Typography>
        {impactCount === 0 && (
          <Typography size="text-sm">
            {t('message.ontology-no-deprecation-impact')}
          </Typography>
        )}
        {report.deprecationImpacts.map((impact) => (
          <Box direction="col" gap={2} key={impact.definition.id}>
            <Typography size="text-sm" weight="semibold">
              {getEntityName(impact.definition)}
            </Typography>
            <Typography
              data-testid={'ontology-impact-count-' + impact.definition.id}
              size="text-sm">
              {impact.boundAssetCount} {t('label.bound-assets')}
            </Typography>
            <ul className="tw:m-0 tw:flex tw:flex-col tw:gap-1 tw:pl-4">
              {impact.boundAssets.map((asset) => (
                <li key={asset.id}>
                  <Typography size="text-sm">{getEntityName(asset)}</Typography>
                </li>
              ))}
            </ul>
            {impact.boundAssetCount > impact.boundAssets.length &&
              truncated(impact.boundAssets.length, impact.boundAssetCount)}
            {[
              {
                label: 'label.subclass-plural',
                entries: impact.subclasses,
              },
              {
                label: 'label.domain-properties',
                entries: impact.domainProperties,
              },
              {
                label: 'label.range-properties',
                entries: impact.rangeProperties,
              },
            ].map(({ label, entries }) => (
              <Box direction="col" gap={1} key={label}>
                <Typography color="secondary" size="text-xs">
                  {t(label)}
                </Typography>
                {entries.length === 0 ? (
                  <Typography size="text-sm">{t('label.none')}</Typography>
                ) : (
                  <ul className="tw:m-0 tw:flex tw:flex-col tw:gap-1 tw:pl-4">
                    {entries.map((entry) => (
                      <li key={entry.id}>
                        <Typography size="text-sm">
                          {getEntityName(entry)}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </CheckRow>
    );
  };

  return (
    <Card data-testid="ontology-release-validation" size="sm">
      <Card.Content>
        <Box direction="col" gap={3}>
          {/* An inline heading, as the Version and Reviewers cards have, not a bordered header row. */}
          <Typography
            as="h3"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.validation')}
          </Typography>
          <Typography color="secondary" size="text-xs">
            {release
              ? t('message.ontology-captured-validation', {
                  version: release.semanticVersion ?? release.releaseRevision,
                })
              : t(introKey(working))}
          </Typography>
          <QueryNotice
            isError={Boolean(working) && workingValidation.isError}
            isFetching={workingValidation.isFetching}
            showLoading={Boolean(working)}
            onRetry={() => void workingValidation.refetch()}
          />
          <QueryNotice
            isError={validation.isError}
            isFetching={validation.isFetching}
            showLoading={Boolean(release)}
            onRetry={() => void validation.refetch()}
          />
          {working ? renderWorkingStructure() : renderStructure()}
          {renderShacl()}
          {renderImpacts()}

          <CheckRow
            status={t(
              report?.logicalCheck === LogicalCheck.NotApplicable
                ? 'label.not-applicable'
                : 'label.not-checked'
            )}
            testId="ontology-logical-consistency"
            title={t('label.logical-consistency')}
            tone="idle"
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

export default OntologyReleaseValidation;
