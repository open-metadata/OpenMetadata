/*
 *  Copyright 2022 Collate.
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

import { CloseOutlined } from '@ant-design/icons';
import { Button, Drawer, Space, Typography } from 'antd';
import { Tooltip } from '../../AntdCompat';;
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Post } from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { postFeedById } from '../../../../rest/feedsAPI';
import { getEntityFeedLink } from '../../../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../../../utils/FeedUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AnnouncementThreadBody from '../../../Announcement/AnnouncementThreadBody.component';
import AddAnnouncementModal from '../../../Modals/AnnouncementModal/AddAnnouncementModal';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  createPermission: boolean;
  onClose: () => void;
}

const AnnouncementDrawer: FC<Props> = ({
  open,
  onClose,
  entityFQN,
  entityType,
  createPermission = false,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] =
    useState<boolean>(false);
  const [refetchThread, setRefetchThread] = useState<boolean>(false);

  const title = (
    <Space
      align="start"
      className="justify-between"
      data-testid="title"
      style={{ width: '100%' }}>
      <Typography.Text className="font-medium break-all">
        {t('label.announcement-plural')}
      </Typography.Text>
      <CloseOutlined data-testid="announcement-close" onClick={onClose} />
    </Space>
  );

  const deletePostHandler = async (
    threadId: string,
    postId: string,
    isThread: boolean
  ): Promise<void> => {
    await deletePost(threadId, postId, isThread);
  };

  const postFeedHandler = async (value: string, id: string): Promise<void> => {
    const data = {
      message: value,
      from: currentUser?.name,
    } as Post;

    try {
      await postFeedById(id, data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const updateThreadHandler = async (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ): Promise<void> => {
    const callback = () => {
      return;
    };

    await updateThreadData(threadId, postId, isThread, data, callback);
  };

  const handleCloseAnnouncementModal = useCallback(
    () => setIsAddAnnouncementOpen(false),
    []
  );
  const handleOpenAnnouncementModal = useCallback(
    () => setIsAddAnnouncementOpen(true),
    []
  );

  const handleSaveAnnouncement = useCallback(() => {
    handleCloseAnnouncementModal();
    setRefetchThread((prev) => !prev);
  }, []);

  return (
    <Drawer
      closable={false}
      data-testid="announcement-drawer"
      open={open}
      placement="right"
      title={title}
      width={576}
      onClose={onClose}>
      <div className="d-flex justify-end">
        <Tooltip
          title={!createPermission && t('message.no-permission-to-view')}>
          <Button
            data-testid="add-announcement"
            disabled={!createPermission}
            type="primary"
            onClick={handleOpenAnnouncementModal}>
            {t('label.add-entity', { entity: t('label.announcement') })}
          </Button>
        </Tooltip>
      </div>

      <AnnouncementThreadBody
        deletePostHandler={deletePostHandler}
        editPermission={createPermission}
        postFeedHandler={postFeedHandler}
        refetchThread={refetchThread}
        threadLink={getEntityFeedLink(entityType, entityFQN)}
        updateThreadHandler={updateThreadHandler}
      />

      {isAddAnnouncementOpen && (
        <AddAnnouncementModal
          entityFQN={entityFQN || ''}
          entityType={entityType || ''}
          open={isAddAnnouncementOpen}
          onCancel={handleCloseAnnouncementModal}
          onSave={handleSaveAnnouncement}
        />
      )}
    </Drawer>
  );
};

export default AnnouncementDrawer;
