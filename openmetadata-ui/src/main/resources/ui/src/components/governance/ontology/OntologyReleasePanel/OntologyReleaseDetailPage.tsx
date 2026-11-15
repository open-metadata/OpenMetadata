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
  Box,
  Button,
  Card,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import OntologyReviewRelease from '../OntologyReviewPanel/OntologyReviewRelease';
import OntologyReleaseBadges from './OntologyReleaseBadges';
import { ReleaseActions } from './OntologyReleaseDetails';
import OntologyReleaseEvents from './OntologyReleaseEvents';
import {
  DECISION_COLORS,
  useIsReleaseWithdrawn,
  useReleaseApproval,
  versionsById,
} from './OntologyReleaseHistory';
import {
  releaseBump,
  releaseDisplayStatus,
} from './OntologyReleasePanel.utils';
import { useReleaseValidation } from './OntologyReleaseValidation';

interface OntologyReleaseDetailPageProps {
  release: OntologyRelease;
  /** Every loaded release, to name versions and offer comparisons. */
  releases: readonly OntologyRelease[];
  activeRelease?: OntologyRelease;
  latestReleaseId?: string;
  canPublish: boolean;
  canWithdraw: boolean;
  ontologyName: string;
  onActivate: () => Promise<void>;
  onBack: () => void;
  onOpenTask?: (taskId: string) => void;
  onWithdraw?: () => void;
}

/** One line on how validation went when the release was captured. */
const ValidationLine = ({ release }: { release: OntologyRelease }) => {
  const { t } = useTranslation();
  const validation = useReleaseValidation(release);
  const report = validation.data;
  if (!report) {
    return null;
  }
  const issues = report.structure.violationCount + report.shacl.violationCount;
  const passed = report.structure.valid && issues === 0;
  const Icon = passed ? CheckCircle : XCircle;

  return (
    <Box align="center" data-testid="ontology-release-validation-line" gap={2}>
      <Icon
        aria-hidden
        className={classNames(
          'tw:size-4 tw:shrink-0',
          passed ? 'tw:text-fg-success-primary' : 'tw:text-fg-error-primary'
        )}
      />
      <Typography color="secondary" size="text-sm">
        {passed
          ? t('message.ontology-release-validation-passed')
          : t('message.ontology-release-validation-failed', { count: issues })}
      </Typography>
    </Box>
  );
};

