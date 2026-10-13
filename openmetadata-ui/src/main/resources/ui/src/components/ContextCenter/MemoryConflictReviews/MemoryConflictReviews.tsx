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
  Badge,
  Box,
  Button,
  EmptyPlaceholder,
  Grid,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/context/contextMemory';
import { Task } from '../../../generated/entity/tasks/task';
import { resolveTask } from '../../../rest/tasksAPI';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  CLAIM_RECENCY_LABELS,
  ReviewDecision,
  REVIEW_DECISIONS,
  REVIEW_SKELETON_KEYS,
} from './MemoryConflictReviews.constants';
import {
  ClaimRecency,
  MemoryClaim,
  MemoryConflictReviewsProps,
} from './MemoryConflictReviews.types';
import {
  getConflictRecency,
  getMemoryLinkName,
  getReviewDisputes,
  getReviewedClaim,
  getReviewedMemoryTitle,
} from './MemoryConflictReviews.utils';

interface ClaimCardProps {
  claim?: MemoryClaim;
  reference?: EntityReference;
  title: string;
  recency?: ClaimRecency;
  reason?: string;
  testId: string;
  onViewMemory: (memoryName: string) => void;
}

const ClaimCard: FC<ClaimCardProps> = ({
  claim,
  reference,
  title,
  recency,
  reason,
  testId,
  onViewMemory,
}) => {
  const { t } = useTranslation();
  const details = [
    claim?.anchor && getEntityName(claim.anchor),
    claim?.source,
    claim?.author,
    claim?.contentUpdatedAt && formatDate(claim.contentUpdatedAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box
      className="tw:rounded-lg tw:border tw:border-secondary tw:p-4"
      direction="col"
      gap={2}>
      <Box align="start" gap={2} justify="between">
        <Button
          className="tw:text-left"
          color="link-gray"
          data-testid={testId}
          size="md"
          onClick={() =>
            onViewMemory(claim?.name ?? getMemoryLinkName(reference))
          }>
          <Typography className="tw:text-primary" weight="medium">
            {title}
          </Typography>
        </Button>
        {recency && (
          <Badge
            color={recency === 'newer' ? 'brand' : 'gray'}
            size="sm"
            type="color">
            {t(CLAIM_RECENCY_LABELS[recency])}
          </Badge>
        )}
      </Box>
      {claim?.answer && (
        <Typography
          className="tw:text-secondary tw:line-clamp-4"
          data-testid={`${testId}-claim`}
          size="text-sm">
          {stripMarkdown(claim.answer)}
        </Typography>
      )}
      {details && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {details}
        </Typography>
      )}
      {reason && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.why-they-conflict', { reason })}
        </Typography>
      )}
    </Box>
  );
};

interface KeepActionProps {
  label: string;
  hint: string;
  testId: string;
  isDisabled: boolean;
  isLoading: boolean;
  onKeep: () => void;
}

const KeepAction: FC<KeepActionProps> = ({
  label,
  hint,
  testId,
  isDisabled,
  isLoading,
  onKeep,
}) => (
  <Box direction="col" gap={1}>
    <Button
      className="tw:self-start"
      color="secondary"
      data-testid={testId}
      isDisabled={isDisabled}
      isLoading={isLoading}
      size="sm"
      onClick={onKeep}>
      {label}
    </Button>
    <Typography className="tw:text-tertiary" size="text-xs">
      {hint}
    </Typography>
  </Box>
);

interface ConflictCardProps {
  review: Task;
  resolving?: ReviewDecision;
  isDisabled: boolean;
  onDecide: (review: Task, decision: ReviewDecision) => void;
  onViewMemory: (memoryName: string) => void;
}

