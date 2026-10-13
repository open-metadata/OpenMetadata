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
  EmptyPlaceholder,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as NoFilterResultsIcon } from '../../../assets/svg/common/no-filter-results.svg';
import { Task } from '../../../generated/entity/tasks/task';
import { resolveTask } from '../../../rest/tasksAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  ReviewDecision,
  REVIEW_DECISIONS,
  REVIEW_SKELETON_KEYS,
} from './MemoryConflictReviews.constants';
import {
  MemoryConflictReviewDispute,
  MemoryConflictReviewsProps,
} from './MemoryConflictReviews.types';
import {
  getMemoryLinkName,
  getReviewDisputes,
} from './MemoryConflictReviews.utils';

interface ReviewRowProps {
  review: Task;
  isResolving: boolean;
  onDecide: (review: Task, decision: ReviewDecision) => void;
  onViewMemory: (memoryName: string) => void;
}

const DisputedMemory: FC<{
  dispute: MemoryConflictReviewDispute;
  onViewMemory: (memoryName: string) => void;
}> = ({ dispute, onViewMemory }) => (
  <Box direction="col" gap={1}>
    <Button
      className="tw:self-start"
      color="link-color"
      data-testid={`disputed-memory-${dispute.memory.id}`}
      size="sm"
      onClick={() => onViewMemory(getMemoryLinkName(dispute.memory))}>
      {getEntityName(dispute.memory)}
    </Button>
    {dispute.reason && (
      <Typography className="tw:text-tertiary tw:line-clamp-2" size="text-xs">
        {dispute.reason}
      </Typography>
    )}
  </Box>
);

const ReviewRow: FC<ReviewRowProps> = ({
  review,
  isResolving,
  onDecide,
  onViewMemory,
}) => {
  const { t } = useTranslation();
  const disputes = getReviewDisputes(review);

  return (
    <Box
      align="start"
      className="tw:px-5.5 tw:py-4.5 tw:border-b tw:border-secondary tw:last:border-b-0"
      data-testid={`memory-review-${review.about?.id}`}
      gap={3}
      justify="between">
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
        <Button
          className="tw:self-start"
          color="link-gray"
          data-testid="reviewed-memory"
          size="md"
          onClick={() => onViewMemory(getMemoryLinkName(review.about))}>
          {getEntityName(review.about)}
        </Button>
        <Box direction="col" gap={1}>
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('label.conflicts-with')}
          </Typography>
          {disputes.map((dispute) => (
            <DisputedMemory
              dispute={dispute}
              key={dispute.memory.id}
              onViewMemory={onViewMemory}
            />
          ))}
        </Box>
      </Box>
      <Box align="center" className="tw:shrink-0" gap={2}>
        <Button
          color="secondary"
          data-testid="reject-review"
          isDisabled={isResolving}
          size="sm"
          onClick={() => onDecide(review, 'reject')}>
          {t('label.reject')}
        </Button>
        <Button
          color="primary"
          data-testid="approve-review"
          isDisabled={isResolving}
          isLoading={isResolving}
          size="sm"
          onClick={() => onDecide(review, 'approve')}>
          {t('label.approve')}
        </Button>
      </Box>
    </Box>
  );
};

/**
 * Open memory conflict reviews, each deciding a Draft memory against the
 * Approved memories it contradicts. Approving supersedes those memories;
 * rejecting keeps them.
 */
const MemoryConflictReviews: FC<MemoryConflictReviewsProps> = ({
  reviews,
  isLoading,
  onViewMemory,
  onResolved,
}) => {
  const { t } = useTranslation();
  const [resolvingId, setResolvingId] = useState<string>();

  const handleDecide = useCallback(
    async (review: Task, decision: ReviewDecision) => {
      setResolvingId(review.id);
      try {
        await resolveTask(review.id, {
          transitionId: decision,
          resolutionType: REVIEW_DECISIONS[decision],
        });
        showSuccessToast(t('server.task-resolved-successfully'));
        onResolved();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setResolvingId(undefined);
      }
    },
    [onResolved, t]
  );

  if (isLoading) {
    return (
      <>
        {REVIEW_SKELETON_KEYS.map((key) => (
          <Box
            className="tw:px-5.5 tw:py-4.5"
            direction="col"
            gap={2}
            key={key}>
            <Skeleton height="14px" variant="rounded" width="40%" />
            <Skeleton height="12px" variant="rounded" width="70%" />
          </Box>
        ))}
      </>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="tw:relative tw:min-h-[320px] tw:py-12">
        <EmptyPlaceholder
          description={t('message.no-memory-conflicts-to-review')}
          icon={<NoFilterResultsIcon className="tw:text-quaternary" />}
          title={t('label.no-entity', { entity: t('label.needs-review') })}
          variant="blank"
        />
      </div>
    );
  }

  return (
    <div data-testid="memory-conflict-reviews">
      {reviews.map((review) => (
        <ReviewRow
          isResolving={resolvingId === review.id}
          key={review.id}
          review={review}
          onDecide={handleDecide}
          onViewMemory={onViewMemory}
        />
      ))}
    </div>
  );
};

export default MemoryConflictReviews;