const OntologyReleaseDetailPage = ({
  release,
  releases,
  activeRelease,
  latestReleaseId,
  canPublish,
  canWithdraw,
  ontologyName,
  onActivate,
  onBack,
  onOpenTask,
  onWithdraw,
}: OntologyReleaseDetailPageProps) => {
  const { t } = useTranslation();
  const [compareId, setCompareId] = useState<string | null>(null);
  const versionText = (entry: OntologyRelease) =>
    entry.semanticVersion
      ? 'v' + entry.semanticVersion
      : t('label.ontology-release-revision', {
          revision: entry.releaseRevision,
        });
  const versions = versionsById(releases);
  const isWithdrawn = useIsReleaseWithdrawn(release);
  const status = releaseDisplayStatus(release, activeRelease, isWithdrawn);
  const approval = useReleaseApproval(release);
  const compareTo = releases.find(({ id }) => id === compareId);
  const feedback = approval.event?.resolution?.comment;
  const isInReview = release.entityStatus === EntityStatus.InReview;
  const compareOptions = releases
    .filter(({ id }) => id !== release.id)
    .map((other) => ({ id: other.id, label: versionText(other) }));
  const approverLine = approval.isDirect
    ? t('label.published-without-review')
    : approval.name && (
        <>
          {approval.name}
          {approval.decision ? (
            <>
              {' · '}
              <span className={DECISION_COLORS[approval.decision]}>
                {t(`label.${approval.decision}`)}
              </span>
            </>
          ) : null}
        </>
      );

  const renderHeader = () => (
    <Box align="start" gap={4} justify="between" wrap="wrap">
      <Box className="tw:min-w-0" direction="col" gap={1}>
        <Box align="center" className="tw:gap-x-2 tw:gap-y-1" wrap="wrap">
          <Typography
            as="h3"
            className="not-prose tw:m-0 tw:text-primary"
            data-testid="ontology-release-detail-version"
            size="text-xl"
            weight="semibold">
            {versionText(release)}
          </Typography>
          <OntologyReleaseBadges
            bump={releaseBump(
              release.semanticVersion,
              release.baseReleaseId
                ? versions.get(release.baseReleaseId)
                : undefined
            )}
            isLatest={release.id === latestReleaseId}
            release={release}
            status={status}
          />
        </Box>
        <Typography color="secondary" size="text-sm">
          {formatDate(release.sealedAt)}
          {release.sealedBy
            ? ' · ' + t('label.by-lowercase') + ' ' + release.sealedBy
            : null}
          {approverLine ? <> · {approverLine}</> : null}
        </Typography>
      </Box>
      {compareOptions.length > 0 && (
        <Box align="center" gap={2}>
          <Typography
            as="span"
            className="tw:whitespace-nowrap"
            color="secondary"
            size="text-sm">
            {t('label.compare-with')}
          </Typography>
          <Select
            aria-label={t('label.compare-with')}
            className="tw:w-48"
            data-testid="ontology-release-compare-with"
            items={compareOptions}
            placeholder={t('label.choose-version')}
            selectedKey={compareId}
            size="sm"
            onSelectionChange={(key) =>
              setCompareId(key === null ? null : String(key))
            }>
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
        </Box>
      )}
    </Box>
  );

  const renderNotes = () =>
    release.releaseNotes && (
      <div
        className="tw:rounded-lg tw:border tw:border-secondary tw:border-l-3 tw:border-l-utility-blue-400 tw:bg-secondary tw:px-4 tw:py-3"
        data-testid="ontology-release-detail-notes">
        <Typography
          as="p"
          className="not-prose tw:m-0 tw:uppercase tw:tracking-wide"
          color="secondary"
          size="text-xs"
          weight="semibold">
          {t('label.release-notes')}
        </Typography>
        <Typography
          as="p"
          className="not-prose tw:mt-1 tw:mb-0 tw:whitespace-pre-wrap tw:break-words"
          size="text-sm">
          {release.releaseNotes}
        </Typography>
      </div>
    );

  const renderFeedback = () =>
    feedback && (
      <div
        className="tw:rounded-lg tw:border tw:border-utility-error-200 tw:border-l-3 tw:border-l-utility-error-500 tw:bg-utility-error-50 tw:px-4 tw:py-3"
        data-testid="ontology-release-detail-feedback">
        <Typography
          as="p"
          className="not-prose tw:m-0 tw:uppercase tw:tracking-wide tw:text-utility-error-700"
          size="text-xs"
          weight="semibold">
          {approval.name
            ? t('label.rejected-by-name', { name: approval.name })
            : t('label.rejected')}
        </Typography>
        <Typography
          as="p"
          className="not-prose tw:mt-1 tw:mb-0 tw:whitespace-pre-wrap tw:break-words tw:text-utility-error-700"
          size="text-sm">
          {feedback}
        </Typography>
      </div>
    );

  const renderChanges = () => (
    <Box direction="col" gap={2}>
      <Typography
        as="h4"
        className="not-prose tw:m-0 tw:text-primary"
        size="text-sm"
        weight="semibold">
        {compareTo
          ? t('label.compared-with-version', {
              version: versionText(compareTo),
            })
          : t('label.changes-in-this-release')}
      </Typography>
      <OntologyReviewRelease
        baseReleaseId={compareTo?.id ?? release.baseReleaseId}
        key={compareTo?.id ?? release.baseReleaseId ?? release.id}
        releaseId={release.id}
      />
    </Box>
  );

  const renderActions = () => {
    if (isInReview) {
      return (
        <Box gap={3} wrap="wrap">
          {release.reviewTask && onOpenTask ? (
            <Button
              color="secondary"
              data-testid="ontology-release-view-request"
              onPress={() =>
                release.reviewTask && onOpenTask(release.reviewTask)
              }>
              {t('label.view-request')}
            </Button>
          ) : null}
          {canWithdraw && onWithdraw ? (
            <Button
              color="secondary-destructive"
              data-testid="ontology-release-withdraw"
              onPress={onWithdraw}>
              {t('label.withdraw')}
            </Button>
          ) : null}
        </Box>
      );
    }

    return (
      release.entityStatus === EntityStatus.Approved && (
        <ReleaseActions
          showExport
          activeRelease={activeRelease}
          canPublish={canPublish}
          isActive={status === 'active'}
          ontologyName={ontologyName}
          release={release}
          onActivate={onActivate}
          onOpenTask={onOpenTask}
        />
      )
    );
  };

  return (
    <Box data-testid="ontology-release-definition" direction="col" gap={4}>
      <Button
        className="tw:self-start"
        color="link-gray"
        data-testid="ontology-release-back"
        iconLeading={ArrowLeft}
        size="sm"
        onPress={onBack}>
        {t('label.all-releases')}
      </Button>
      {renderHeader()}
      {renderNotes()}
      {renderFeedback()}
      <ValidationLine release={release} />
      <Card size="sm">
        <Card.Content>
          <OntologyReleaseEvents
            releaseId={release.id}
            releases={releases}
            onOpenTask={onOpenTask}
          />
        </Card.Content>
      </Card>
      {renderChanges()}
      {renderActions()}
    </Box>
  );
};

export default OntologyReleaseDetailPage;
