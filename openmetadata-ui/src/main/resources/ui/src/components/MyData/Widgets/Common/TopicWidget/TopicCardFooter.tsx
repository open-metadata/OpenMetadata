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
import { Button, Skeleton, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import type { TopicCardProps } from './TopicCard';

type TopicCardFooterProps = Pick<
  TopicCardProps,
  'meta' | 'action' | 'topicKey'
> & { isLoading: boolean };

const TopicFooterMeta = ({
  isLoading,
  meta,
}: Pick<TopicCardProps, 'meta'> & { isLoading: boolean }) => {
  if (isLoading) {
    return <Skeleton height={14} width="35%" />;
  }

  return meta ? (
    <Typography
      className="tw:min-w-0 tw:text-text-tertiary!"
      ellipsis={{ rows: 1 }}
      size="text-sm">
      {meta}
    </Typography>
  ) : null;
};

/**
 * The card's bottom strip: a line of context on the left, the link out on the
 * right. Rendered even with no meta while loading, so the skeleton keeps the
 * card's full shape rather than growing a strip when the data lands.
 */
const TopicCardFooter: React.FC<TopicCardFooterProps> = ({
  meta,
  action,
  topicKey,
  isLoading,
}) => {
  if (!meta && !action && !isLoading) {
    return null;
  }

  return (
    <div className="tw:flex tw:min-w-0 tw:shrink-0 tw:items-center tw:gap-3 tw:border-t tw:border-secondary tw:px-5 tw:py-3.5">
      <TopicFooterMeta isLoading={isLoading} meta={meta} />
      {action && (
        <Button
          className="tw:ml-auto tw:shrink-0"
          color="link-color"
          data-testid={`topic-action-${topicKey}`}
          size="sm"
          onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default TopicCardFooter;
