/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Popover, Space } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, uniqueId } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconReaction } from '../../../assets/svg/ic-reaction.svg';
import { ReactComponent as IconReply } from '../../../assets/svg/ic-reply.svg';
import ConfirmationModal from '../../../components/Modals/ConfirmationModal/ConfirmationModal';
import { REACTION_LIST } from '../../../constants/reactions.constant';
import { ReactionOperation } from '../../../enums/reactions.enum';
import {
  Post,
  ReactionType,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deletePostById,
  deleteThread,
  updatePost,
  updateThread,
} from '../../../rest/feedsAPI';
import { getUpdatedThread } from '../../../utils/FeedUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import Reaction from '../Reactions/Reaction';
import './activity-feed-actions.less';

interface ActivityFeedActionsProps {
  post: Post;
  feed: Thread;
  isPost: boolean;
  onEditPost?: () => void;
  isAnnouncementTab?: boolean;
  updateAnnouncementThreads?: () => void;
  permissions?: boolean;
}

const ActivityFeedActions = ({
  post,
  feed,
  isPost,
  onEditPost,
  isAnnouncementTab,
  updateAnnouncementThreads,
  permissions,
}: ActivityFeedActionsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const isAuthor = post.from === currentUser?.name;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const {
    deleteFeed,
    showDrawer,
    hideDrawer,
    updateEditorFocus,
    updateEntityThread,
  } = useActivityFeedProvider();
  const [visible, setVisible] = useState<boolean>(false);
  const onReply = () => {
    showDrawer(feed);

    updateEditorFocus(true);
  };

  // delete Announcement in Service page's Announcement Tab
  const deleteAnnouncementFeed = useCallback(
    async (threadId: string, postId: string, isThread: boolean) => {
      if (isThread) {
        await deleteThread(threadId);
      } else {
        await deletePostById(threadId, postId);
        await getUpdatedThread(threadId);
      }
      updateAnnouncementThreads && updateAnnouncementThreads();
    },
    []
  );

  const handleDelete = () => {
    if (isAnnouncementTab && feed.type === ThreadType.Announcement) {
      deleteAnnouncementFeed(feed.id, post.id, !isPost); // delete Announcement feed in Service page's Announcement Tab
    } else {
      deleteFeed(feed.id, post.id, !isPost).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
      });
    }

    setShowDeleteDialog(false);
    if (!isPost) {
      hideDrawer();
    }
  };
  const isAnnouncement = useMemo(
    () => feed.type === ThreadType.Announcement,
    [feed.type]
  );
  const editCheck = useMemo(() => {
    if (isAnnouncement) {
      if (isPost && isAuthor) {
        return true;
      }

      return permissions;
    } else if (feed.type === ThreadType.Task && !isPost) {
      return false;
    } else if (isAuthor) {
      return true;
    }

    return false;
  }, [post, feed, currentUser]);

  const deleteCheck = useMemo(() => {
    if (isAnnouncement) {
      if (isPost && isAuthor) {
        return true;
      }

      return permissions;
    } else if (feed.type === ThreadType.Task && !isPost) {
      return false;
    } else if (isAuthor || currentUser?.isAdmin) {
      return true;
    }

    return false;
  }, [post, feed, isAuthor, currentUser]);

  const hide = () => {
    setVisible(false);
  };

  const handleVisibleChange = (newVisible: boolean) => {
    setVisible(newVisible);
  };

  const applyPatch = async (patch: any) => {
    try {
      if (!isEmpty(patch)) {
        if (feed.type === 'Announcement' && !isAnnouncementTab) {
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
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const onReactionSelect = async (
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

      updatedReactions = [...updatedReactions, reactionObject as any];
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

  const isReacted = (reactionType: ReactionType) => {
    const reactions = isPost ? post.reactions : feed.reactions;

    return reactions?.some(
      (reactionItem) =>
        reactionItem.user.id === currentUser?.id &&
        reactionType === reactionItem.reactionType
    );
  };

  const reactionList = REACTION_LIST.map((reaction) => {
    return (
      <Reaction
        isReacted={isReacted(reaction.reaction) as boolean}
        key={uniqueId()}
        reaction={reaction}
        onHide={() => {
          hide();
        }}
        onReactionSelect={onReactionSelect}
      />
    );
  });

  return (
    <>
      <Space className="feed-actions" data-testid="feed-actions" size={12}>
        {!isPost && (
          <Icon
            className="toolbar-button"
            component={IconReply}
            data-testid="add-reply"
            style={{ fontSize: '16px' }}
            onClick={onReply}
          />
        )}
        {feed.type === ThreadType.Announcement && !isPost && (
          <Popover
            destroyTooltipOnHide
            align={{ targetOffset: [0, -10] }}
            content={reactionList || []}
            id="reaction-popover"
            open={visible}
            overlayClassName="ant-popover-feed-reactions"
            placement="topLeft"
            trigger="click"
            zIndex={9999}
            onOpenChange={handleVisibleChange}>
            <Icon
              component={IconReaction}
              data-testid="add-reactions"
              style={{ fontSize: '16px' }}
            />
          </Popover>
        )}

        {editCheck && (
          <Icon
            className="toolbar-button"
            component={IconEdit}
            data-testid="edit-message"
            style={{ fontSize: '16px' }}
            onClick={onEditPost}
          />
        )}

        {deleteCheck && (
          <Icon
            className="toolbar-button"
            component={DeleteIcon}
            data-testid="delete-message"
            style={{ fontSize: '16px' }}
            onClick={() => setShowDeleteDialog(true)}
          />
        )}
      </Space>
      <ConfirmationModal
        bodyText={t('message.confirm-delete-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.delete')}
        header={t('message.delete-message-question-mark')}
        visible={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default ActivityFeedActions;
