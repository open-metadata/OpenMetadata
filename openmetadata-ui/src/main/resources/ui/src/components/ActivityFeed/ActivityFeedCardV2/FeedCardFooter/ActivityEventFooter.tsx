/*
 *  Copyright 2024 Collate.
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
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback } from 'react';
import { PressEvent } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ThreadIcon } from '../../../../assets/svg/ic-reply-2.svg';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { ReactionType } from '../../../../generated/type/reaction';
import { useActivityFeedProvider } from '../../ActivityFeedProvider/ActivityFeedProvider';
import Reactions from '../../Reactions/Reactions';

interface ActivityEventFooterProps {
  activity: ActivityEvent;
  isForFeedTab?: boolean;
  onActivityClick?: (activity: ActivityEvent) => void;
}

function ActivityEventFooter({
  activity,
  isForFeedTab = false,
  onActivityClick,
}: Readonly<ActivityEventFooterProps>) {
  const { t } = useTranslation();
  const { updateActivityReaction } = useActivityFeedProvider();

  const onReactionUpdate = useCallback(
    async (reaction: ReactionType, operation: ReactionOperation) => {
      if (!activity.id) {
        return;
      }
      await updateActivityReaction(activity.id, reaction, operation);
    },
    [updateActivityReaction, activity.id]
  );

  // The press must keep bubbling: the card container behind this footer
  // selects the activity on click, as it did when this was a native button.
  const handleCommentPress = useCallback(
    (event: PressEvent) => {
      event.continuePropagation();
      if (isForFeedTab) {
        onActivityClick?.(activity);
      }
    },
    [isForFeedTab, onActivityClick, activity]
  );

  return (
    <Box align="start" className={classNames({ 'm-y-md': isForFeedTab })}>
      <div className="footer-container tw:w-full">
        <div>
          <div className="flex items-center gap-2 w-full rounded-8">
            <Button
              aria-label={t('label.comment')}
              className="p-0 flex-center tw:h-10! tw:border tw:border-transparent"
              color="tertiary"
              data-testid="comment-button"
              iconLeading={
                <ThreadIcon data-testid="comment-icon" height={18} width={18} />
              }
              onPress={handleCommentPress}
            />
            <Reactions
              reactions={activity.reactions ?? []}
              onReactionSelect={onReactionUpdate ?? noop}
            />
          </div>
        </div>
      </div>
    </Box>
  );
}

export default ActivityEventFooter;
