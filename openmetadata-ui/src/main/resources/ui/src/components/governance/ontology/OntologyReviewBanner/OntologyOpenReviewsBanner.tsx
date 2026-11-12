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

import { Box, Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getReviewStatusMessage } from './OntologyReviewBanner.utils';
import OntologyReviewPill from './OntologyReviewPill';

// Beyond this many open reviews the banner shows a count and a link instead.
export const OPEN_REVIEW_LINE_LIMIT = 3;

type Props = {
  reviews: OntologyReleaseReview[];
  onOpenTask: (taskId: string) => void;
  onOpenList: () => void;
  onDismiss?: () => void;
};

/**
 * All ontologies has no single review to announce, so each open review is
 * named with its ontology rather than shown as if it belonged to the view.
 */
const OntologyOpenReviewsBanner = ({
  reviews,
  onOpenTask,
  onOpenList,
  onDismiss,
}: Props) => {
  const { t } = useTranslation();
  if (!reviews.length) {
    return null;
  }
  const listed = reviews.length <= OPEN_REVIEW_LINE_LIMIT;

  return (
    <Box
      align="center"
      className="tw:max-w-full"
      data-testid="ontology-open-reviews-banner"
      direction="col"
      gap={2}>
      {listed ? (
        reviews.map((review) => {
          const status = getReviewStatusMessage(review);

          return (
            <OntologyReviewPill
              action={
                <Button
                  color="secondary"
                  size="sm"
                  onPress={() => onOpenTask(review.task.id)}>
                  {t('label.view-task')}
                </Button>
              }
              key={review.task.id}
              title={`${getEntityName(review.ontology)} · ${t(
                status.key,
                status.values
              )} · ${review.taskId ?? review.task.id}`}
              tone="brand"
              onDismiss={onDismiss}
            />
          );
        })
      ) : (
        <OntologyReviewPill
          action={
            <Button color="secondary" size="sm" onPress={onOpenList}>
              {t('label.view-all')}
            </Button>
          }
          title={t('message.ontology-review-open-count', {
            count: reviews.length,
          })}
          tone="brand"
          onDismiss={onDismiss}
        />
      )}
    </Box>
  );
};

export default OntologyOpenReviewsBanner;
