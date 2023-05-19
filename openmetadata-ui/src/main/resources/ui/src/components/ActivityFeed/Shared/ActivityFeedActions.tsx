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
import { LeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { Post, Thread } from 'generated/entity/feed/thread';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import { ReactComponent as DeleteIcon } from '/assets/svg/ic-delete.svg';

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deleteFeed, showDrawer, hideDrawer } = useActivityFeedProvider();

  const handleDelete = () => {
    deleteFeed(feed.id, post.id, !isPost);
    setShowDeleteDialog(false);
    if (!isPost) {
      hideDrawer();
    }
  };

  return (
    <>
      <div className="feed-actions">
        <Button
          className="expand-button"
          icon={<LeftOutlined />}
          size="small"
        />

        <div className="action-buttons">
          <Button
            className="toolbar-button"
            data-testid="add-reactions"
            size="small"
            type="text"
            onClick={(e) => e.stopPropagation()}>
            <SVGIcons
              alt="add-reaction"
              icon={Icons.REACTION}
              title={t('label.add-entity', {
                entity: t('label.reaction-lowercase-plural'),
              })}
              width="16px"
            />
          </Button>

          {!isPost && (
            <Button
              className="toolbar-button"
              data-testid="add-reply"
              size="small"
              type="text"
              onClick={() => showDrawer(feed)}>
              <SVGIcons
                alt="add-reply"
                icon={Icons.ADD_REPLY}
                title={t('label.reply')}
                width="16px"
              />
            </Button>
          )}

          <Button
            className="toolbar-button"
            data-testid="edit-message"
            icon={<EditIcon width={14} />}
            size="small"
            title={t('label.edit')}
            type="text"
            onClick={onEditPost}
          />
          <Button
            className="toolbar-button"
            data-testid="delete-message"
            icon={<DeleteIcon width={14} />}
            size="small"
            title={t('label.delete')}
            type="text"
            onClick={() => setShowDeleteDialog(true)}
          />
        </div>
      </div>
      <DeleteConfirmationModal
        visible={showDeleteDialog}
        onDelete={handleDelete}
        onDiscard={() => setShowDeleteDialog(false)}
      />
    </>
  );
};

export default ActivityFeedActions;
