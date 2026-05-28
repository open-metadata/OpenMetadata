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

import { Button, Col, Row } from 'antd';
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback } from 'react';
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

  const handleCommentClick = useCallback(() => {
    onActivityClick?.(activity);
  }, [onActivityClick, activity]);

  return (
    <Row align="top" className={classNames({ 'm-y-md': isForFeedTab })}>
      <Col className="footer-container" span={24}>
        <div>
          <div className="flex items-center gap-2 w-full rounded-8">
            <Button
              className="p-0 flex-center"
              data-testid="comment-button"
              type="text"
              onClick={isForFeedTab ? handleCommentClick : undefined}>
              <ThreadIcon data-testid="comment-icon" height={18} width={18} />
            </Button>
            <Reactions
              reactions={activity.reactions ?? []}
              onReactionSelect={onReactionUpdate ?? noop}
            />
          </div>
        </div>
      </Col>
    </Row>
  );
}

export default ActivityEventFooter;
