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

import { AvatarStack } from '@openmetadata/ui-core-components';
import { Button, Col, Row } from 'antd';
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback, useMemo } from 'react';
import { ReactComponent as ThreadIcon } from '../../../../assets/svg/ic-reply-2.svg';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import { ReactionType } from '../../../../generated/type/reaction';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { useActivityFeedProvider } from '../../ActivityFeedProvider/ActivityFeedProvider';
import Reactions from '../../Reactions/Reactions';
import { FeedCardFooterProps } from './FeedCardFooter.interface';

const MAX_VISIBLE_AVATARS = 3;
const AVATAR_SIZE = 20;

function FeedCardFooterNew({
  conversation,
  conversationId,
  reply,
  isReply = false,
  isForFeedTab = false,
}: Readonly<FeedCardFooterProps>) {
  const { showDrawer, updateReactions } = useActivityFeedProvider();

  const postLength = useMemo(
    () => conversation?.replyCount ?? 0,
    [conversation?.replyCount]
  );

  const repliedUsers = useMemo(() => {
    return [
      ...new Set(
        (conversation?.replies ?? [])
          .map((item) => item.author.name ?? item.author.fullyQualifiedName)
          .filter((name): name is string => Boolean(name))
      ),
    ];
  }, [conversation?.replies]);

  const onReactionUpdate = useCallback(
    async (reaction: ReactionType, operation: ReactionOperation) => {
      const target = reply ?? conversation;

      if (!target) {
        return;
      }
      await updateReactions(
        target,
        conversationId,
        !isReply,
        reaction,
        operation
      );
    },
    [updateReactions, reply, conversation, conversationId, isReply]
  );

  const showReplies = useCallback(() => {
    if (conversation) {
      showDrawer(conversation);
    }
  }, [showDrawer, conversation]);

  return (
    <Row align="top" className={classNames({ 'm-y-md': isReply })}>
      <Col
        className="footer-container"
        data-testid="feed-card-footer"
        span={24}>
        <div>
          <div className="flex items-center gap-2 w-full rounded-8">
            {postLength > 0 && !isReply && (
              <AvatarStack
                avatarSize={AVATAR_SIZE}
                items={repliedUsers.map((user) => (
                  <Button
                    className="p-0"
                    key={user}
                    type="text"
                    onClick={isForFeedTab ? showReplies : undefined}>
                    <UserPopOverCard userName={user}>
                      <ProfilePicture name={user} width="20" />
                    </UserPopOverCard>
                  </Button>
                ))}
                maxCount={MAX_VISIBLE_AVATARS}
                onOverflowClick={isForFeedTab ? showReplies : undefined}
              />
            )}

            {!isReply && (
              <Button
                className="p-0 flex-center"
                data-testid="reply-button"
                type="text"
                onClick={isForFeedTab ? showReplies : undefined}>
                <ThreadIcon data-testid="reply-count" height={18} width={18} />
              </Button>
            )}
            <Reactions
              reactions={(reply ?? conversation)?.reactions ?? []}
              onReactionSelect={onReactionUpdate ?? noop}
            />
          </div>
        </div>
      </Col>
    </Row>
  );
}

export default FeedCardFooterNew;
