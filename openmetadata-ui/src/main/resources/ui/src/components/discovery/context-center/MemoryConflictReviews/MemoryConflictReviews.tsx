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
import {
  AlertCircle,
  CheckCircle,
} from '@openmetadata/ui-core-components/icons';
import { useQueries } from '@tanstack/react-query';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMORY_FIELDS } from '../../../../constants/ContextCenter.constants';
import { Task } from '../../../../generated/entity/tasks/task';
import { getContextMemoryById } from '../../../../rest/contextMemoryAPI';
import { CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY } from '../../../../utils/ContextCenterQueryKeys';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import SomethingWentWrongPlaceholder from '../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import InboxTaskListItem from '../../personal-space/InboxPage/components/InboxTaskListItem';
import InboxTaskListSkeleton from '../../personal-space/InboxPage/components/InboxTaskListSkeleton';
import MemoryConflictCompare from '../MemoryConflictCompare/MemoryConflictCompare';
import { MemoryConflictReviewsProps } from './MemoryConflictReviews.types';
import { withMemoryTitle } from './MemoryConflictReviews.utils';

/**
 * Open memory conflict reviews as the task list shows tasks; opening one
 * compares the two memories in full and lets the reviewer keep one. A task
 * names its memory only by reference, so each row reads the memory, through
 * its visibility rules, for the title it shows.
 */
const MemoryConflictReviews: FC<MemoryConflictReviewsProps> = ({
  reviews,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onRetry,
  onResolved,
}) => {
  const { t } = useTranslation();
  const [comparing, setComparing] = useState<Task>();
  const memories = useQueries({
    queries: reviews.map((review) => ({
      queryKey: [...CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY, review.about?.id],
      queryFn: () =>
        getContextMemoryById(review.about?.id ?? '', MEMORY_FIELDS),
      enabled: Boolean(review.about?.id),
      retry: false,
    })),
  });

  if (isLoading) {
    return (
      <Box className="tw:p-3" direction="col">
        <InboxTaskListSkeleton count={2} />
      </Box>
    );
  }

  if (isError) {
    return (
      <div className="tw:relative tw:min-h-[320px] tw:py-12">
        <SomethingWentWrongPlaceholder
          actions={[
            { key: 'retry', label: t('label.retry'), onPress: onRetry },
          ]}
          data-testid="memory-conflict-reviews-error"
          description={t('server.entity-fetch-error', {
            entity: t('label.task-plural'),
          })}
          icon={<AlertCircle />}
          title={t('message.something-went-wrong')}
        />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="tw:relative tw:min-h-[320px] tw:py-12">
        <NoDataPlaceholder
          description={t('message.no-memory-conflicts-to-review')}
          icon={<CheckCircle />}
          title={t('label.nothing-to-review')}
        />
      </div>
    );
  }

  return (
    <Box
      className="tw:p-3"
      data-testid="memory-conflict-reviews"
      direction="col"
      gap={1}>
      {reviews.map((review, index) => (
        <div data-testid={`memory-review-${review.about?.id}`} key={review.id}>
          <InboxTaskListItem
            isActive={comparing?.id === review.id}
            task={withMemoryTitle(review, memories[index]?.data)}
            onClick={() => setComparing(review)}
          />
        </div>
      ))}
      {hasMore && (
        <Button
          className="tw:self-center"
          color="secondary"
          data-testid="load-more-reviews"
          isLoading={isLoadingMore}
          size="sm"
          onClick={onLoadMore}>
          {t('label.load-more')}
        </Button>
      )}
      {comparing && (
        <MemoryConflictCompare
          review={comparing}
          onClose={() => setComparing(undefined)}
          onResolved={onResolved}
        />
      )}
    </Box>
  );
};

export default MemoryConflictReviews;
