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
  Avatar,
  Badge,
  Box,
  Button,
  ButtonUtility,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Calendar,
  Check,
  Clock,
  Dataflow03,
  Send01,
  User01,
  Users01,
} from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { ComponentType, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import {
  EntityStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { Task } from '../../../../generated/entity/tasks/task';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getOntologyRelease } from '../../../../rest/ontologyAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getTaskResolveActions } from '../../../discovery/personal-space/InboxPage/taskResolve.utils';
import { releaseChangeBreakdown } from '../OntologyReleasePanel/OntologyReleasePanel.utils';
import OntologyReviewPanel from '../OntologyReviewPanel/OntologyReviewPanel';
import { releaseBump } from './OntologyTasksDrawer.utils';
import { reviewDecisionAppearance } from './OntologyTaskThread.utils';

type Props = {
  task: Task;
  review: OntologyReleaseReview;
  release: OntologyRelease;
  canPublish: boolean;
  activationReady: boolean;
  contentReady: boolean;
  contentGeneration?: number;
  isWriting: boolean;
  isRequester: boolean;
  activationError?: boolean;
  isPublished?: boolean;
  onContentReadyChange: (ready: boolean) => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onApproveAndPublish: () => void;
  onPublish: () => void;
  onComment: (message: string) => Promise<boolean>;
  children: ReactNode;
};

const BUMP_LABELS: Record<VersionBump, string> = {
  [VersionBump.Major]: 'label.major',
  [VersionBump.Minor]: 'label.minor',
  [VersionBump.Patch]: 'label.version-patch',
};

const initialsOf = (name: string) => name.slice(0, 2).toUpperCase();

const versionTag = (version?: string) => (version ? 'v' + version : '—');

const StatusBadge = ({ status }: { status: EntityStatus }) => {
  const { t } = useTranslation();
  if (status === EntityStatus.Approved) {
    return <Badge color="success">{t('label.approved')}</Badge>;
  }
  if (status === EntityStatus.Rejected) {
    return <Badge color="error">{t('label.rejected')}</Badge>;
  }

  return <Badge color="brand">{t('label.pending-approval')}</Badge>;
};

const StatCell = ({
  value,
  caption,
}: {
  value: ReactNode;
  caption: string;
}) => (
  <Box className="tw:min-w-0 tw:px-5 tw:py-3" direction="col" gap={1}>
    <Typography as="div" size="text-sm" weight="semibold">
      {value}
    </Typography>
    <Typography color="secondary" size="text-xs">
      {caption}
    </Typography>
  </Box>
);

const MetaRow = ({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) => (
  <>
    <Box align="center" gap={2}>
      <Icon className="tw:size-4 tw:text-fg-quaternary" />
      <Typography color="secondary" size="text-sm">
        {label}
      </Typography>
    </Box>
    <Box align="center" gap={2} wrap="wrap">
      {children}
    </Box>
  </>
);

const ReleaseMeta = ({
  task,
  review,
  release,
  isRequester,
}: Pick<Props, 'task' | 'review' | 'release' | 'isRequester'>) => {
  const { t } = useTranslation();
  const requester = getEntityName(review.requester ?? task.createdBy);

  return (
    <>
      <div
        className="tw:grid tw:grid-cols-[auto_1fr_auto_1fr] tw:items-start tw:gap-x-6 tw:gap-y-3"
        data-testid="ontology-task-meta">
        <MetaRow icon={User01} label={t('label.assignee')}>
          {review.assignees.map((entry) => {
            const appearance = reviewDecisionAppearance(entry.status);
            const name = getEntityName(entry.assignee);

            return (
              <Box
                align="center"
                gap={2}
                key={entry.assignee.type + ':' + entry.assignee.id}>
                <Avatar initials={initialsOf(name)} size="xs" />
                <Typography size="text-sm" weight="medium">
                  {name}
                </Typography>
                <Badge color={appearance.color} size="sm">
                  {t(appearance.label)}
                </Badge>
              </Box>
            );
          })}
        </MetaRow>
        <MetaRow icon={Users01} label={t('label.task-created-by')}>
          <Avatar initials={initialsOf(requester)} size="xs" />
          <Typography size="text-sm" weight="medium">
            {isRequester ? `${requester} (${t('label.you')})` : requester}
          </Typography>
        </MetaRow>
        <MetaRow icon={Calendar} label={t('label.opened-on')}>
          <Typography size="text-sm" weight="medium">
            {formatDateTime(task.createdAt) || '—'}
          </Typography>
        </MetaRow>
        <MetaRow icon={Clock} label={t('label.task-last-activity')}>
          <Typography size="text-sm" weight="medium">
            {formatDateTime(task.updatedAt ?? task.createdAt) || '—'}
          </Typography>
        </MetaRow>
      </div>
      {release.releaseNotes && (
        <div
          className="tw:flex tw:flex-col tw:gap-1 tw:rounded-lg tw:border tw:border-l-4 tw:border-secondary tw:border-l-brand tw:bg-secondary_subtle tw:px-4 tw:py-3"
          data-testid="ontology-task-release-notes">
          <Typography
            className="tw:uppercase tw:tracking-wide"
            color="secondary"
            size="text-xs"
            weight="semibold">
            {t('label.release-notes')}
          </Typography>
          <Typography className="tw:whitespace-pre-wrap" size="text-sm">
            {release.releaseNotes}
          </Typography>
        </div>
      )}
    </>
  );
};

const ReleaseSummary = ({
  task,
  review,
  release,
  isRequester,
}: Pick<Props, 'task' | 'review' | 'release' | 'isRequester'>) => {
  const { t } = useTranslation();
  const base = useQuery({
    queryKey: ['ontology-review-base', release.baseReleaseId],
    gcTime: 0,
    retry: false,
    enabled: Boolean(release.baseReleaseId),
    queryFn: ({ signal }) =>
      getOntologyRelease(release.baseReleaseId ?? '', signal),
  });
  const baseKnown = !release.baseReleaseId || base.isSuccess;
  const baseVersion = base.data?.semanticVersion;
  const bump = baseKnown
    ? releaseBump(baseVersion, release.semanticVersion)
    : undefined;
  const breakdown = releaseChangeBreakdown(release);

  return (
    <>
      <Box
        className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
        data-testid="ontology-task-release-card"
        direction="col">
        <Box align="center" className="tw:p-5" gap={3}>
          <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-secondary">
            <Dataflow03 className="tw:size-5 tw:text-fg-secondary" />
          </span>
          <Box className="tw:min-w-0" direction="col">
            <Typography color="brand" size="text-md" weight="semibold">
              {getEntityName(review.ontology)}
            </Typography>
            <Typography color="secondary" size="text-sm">
              {t('label.ontology-release')} ·{' '}
              {baseVersion ? versionTag(baseVersion) + ' → ' : ''}
              {versionTag(release.semanticVersion)}
            </Typography>
          </Box>
        </Box>
        <div className="tw:grid tw:grid-cols-4 tw:divide-x tw:divide-secondary tw:border-t tw:border-secondary tw:bg-secondary_subtle">
          <StatCell
            caption={t('label.release-type')}
            value={bump ? t(BUMP_LABELS[bump]) : '—'}
          />
          <StatCell
            caption={
              baseVersion
                ? t('label.from-version', { version: versionTag(baseVersion) })
                : t('label.version')
            }
            value={
              <Typography color="brand" size="text-sm" weight="semibold">
                {versionTag(release.semanticVersion)}
              </Typography>
            }
          />
          <StatCell
            caption={t('label.change-plural')}
            value={
              breakdown ? (
                <Box gap={2}>
                  <Typography color="success" size="text-sm">
                    +{breakdown.added}
                  </Typography>
                  <Typography color="warning" size="text-sm">
                    ~{breakdown.changed}
                  </Typography>
                  <Typography color="danger" size="text-sm">
                    −{breakdown.removed}
                  </Typography>
                </Box>
              ) : (
                '—'
              )
            }
          />
          <StatCell
            caption={t('label.review-status')}
            value={<StatusBadge status={review.status} />}
          />
        </div>
      </Box>
      <ReleaseMeta
        isRequester={isRequester}
        release={release}
        review={review}
        task={task}
      />
    </>
  );
};

const CommentBar = ({
  isWriting,
  onComment,
}: Pick<Props, 'isWriting' | 'onComment'>) => {
  const { t } = useTranslation();
  const currentUser = useApplicationStore((store) => store.currentUser);
  const [comment, setComment] = useState('');
  const disabled = !comment.trim() || isWriting;
  const send = async () => {
    if (!disabled && (await onComment(comment))) {
      setComment('');
    }
  };

  return (
    <div
      className="tw:sticky tw:bottom-0 tw:z-10 tw:mt-auto tw:flex tw:items-end tw:gap-3 tw:border-t tw:border-secondary tw:bg-overlay-surface tw:px-6 tw:py-4"
      data-testid="ontology-task-comment-bar">
      <Avatar
        initials={initialsOf(getEntityName(currentUser))}
        size="md"
        src={currentUser?.profile?.images?.image}
      />
      <TextArea
        aria-label={t('label.comment')}
        autoSize={{ minRows: 1, maxRows: 6 }}
        className="tw:flex-1"
        data-testid="ontology-task-comment-input"
        placeholder={t('message.leave-a-comment')}
        value={comment}
        onChange={setComment}
      />
      <ButtonUtility
        aria-label={t('label.send')}
        color="primary"
        data-testid="ontology-task-comment-send"
        icon={Send01}
        isDisabled={disabled}
        size="xl"
        onPress={() => void send()}
      />
    </div>
  );
};

const OntologyTaskDetail = ({
  task,
  review,
  release,
  canPublish,
  activationReady,
  contentReady,
  contentGeneration,
  isWriting,
  isRequester,
  activationError,
  isPublished,
  onContentReadyChange,
  onApprove,
  onReject,
  onApproveAndPublish,
  onPublish,
  onComment,
  children,
}: Props) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const actions = getTaskResolveActions(task, {
    approve: t('label.approve'),
    reject: t('label.reject'),
  });
  const canApprove =
    review.callerCanVote && actions.some((action) => action.kind === 'approve');
  const canReject =
    review.callerCanVote && actions.some((action) => action.kind === 'reject');

  const blocked = [!contentReady, isWriting].some(Boolean);
  const requester = isRequester
    ? t('label.you')
    : getEntityName(review.requester ?? task.createdBy);

  const renderPublish = () => {
    if (review.status !== EntityStatus.Approved || isPublished) {
      return null;
    }

    if (!canPublish) {
      return (
        <Typography
          color="secondary"
          data-testid="ontology-only-author-publishes"
          size="text-sm">
          {t('message.ontology-publication-only-author-publishes')}
        </Typography>
      );
    }

    return (
      <Button
        isDisabled={[!activationReady, isWriting].some(Boolean)}
        onPress={onPublish}>
        {t('label.publish')}
      </Button>
    );
  };
  const renderActions = () => (
    <Box gap={2} wrap="wrap">
      {canReject && (
        <Button
          color="secondary"
          isDisabled={blocked}
          size="sm"
          onPress={() => setRejecting(true)}>
          {t('label.reject')}
        </Button>
      )}
      {[canApprove, review.callerCompletesRule, canPublish].every(Boolean) && (
        <Button
          color="secondary"
          data-testid="ontology-approve-publish"
          isDisabled={blocked || !activationReady}
          size="sm"
          onPress={onApproveAndPublish}>
          {t('label.approve-publish-version', {
            version: release.semanticVersion ?? t('label.unavailable'),
          })}
        </Button>
      )}
      {canApprove && (
        <Button
          iconLeading={Check}
          isDisabled={blocked}
          size="sm"
          onPress={onApprove}>
          {t('label.approve')}
        </Button>
      )}
      {renderPublish()}
    </Box>
  );
  const renderRejection = () => {
    if (!rejecting || !canReject) {
      return null;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-warning tw:bg-warning-primary tw:p-4">
        <TextArea
          isRequired
          label={t('label.reason')}
          value={reason}
          onChange={setReason}
        />
        <Box gap={2} justify="end">
          <Button
            color="secondary"
            size="sm"
            onPress={() => setRejecting(false)}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary-destructive"
            isDisabled={!reason.trim() || blocked}
            size="sm"
            onPress={() => onReject(reason)}>
            {t('label.reject-with-comment')}
          </Button>
        </Box>
      </div>
    );
  };

  return (
    <Box
      className="tw:min-h-full"
      data-testid="ontology-task-detail"
      direction="col">
      <div className="tw:sticky tw:top-0 tw:z-10 tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-secondary tw:bg-overlay-surface tw:px-6 tw:py-5">
        <Box align="center" gap={3} wrap="wrap">
          <Box align="center" className="tw:min-w-0 tw:flex-1" gap={2}>
            <StatusBadge status={review.status} />
            <Typography size="text-sm" weight="semibold">
              {review.taskId ?? task.id}
            </Typography>
            <Typography color="secondary" size="text-sm">
              · {t('label.ontology-release')}
            </Typography>
          </Box>
          {renderActions()}
        </Box>
        <Box align="center" gap={2} wrap="wrap">
          <Typography
            as="h2"
            className="not-prose tw:m-0"
            size="text-xl"
            weight="semibold">
            {task.displayName ?? task.name}
          </Typography>
          <Badge color="gray" size="sm">
            {getEntityName(review.ontology)}
          </Badge>
        </Box>
        <Box align="center" gap={2}>
          <Avatar initials={initialsOf(requester)} size="xs" />
          <Typography
            color="secondary"
            data-testid="ontology-task-requested"
            size="text-sm">
            {t('message.ontology-task-requested-review', {
              name: requester,
              time: getRelativeTime(task.createdAt),
            })}
          </Typography>
        </Box>
      </div>
      <Box className="tw:px-6 tw:py-5" direction="col" gap={5}>
        {renderRejection()}
        {isRequester && (
          <Alert variant="brand">
            {t('message.ontology-review-created-by-you')}
          </Alert>
        )}
        {activationError && (
          <Alert variant="error">
            {t('message.ontology-review-activation-failed')}
          </Alert>
        )}
        <ReleaseSummary
          isRequester={isRequester}
          release={release}
          review={review}
          task={task}
        />
        <OntologyReviewPanel
          asChanges
          key={contentGeneration}
          task={task}
          onReadyChange={onContentReadyChange}
        />
        {children}
      </Box>
      <CommentBar isWriting={isWriting} onComment={onComment} />
    </Box>
  );
};

export default OntologyTaskDetail;
