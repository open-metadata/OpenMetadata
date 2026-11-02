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
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { Task } from '../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getTaskResolveActions } from '../../../discovery/personal-space/InboxPage/taskResolve.utils';
import OntologyReviewPanel from '../OntologyReviewPanel/OntologyReviewPanel';
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
  const [comment, setComment] = useState('');
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
  const renderStatus = () => {
    if (review.status === EntityStatus.Approved) {
      return <Badge color="success">{t('label.approved')}</Badge>;
    }
    if (review.status === EntityStatus.Rejected) {
      return <Badge color="error">{t('label.rejected')}</Badge>;
    }

    return <Badge color="warning">{t('label.in-review')}</Badge>;
  };
  const renderHeader = () => (
    <>
      <Typography>
        {review.taskId ?? task.id} · {getEntityName(review.ontology)}
      </Typography>
      <Typography as="h2" size="text-lg" weight="semibold">
        {task.displayName ?? task.name}
      </Typography>
      <Typography>
        {t('label.request-created-by')}:{' '}
        {getEntityName(review.requester ?? task.createdBy)}
      </Typography>
      {renderStatus()}
      {isRequester && (
        <Alert variant="brand">
          {t('message.ontology-review-created-by-you')}
        </Alert>
      )}
    </>
  );
  const renderPublish = () => {
    if (review.status !== EntityStatus.Approved || isPublished) {
      return null;
    }

    return (
      <Button
        isDisabled={[!canPublish, !activationReady, isWriting].some(Boolean)}
        onPress={onPublish}>
        {t('label.publish')}
      </Button>
    );
  };
  const renderActions = () => (
    <Box gap={2} wrap="wrap">
      {canApprove && (
        <Button isDisabled={blocked} onPress={onApprove}>
          {t('label.approve')}
        </Button>
      )}
      {[canApprove, review.callerCompletesRule, canPublish].every(Boolean) && (
        <Button
          data-testid="ontology-approve-publish"
          isDisabled={blocked || !activationReady}
          onPress={onApproveAndPublish}>
          {t('label.approve-publish-version', {
            version: release.semanticVersion ?? t('label.unavailable'),
          })}
        </Button>
      )}
      {canReject && (
        <Button
          color="secondary"
          isDisabled={blocked}
          onPress={() => setRejecting(true)}>
          {t('label.reject')}
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
      <Box direction="col" gap={2}>
        <TextArea
          isRequired
          label={t('label.reason')}
          value={reason}
          onChange={setReason}
        />
        <Button
          color="primary-destructive"
          isDisabled={!reason.trim() || blocked}
          onPress={() => onReject(reason)}>
          {t('label.reject-with-comment')}
        </Button>
      </Box>
    );
  };

  return (
    <Box data-testid="ontology-task-detail" direction="col" gap={4}>
      {renderHeader()}
      <Box direction="col" gap={2}>
        {review.assignees.map((entry) => {
          const appearance = reviewDecisionAppearance(entry.status);

          return (
            <Box
              align="center"
              gap={2}
              key={entry.assignee.type + ':' + entry.assignee.id}>
              <Typography>{getEntityName(entry.assignee)}</Typography>
              <Badge color={appearance.color}>{t(appearance.label)}</Badge>
            </Box>
          );
        })}
      </Box>
      <OntologyReviewPanel
        key={contentGeneration}
        task={task}
        onReadyChange={onContentReadyChange}
      />
      {activationError && (
        <Alert variant="error">
          {t('message.ontology-review-activation-failed')}
        </Alert>
      )}
      {renderActions()}
      {renderRejection()}
      {children}
      <TextArea
        label={t('label.comment')}
        value={comment}
        onChange={setComment}
      />
      <Button
        isDisabled={!comment.trim() || isWriting}
        onPress={async () => {
          if (await onComment(comment)) {
            setComment('');
          }
        }}>
        {t('label.add-comment')}
      </Button>
    </Box>
  );
};

export default OntologyTaskDetail;