const ConflictCard: FC<ConflictCardProps> = ({
  review,
  resolving,
  isDisabled,
  onDecide,
  onViewMemory,
}) => {
  const { t } = useTranslation();
  const claim = getReviewedClaim(review);
  const disputes = getReviewDisputes(review);
  const recency = getConflictRecency(claim, disputes);
  const reviewedTitle =
    getReviewedMemoryTitle(review) ?? getEntityName(review.about);
  const question =
    claim?.question ??
    disputes.find((dispute) => dispute.claim?.question)?.claim?.question;
  const isSingle = disputes.length === 1;
  const disputedTitle = isSingle ? getEntityName(disputes[0].memory) : '';

  return (
    <Box
      className="tw:px-5.5 tw:py-4.5 tw:border-b tw:border-secondary tw:last:border-b-0"
      data-testid={`memory-review-${review.about?.id}`}
      direction="col"
      gap={3}>
      {question && (
        <Typography data-testid="review-question" weight="semibold">
          {question}
        </Typography>
      )}
      <Grid colGap="4" rowGap="3">
        <Grid.Item span={12}>
          <Box direction="col" gap={2}>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.in-review')}
            </Typography>
            <ClaimCard
              claim={claim}
              recency={recency.reviewed}
              reference={review.about}
              testId="reviewed-memory"
              title={reviewedTitle}
              onViewMemory={onViewMemory}
            />
            <KeepAction
              hint={
                isSingle
                  ? t('message.keep-reviewed-memory-hint', {
                      title: disputedTitle,
                    })
                  : t('message.keep-reviewed-memory-hint-plural', {
                      count: disputes.length,
                    })
              }
              isDisabled={isDisabled}
              isLoading={resolving === 'approve'}
              label={t('label.keep-this-one')}
              testId="keep-reviewed-memory"
              onKeep={() => onDecide(review, 'approve')}
            />
          </Box>
        </Grid.Item>
        <Grid.Item span={12}>
          <Box direction="col" gap={2}>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.conflicts-with')}
            </Typography>
            {disputes.map((dispute) => (
              <ClaimCard
                claim={dispute.claim}
                key={dispute.memory.id}
                reason={dispute.reason}
                recency={recency.disputed[dispute.memory.id]}
                reference={dispute.memory}
                testId={`disputed-memory-${dispute.memory.id}`}
                title={getEntityName(dispute.memory)}
                onViewMemory={onViewMemory}
              />
            ))}
            <KeepAction
              hint={
                isSingle
                  ? t('message.keep-approved-memory-hint', {
                      title: reviewedTitle,
                    })
                  : t('message.keep-approved-memories-hint', {
                      title: reviewedTitle,
                    })
              }
              isDisabled={isDisabled}
              isLoading={resolving === 'reject'}
              label={
                isSingle ? t('label.keep-this-one') : t('label.keep-these')
              }
              testId="keep-approved-memories"
              onKeep={() => onDecide(review, 'reject')}
            />
          </Box>
        </Grid.Item>
      </Grid>
    </Box>
  );
};

/**
 * Open memory conflict reviews, each comparing a Draft memory with the
 * Approved memories it contradicts. Keeping the Draft approves it and
 * supersedes them; keeping the Approved memories rejects the Draft.
 */
const MemoryConflictReviews: FC<MemoryConflictReviewsProps> = ({
  reviews,
  isLoading,
  onViewMemory,
  onResolved,
}) => {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState<{
    id: string;
    decision: ReviewDecision;
  }>();

  const handleDecide = useCallback(
    async (review: Task, decision: ReviewDecision) => {
      setResolving({ id: review.id, decision });
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
        setResolving(undefined);
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
          icon={<CheckCircle className="tw:text-fg-quaternary" />}
          title={t('label.nothing-to-review')}
          variant="blank"
        />
      </div>
    );
  }

  return (
    <div data-testid="memory-conflict-reviews">
      {reviews.map((review) => (
        <ConflictCard
          isDisabled={resolving?.id === review.id}
          key={review.id}
          resolving={
            resolving?.id === review.id ? resolving.decision : undefined
          }
          review={review}
          onDecide={handleDecide}
          onViewMemory={onViewMemory}
        />
      ))}
    </div>
  );
};

export default MemoryConflictReviews;
