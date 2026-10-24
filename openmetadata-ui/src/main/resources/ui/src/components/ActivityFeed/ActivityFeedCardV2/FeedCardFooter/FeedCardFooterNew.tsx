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

import { AvatarStack, Box, Button } from '@openmetadata/ui-core-components';
import { MessageDotsCircle } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { noop } from 'lodash';
import { useCallback, useMemo } from 'react';
import { PressEvent } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ThreadIcon } from '../../../../assets/svg/ic-reply-2.svg';
import {
  ReactionOperation,
  ReactionsVariant,
} from '../../../../enums/reactions.enum';
import { ReactionType } from '../../../../generated/type/reaction';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { useActivityFeedProvider } from '../../ActivityFeedProvider/ActivityFeedProvider';
import Reactions from '../../Reactions/Reactions';
import { FeedCardFooterProps } from './FeedCardFooter.interface';

const MAX_VISIBLE_AVATARS = 3;

const getReactionsVariant = (showReplyCount: boolean) =>
  showReplyCount ? ReactionsVariant.Pill : ReactionsVariant.Default;

// The Inbox footer's text button: a 16px icon in the reaction smiley's colour.
const LABELLED_REPLY_CLASS =
  'tw:px-2 tw:*:data-icon:size-4 tw:*:data-icon:text-fg-secondary tw:hover:*:data-icon:text-fg-secondary_hover';

// "Reply" while there are none, then how many: "1 Reply", "3 Replies".
const getReplyCountLabel = (count: number, t: TFunction): string => {
  if (!count) {
    return t('label.reply');
  }

  return count === 1
    ? t('label.one-reply')
    : t('label.number-reply-plural', { number: count });
};

interface ReplyButtonProps {
  count: number;
  showCount: boolean;
  onPress: (event: PressEvent) => void;
}

const ReplyButton = ({ count, showCount, onPress }: ReplyButtonProps) => {
  const { t } = useTranslation();

  // The labelled one (activity thread panels) is the Inbox's footer button:
  // the core icon, coloured for the theme. The legacy SVG is dark in dark mode.
  if (showCount) {
    return (
      <Button
        className={LABELLED_REPLY_CLASS}
        color="tertiary"
        data-testid="reply-button"
        iconLeading={<MessageDotsCircle data-icon data-testid="reply-count" />}
        size="sm"
        onPress={onPress}>
        {getReplyCountLabel(count, t)}
      </Button>
    );
  }

  return (
    <Button
      aria-label={t('label.reply')}
      className="p-0 flex-center tw:h-10! tw:border tw:border-transparent"
      color="tertiary"
      data-testid="reply-button"
      iconLeading={
        <ThreadIcon data-testid="reply-count" height={18} width={18} />
      }
      onPress={onPress}
    />
  );
};

// The stack's slot matches the `xs` avatar inside it.
const AVATAR_SIZE = 24;

function FeedCardFooterNew({
  conversation,
  conversationId,
  reply,
  isReply = false,
  isForFeedTab = false,
  onReplyPress,
  showReplyCount = false,
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

  return (
    <Box align="start" className={classNames({ 'm-y-md': isReply })}>
      <Box
        // footer-container pins the row to 24px, which the labelled reply
        // button's 40px hover outgrows.
        className={showReplyCount ? 'tw:w-full' : 'footer-container tw:w-full'}
        data-testid="feed-card-footer"
        direction="col">
        <div>
          <Box align="center" className="w-full rounded-8" gap={2}>
            {postLength > 0 && !isReply && !showReplyCount && (
              <AvatarStack
                avatarSize={AVATAR_SIZE}
                items={repliedUsers.map((user) => (
                  <Button
                    noTextPadding
                    className="p-0 tw:rounded-full"
                    color="tertiary"
                    key={user}
                    onPress={handleRepliesPress}>
                    <UserPopOverCard userName={user}>
                      <ProfilePicture name={user} size="xs" />
                    </UserPopOverCard>
                  </Button>
                ))}
                maxCount={MAX_VISIBLE_AVATARS}
                onOverflowClick={isForFeedTab ? showReplies : undefined}
              />
            )}

            {!isReply && (
              <ReplyButton
                count={postLength}
                showCount={showReplyCount}
                onPress={handleRepliesPress}
              />
            )}
            <Reactions
              // The pill reactions draw core icons that follow the theme.
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
