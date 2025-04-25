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

import { Avatar, Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { compare } from 'fast-json-patch';
import { isEmpty, min, noop, sortBy } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ThreadIcon } from '../../../../assets/svg/thread-icon.svg';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import { Post, ThreadType } from '../../../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../../../generated/type/reaction';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { updatePost, updateThread } from '../../../../rest/feedsAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { getUpdatedThread } from '../../../../utils/FeedUtils';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { useActivityFeedProvider } from '../../ActivityFeedProvider/ActivityFeedProvider';
import Reactions from '../../Reactions/Reactions';
import { FeedCardFooterProps } from './FeedCardFooter.interface';

function FeedCardFooter({
  feed,
  post,
  isPost = false,
  componentsVisibility = {
    showThreadIcon: true,
    showRepliesContainer: true,
  },
  isAnnouncementTab = false,
  updateAnnouncementThreads,
}: Readonly<FeedCardFooterProps>) {
  const { t } = useTranslation();
  const { showDrawer, updateReactions, fetchUpdatedThread } =
    useActivityFeedProvider();
  const { currentUser } = useApplicationStore();
  // The number of posts in the thread
  const postLength = useMemo(() => feed?.postsCount ?? 0, [feed?.postsCount]);

  // The latest reply timestamp and the list of unique users who replied
  const { latestReplyTimeStamp, repliedUniqueUsersList } = useMemo(() => {
    const posts = sortBy(feed?.posts, 'postTs').reverse();
    const latestReplyTimeStamp = posts[0]?.postTs;

    const repliedUsers = [...new Set((feed?.posts ?? []).map((f) => f.from))];

    const repliedUniqueUsersList = repliedUsers.slice(
      0,
      min([3, repliedUsers.length])
    );

    return { latestReplyTimeStamp, repliedUniqueUsersList };
  }, [feed?.posts]);
  const { updateEntityThread } = useActivityFeedProvider();

  const isFeedTypeAnnouncement = useMemo(
    () => feed.type === ThreadType.Announcement,
    [feed.type]
  );
  const applyPatch = async (patch: any) => {
    if (!isEmpty(patch)) {
      if (isFeedTypeAnnouncement && !isAnnouncementTab) {
        if (isPost) {
          await updatePost(feed.id, post.id, patch);
        } else {
          await updateThread(feed.id, patch);
        }
        const updatedthread = await getUpdatedThread(feed.id);
        updateEntityThread(updatedthread);
      } else {
        if (isPost) {
          await updatePost(feed.id, post.id, patch);
        } else {
          await updateThread(feed.id, patch);
        }
        updateAnnouncementThreads?.();
      }
    }
  };
  const updateAnnouncementsThreadReactions = async (
    post: Post,
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => {
    let updatedReactions = isPost ? post.reactions || [] : feed.reactions || [];
    if (reactionOperation === ReactionOperation.ADD) {
      const reactionObject = {
        reactionType,
        user: {
          id: currentUser?.id as string,
        },
      };

      updatedReactions = [...updatedReactions, reactionObject as Reaction];
    } else {
      updatedReactions = updatedReactions.filter(
        (reaction) =>
          !(
            reaction.reactionType === reactionType &&
            reaction.user.id === currentUser?.id
          )
      );
    }
    const originalObject = isPost
      ? { ...post, reactions: [...(post.reactions || [])] }
      : { ...feed, reactions: [...(feed.reactions || [])] };

    const updatedObject = isPost
      ? { ...post, reactions: updatedReactions }
      : { ...feed, reactions: updatedReactions };

    const patch = compare(originalObject, updatedObject);

    applyPatch(patch);
  };
  const handleAnnouncementReactionUpdate = async (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => {
    updateAnnouncementsThreadReactions(post, reaction, operation);
  };

  const handleDefaultReactionUpdate = async (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => {
    await updateReactions(post, feed.id, !isPost, reaction, operation);
    await fetchUpdatedThread(feed.id);
  };

  const handleReactionForAnnouncement = () => {
    return handleAnnouncementReactionUpdate;
  };

  const handleReactionForDefault = () => {
    return handleDefaultReactionUpdate;
  };

  const getReactionHandler = () => {
    if (isAnnouncementTab) {
      return handleReactionForAnnouncement();
    }

    return handleReactionForDefault();
  };

  const onReactionUpdate = useCallback(
    async (reaction: ReactionType, operation: ReactionOperation) => {
      const reactionHandler = getReactionHandler();
      await reactionHandler(reaction, operation);
    },
    [isAnnouncementTab, post, feed.id, fetchUpdatedThread, updateReactions]
  );

  const showReplies = useCallback(() => {
    showDrawer?.(feed);
  }, [showDrawer, feed]);

  return (
    <Row>
      <Col span={24}>
        <Space className="p-xss" size={8}>
          {componentsVisibility.showThreadIcon && postLength === 0 && (
            <Button
              className="flex-center p-0"
              data-testid="thread-count"
              icon={<ThreadIcon width={18} />}
              shape="circle"
              size="small"
              type="text"
            />
          )}
          <Reactions
            reactions={post.reactions ?? []}
            showAddEmoji={!isFeedTypeAnnouncement} // hide emoji if its Announcement , since we are showing add emoji thrg pop up
            onReactionSelect={onReactionUpdate ?? noop}
          />
        </Space>
      </Col>
      <Col span={24}>
        {componentsVisibility.showRepliesContainer && postLength !== 0 && (
          <Button
            className="flex items-center gap-2 p-x-xss w-full rounded-8"
            type="text"
            onClick={componentsVisibility.showThreadIcon ? showReplies : noop}>
            {feed.type !== ThreadType.Announcement && postLength > 0 && (
              <Avatar.Group>
                {repliedUniqueUsersList.map((user) => (
                  <ProfilePicture
                    avatarType="outlined"
                    key={user}
                    name={user}
                    size={20}
                  />
                ))}
              </Avatar.Group>
            )}
            <Typography.Text
              className="text-xs font-medium text-primary"
              data-testid="reply-count">
              {postLength <= 1
                ? t('label.one-reply')
                : t('label.number-reply-plural', {
                    number: postLength,
                  })}
            </Typography.Text>
            {latestReplyTimeStamp && (
              <Tooltip
                color="white"
                overlayClassName="timestamp-tooltip"
                title={formatDateTime(latestReplyTimeStamp)}>
                <span
                  className="feed-card-header-v2-timestamp"
                  data-testid="timestamp">
                  {getRelativeTime(latestReplyTimeStamp)}
                </span>
              </Tooltip>
            )}
          </Button>
        )}
      </Col>
    </Row>
  );
}

export default FeedCardFooter;
