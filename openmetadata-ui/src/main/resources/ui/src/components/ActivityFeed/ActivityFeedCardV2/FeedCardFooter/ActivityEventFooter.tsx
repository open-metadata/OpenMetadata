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

import { Box, ButtonUtility } from '@openmetadata/ui-core-components';
import { Comment } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback } from 'react';
import {
  ButtonProps as AriaButtonProps,
  PressEvent,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
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
  // ButtonUtility forwards its props to a react-aria Button but does not declare
  // onPress, and onClick would not let the click bubble, so the press handler is
  // passed as typed react-aria props.
  const commentPressProps: Pick<AriaButtonProps, 'onPress'> = {
    onPress: handleCommentPress,
  };

  return (
    <Box align="start" className={classNames({ 'm-y-md': isForFeedTab })}>
      <Box className="footer-container tw:w-full" direction="col">
        <div>
          <Box align="center" className="w-full rounded-8" gap={1}>
            <ButtonUtility
              aria-label={t('label.comment')}
              color="tertiary"
              data-testid="comment-button"
              icon={Comment}
              size="sm"
              {...commentPressProps}
            />
            <Reactions
              reactions={activity.reactions ?? []}
              onReactionSelect={onReactionUpdate ?? noop}
            />
          </Box>
        </div>
      </Box>
    </Box>
  );
}

export default ActivityEventFooter;
