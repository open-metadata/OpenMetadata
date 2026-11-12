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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { releaseChangeCount } from '../OntologyReleasePanel/OntologyReleasePanel.utils';
import {
  getReviewStatusMessage,
  NO_REVIEWER_ASSIGNED_KEY,
} from './OntologyReviewBanner.utils';
import OntologyReviewPill from './OntologyReviewPill';

type Props = {
  onDismiss?: () => void;
  review: OntologyReleaseReview;
  release: OntologyRelease;
  viewerName: string;
  viewerId?: string;
  onOpenTask: (taskId: string) => void;
};

const DecisionBanner = ({
  review,
  release,
  onOpenTask,
  onDismiss,
}: Pick<Props, 'review' | 'release' | 'onOpenTask' | 'onDismiss'>) => {
  const { t } = useTranslation();
  const decision = review.latestDecision;
  const approved = review.status === EntityStatus.Approved;
  const version = release.semanticVersion
    ? 'v' + release.semanticVersion
    : release.name;

  return (
    <OntologyReviewPill
      action={
        <Button
          color="secondary"
          size="sm"
          onPress={() => onOpenTask(review.task.id)}>
          {t('label.view-request')}
        </Button>
      }
      detail={`${getEntityName(review.ontology)} · ${
        review.taskId ?? review.task.id
      }`}
      testId="ontology-review-decision-banner"
      title={t(
        approved
          ? 'message.ontology-review-approved-banner'
          : 'message.ontology-review-rejected-banner',
        {
          reviewer: getEntityName(decision?.user),
          version,
          reason: decision?.reason ?? '',
        }
      )}
      tone={approved ? 'success' : 'error'}
      onDismiss={onDismiss}
    />
  );
};

const isDecided = (review: Props['review']) =>
  Boolean(review.latestDecision) &&
  (review.status === EntityStatus.Approved ||
    review.status === EntityStatus.Rejected);

const PendingBanner = ({
  review,
  release,
  viewerName,
  isRequester,
  onOpenTask,
  onDismiss,
}: Pick<
  Props,
  'review' | 'release' | 'viewerName' | 'onOpenTask' | 'onDismiss'
> & {
  isRequester: boolean;
}) => {
  const { t } = useTranslation();
  const status = getReviewStatusMessage(
    review,
    Boolean(release.reviewers?.length)
  );
  const hasNoReviewerLeft =
    isRequester &&
    !review.callerCanVote &&
    status.key === NO_REVIEWER_ASSIGNED_KEY;

  return (
    <OntologyReviewPill
      action={
        <Button
          color="secondary"
          size="sm"
          onPress={() => onOpenTask(review.task.id)}>
          {t(review.callerCanVote ? 'label.review-now' : 'label.view-task')}
        </Button>
      }
      detail={[
        getEntityName(review.ontology),
        release.semanticVersion
          ? 'v' + release.semanticVersion
          : t('label.draft'),
        `${releaseChangeCount(release) ?? t('label.unavailable')} ${t(
          'label.change-plural'
        )}`,
        getEntityName(review.requester),
        review.taskId ?? review.task.id,
      ].join(' · ')}
      testId="ontology-review-banner"
      title={
        review.callerCanVote
          ? t('message.ontology-review-waiting-for-you', { name: viewerName })
          : t(status.key, status.values)
      }
      tone={review.callerCanVote ? 'warning' : 'brand'}
      onDismiss={onDismiss}>
      {hasNoReviewerLeft && (
        <Typography
          color="secondary"
          data-testid="ontology-review-withdraw-hint"
          size="text-xs">
          {t('message.ontology-review-no-reviewer-withdraw-hint')}
        </Typography>
      )}
    </OntologyReviewPill>
  );
};

const OntologyReviewBanner = ({
  review,
  release,
  viewerName,
  viewerId,
  onOpenTask,
  onDismiss,
}: Props) => {
  const isRequester = review.requester?.id === viewerId;
  if (isRequester && isDecided(review)) {
    return (
      <DecisionBanner
        release={release}
        review={review}
        onDismiss={onDismiss}
        onOpenTask={onOpenTask}
      />
    );
  }
  if (
    review.status !== EntityStatus.InReview ||
    (!review.callerCanVote && !isRequester)
  ) {
    return null;
  }

  return (
    <PendingBanner
      isRequester={isRequester}
      release={release}
      review={review}
      viewerName={viewerName}
      onDismiss={onDismiss}
      onOpenTask={onOpenTask}
    />
  );
};

export default OntologyReviewBanner;
