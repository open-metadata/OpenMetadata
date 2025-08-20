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
import { Space } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconEdit from '../../../assets/svg/edit-new.svg?react';
import DeleteIcon from '../../../assets/svg/ic-delete.svg?react';
import ConfirmationModal from '../../../components/Modals/ConfirmationModal/ConfirmationModal';
import {
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';

import IconReply from '../../../assets/svg/ic-reply.svg?react';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-actions.less';

interface ActivityFeedActionsProps {
  post: Post;
  feed: Thread;
  isPost: boolean;
  onEditPost?: () => void;
}

const ActivityFeedActions = ({
  post,
  feed,
  isPost,
  onEditPost,
}: ActivityFeedActionsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const isAuthor = post.from === currentUser?.name;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deleteFeed, showDrawer, hideDrawer, updateEditorFocus } =
    useActivityFeedProvider();

  const onReply = () => {
    showDrawer(feed);

    updateEditorFocus(true);
  };

  const handleDelete = () => {
    deleteFeed(feed.id, post.id, !isPost).catch(() => {
      // ignore since error is displayed in toast in the parent promise.
    });
    setShowDeleteDialog(false);
    if (!isPost) {
      hideDrawer();
    }
  };

  const editCheck = useMemo(() => {
    if (feed.type === ThreadType.Announcement && !isPost) {
      return false;
    } else if (feed.type === ThreadType.Task && !isPost) {
      return false;
    } else if (isAuthor) {
      return true;
    }

    return false;
  }, [post, feed, currentUser]);

  const deleteCheck = useMemo(() => {
    if (feed.type === ThreadType.Task && !isPost) {
      return false;
    } else if (isAuthor || currentUser?.isAdmin) {
      return true;
    }

    return false;
  }, [post, feed, isAuthor, currentUser]);

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
