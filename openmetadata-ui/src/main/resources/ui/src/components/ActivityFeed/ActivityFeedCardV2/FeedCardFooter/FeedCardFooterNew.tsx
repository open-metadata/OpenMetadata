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

import {
  AvatarStack,
  Box,
  Button,
  ButtonUtility,
} from '@openmetadata/ui-core-components';
import {
  Comment,
  MessageDotsCircle,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback, useMemo } from 'react';
import {
  ButtonProps as AriaButtonProps,
  PressEvent,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { FEED_FOOTER_AVATAR_SIZE } from '../../../../constants/Feeds.constants';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import { ReactionType } from '../../../../generated/type/reaction';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { useActivityFeedProvider } from '../../ActivityFeedProvider/ActivityFeedProvider';
import Reactions from '../../Reactions/Reactions';
import { FeedCardFooterProps } from './FeedCardFooter.interface';
import { LABELLED_REPLY_CLASS } from './FeedCardFooterNew.constants';
import {
  getReactionsVariant,
  getReplyCountLabel,
  isReplyButtonShown,
} from './FeedCardFooterNew.utils';

const MAX_VISIBLE_AVATARS = 3;

interface ReplyButtonProps {
  count: number;
  showCount: boolean;
  pressProps: Pick<AriaButtonProps, 'onPress'>;
}

const ReplyButton = ({ count, showCount, pressProps }: ReplyButtonProps) => {
  const { t } = useTranslation();

  // The labelled one (activity thread panels) is the Inbox's footer button.
  if (showCount) {
    return (
      <Button
        className={LABELLED_REPLY_CLASS}
        color="tertiary"
        data-testid="reply-button"
        iconLeading={<MessageDotsCircle data-icon data-testid="reply-count" />}
        size="sm"
        {...pressProps}>
        {getReplyCountLabel(count, t)}
      </Button>
    );
  }

  return (
    <ButtonUtility
      aria-label={t('label.reply')}
      color="tertiary"
      data-testid="reply-button"
      icon={Comment}
      size="sm"
      {...pressProps}
    />
  );
};

function FeedCardFooterNew({
  conversation,
  conversationId,
  reply,
  isReply = false,
  isForFeedTab = false,
  componentsVisibility,
  onReplyPress,
  showReplyCount = false,
}: Readonly<FeedCardFooterProps>) {
  const { t } = useTranslation();
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

  // The press must keep bubbling: the card container behind this footer
  // selects the conversation on click, as it did when these were native
  // buttons.
  const handleRepliesPress = useCallback(
    (event: PressEvent) => {
      event.continuePropagation();
      if (onReplyPress) {
        onReplyPress();
      } else if (isForFeedTab) {
        showReplies();
      }
    },
    [isForFeedTab, onReplyPress, showReplies]
  );
  // ButtonUtility forwards its props to a react-aria Button but does not declare
  // onPress, and onClick would not let the click bubble, so the press handler is
  // passed as typed react-aria props.
  const repliesPressProps: Pick<AriaButtonProps, 'onPress'> = {
    onPress: handleRepliesPress,
  };

  return (
    <Box align="start" className={classNames({ 'm-y-md': isReply })}>
      <Box
        // footer-container pins the row to 24px, which the labelled reply
        // button's 40px hover outgrows.
        className={showReplyCount ? 'tw:w-full' : 'footer-container tw:w-full'}
        data-testid="feed-card-footer"
        direction="col">
        <div>
          <Box align="center" className="w-full rounded-8" gap={1}>
            {postLength > 0 && !isReply && !showReplyCount && (
              <AvatarStack
                avatarSize={FEED_FOOTER_AVATAR_SIZE}
                // The avatar fills its button while the icons sit inside padding, so the
                // stack takes extra space to match the icons' visible gap.
                className="tw:mr-0.75"
                items={repliedUsers.map((user) => (
                  <ButtonUtility
                    aria-label={t('label.view-replies-by-user', { user })}
                    className="tw:align-top"
                    color="tertiary"
                    icon={
                      <UserPopOverCard userName={user}>
                        <ProfilePicture name={user} size="xs" />
                      </UserPopOverCard>
                    }
                    key={user}
                    size="xs"
                    {...repliesPressProps}
                  />
                ))}
                maxCount={MAX_VISIBLE_AVATARS}
                onOverflowClick={isForFeedTab ? showReplies : undefined}
              />
            )}

            {isReplyButtonShown(isReply, componentsVisibility) && (
              <ReplyButton
                count={postLength}
                pressProps={repliesPressProps}
                showCount={showReplyCount}
              />
            )}
            <Reactions
              reactions={(reply ?? conversation)?.reactions ?? []}
              variant={getReactionsVariant(showReplyCount)}
              onReactionSelect={onReactionUpdate ?? noop}
            />
          </Box>
        </div>
      </Box>
    </Box>
  );
}

export default FeedCardFooterNew;
