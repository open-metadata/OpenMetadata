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
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  AssigneeStatus,
  EntityStatus,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { releaseChangeCount } from '../OntologyReleasePanel/OntologyReleasePanel.utils';

type Props = {
  review: OntologyReleaseReview;
  release: OntologyRelease;
  viewerName: string;
  viewerId?: string;
  onOpenTask: (taskId: string) => void;
};

const OntologyReviewBanner = ({
  review,
  release,
  viewerName,
  viewerId,
  onOpenTask,
}: Props) => {
  const { t } = useTranslation();
  const isRequester = review.requester?.id === viewerId;
  if (
    review.status !== EntityStatus.InReview ||
    (!review.callerCanVote && !isRequester)
  ) {
    return null;
  }
  const pending = review.assignees
    .filter((entry) => entry.status === AssigneeStatus.Pending)
    .map((entry) => getEntityName(entry.assignee))
    .join(', ');

  return (
    <Alert
      data-testid="ontology-review-banner"
      title={t(
        review.callerCanVote
          ? 'message.ontology-review-waiting-for-you'
          : 'message.ontology-review-waiting-on',
        { name: viewerName, names: pending }
      )}
      variant={review.callerCanVote ? 'warning' : 'brand'}>
      <Box align="center" gap={3} justify="between" wrap="wrap">
        <Typography>
          {getEntityName(review.ontology)} ·{' '}
          {release.semanticVersion ?? t('label.unavailable')} ·{' '}
          {releaseChangeCount(release) ?? t('label.unavailable')}{' '}
          {t('label.change-plural')} · {getEntityName(review.requester)} ·{' '}
          {review.taskId ?? review.task.id}
        </Typography>
        <Button
          color="secondary"
          size="sm"
          onPress={() => onOpenTask(review.task.id)}>
          {t(review.callerCanVote ? 'label.review-now' : 'label.view-task')}
        </Button>
      </Box>
    </Alert>
  );
};

export default OntologyReviewBanner;
