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

import { Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReviewPill from './OntologyReviewPill';

type Props = {
  onDismiss?: () => void;
  review: OntologyReleaseReview;
  release: OntologyRelease;
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
          pill
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

type Translate = ReturnType<typeof useTranslation>['t'];

const versionText = (release: Props['release'], t: Translate) =>
  release.semanticVersion ? 'v' + release.semanticVersion : t('label.draft');

const PendingBanner = ({
  review,
  release,
  onOpenTask,
  onDismiss,
}: Pick<Props, 'review' | 'release' | 'onOpenTask' | 'onDismiss'>) => {
  const { t } = useTranslation();

  return (
    <OntologyReviewPill
      action={
        <Button
          pill
          color="secondary-warning-outline"
          size="sm"
          onPress={() => onOpenTask(review.task.id)}>
          {t('label.review')}
        </Button>
      }
      testId="ontology-review-banner"
      title={t('message.ontology-review-asked-you', {
        requester: getEntityName(review.requester),
        version: versionText(release, t),
      })}
      tone="warning"
      onDismiss={onDismiss}
    />
  );
};

const OntologyReviewBanner = ({
  review,
  release,
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
  // Only a review waiting on the viewer's vote is announced while it is open.
  if (review.status !== EntityStatus.InReview || !review.callerCanVote) {
    return null;
  }

  return (
    <PendingBanner
      release={release}
      review={review}
      onDismiss={onDismiss}
      onOpenTask={onOpenTask}
    />
  );
};

export default OntologyReviewBanner;
