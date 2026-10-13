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
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMORY_STATUS_LABEL_KEYS } from '../../../constants/ContextCenter.constants';
import {
  ContextMemoryStatus,
  EntityReference,
} from '../../../generated/entity/context/contextMemory';
import { Task } from '../../../generated/entity/tasks/task';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';
import MemoryConflictCompare from '../MemoryConflictCompare/MemoryConflictCompare';
import {
  CLAIM_RECENCY_LABELS,
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

const ClaimBadges: FC<{
  status?: string;
  recency?: ClaimRecency;
  testId: string;
}> = ({ status, recency, testId }) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:shrink-0" gap={1}>
      {status && (
        <Badge
          color={status === ContextMemoryStatus.Approved ? 'success' : 'gray'}
          data-testid={`${testId}-status`}
          size="sm"
          type="color">
          {MEMORY_STATUS_LABEL_KEYS[status]
            ? t(MEMORY_STATUS_LABEL_KEYS[status])
            : status}
        </Badge>
      )}
      {recency && (
        <Badge
          color={recency === 'newer' ? 'brand' : 'gray'}
          size="sm"
          type="color">
          {t(CLAIM_RECENCY_LABELS[recency])}
        </Badge>
      )}
    </Box>
  );
};

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
        <ClaimBadges recency={recency} status={claim?.status} testId={testId} />
      </Box>
      {claim?.answer && (
        <Typography
          className="tw:text-secondary tw:line-clamp-2"
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

interface ConflictCardProps {
  review: Task;
  onCompare: (review: Task) => void;
  onViewMemory: (memoryName: string) => void;
}

const ConflictCard: FC<ConflictCardProps> = ({
  review,
  onCompare,
  onViewMemory,
}) => {
  const { t } = useTranslation();
  const claim = getReviewedClaim(review);
  const disputes = getReviewDisputes(review);
  const recency = getConflictRecency(claim, disputes);
  const reviewedTitle =
    getReviewedMemoryTitle(review) ?? getEntityName(review.about);

  return (
    <Box
      className="tw:px-5.5 tw:py-4.5 tw:border-b tw:border-secondary tw:last:border-b-0"
      data-testid={`memory-review-${review.about?.id}`}
      direction="col"
      gap={3}>
      <Box align="center" gap={3} justify="between">
        <Typography data-testid="review-question" weight="semibold">
          {claim?.question ?? reviewedTitle}
        </Typography>
        <Button
          className="tw:shrink-0"
          color="primary"
          data-testid="compare-review"
          size="sm"
          onClick={() => onCompare(review)}>
          {t('label.compare')}
        </Button>
      </Box>
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
          </Box>
        </Grid.Item>
      </Grid>
    </Box>
  );
};

/**
 * Open memory conflict reviews, each summarising a Draft memory and the
 * Approved memories it contradicts. Compare opens both in full, side by side,
 * where the reviewer keeps one.
 */
const MemoryConflictReviews: FC<MemoryConflictReviewsProps> = ({
  reviews,
  isLoading,
  currentUserName,
  isAdminUser,
  onViewMemory,
  onResolved,
}) => {
  const { t } = useTranslation();
  const [comparing, setComparing] = useState<Task>();

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
          key={review.id}
          review={review}
          onCompare={setComparing}
          onViewMemory={onViewMemory}
        />
      ))}
      {comparing && (
        <MemoryConflictCompare
          currentUserName={currentUserName}
          isAdminUser={isAdminUser}
          review={comparing}
          onClose={() => setComparing(undefined)}
          onResolved={onResolved}
        />
      )}
    </div>
  );
};

export default MemoryConflictReviews;
