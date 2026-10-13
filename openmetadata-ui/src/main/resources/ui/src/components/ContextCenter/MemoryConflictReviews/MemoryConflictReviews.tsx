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
import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { CheckCircle } from '@openmetadata/ui-core-components/icons';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../generated/entity/tasks/task';
import InboxTaskListItem from '../../discovery/personal-space/InboxPage/components/InboxTaskListItem';
import InboxTaskListSkeleton from '../../discovery/personal-space/InboxPage/components/InboxTaskListSkeleton';
import MemoryConflictCompare from '../MemoryConflictCompare/MemoryConflictCompare';
import { MemoryConflictReviewsProps } from './MemoryConflictReviews.types';
import { withMemoryTitle } from './MemoryConflictReviews.utils';

/**
 * Open memory conflict reviews as the task list shows tasks; opening one
 * compares the two memories in full and lets the reviewer keep one.
 */
const MemoryConflictReviews: FC<MemoryConflictReviewsProps> = ({
  reviews,
  isLoading,
  onResolved,
}) => {
  const { t } = useTranslation();
  const [comparing, setComparing] = useState<Task>();

  if (isLoading) {
    return (
      <Box className="tw:p-3" direction="col">
        <InboxTaskListSkeleton count={2} />
      </Box>
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
    <Box
      className="tw:p-3"
      data-testid="memory-conflict-reviews"
      direction="col"
      gap={1}>
      {reviews.map((review) => (
        <div data-testid={`memory-review-${review.about?.id}`} key={review.id}>
          <InboxTaskListItem
            isActive={comparing?.id === review.id}
            task={withMemoryTitle(review)}
            onClick={() => setComparing(review)}
          />
        </div>
      ))}
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
