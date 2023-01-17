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
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { uniqueId } from 'lodash';
import { observer } from 'mobx-react';
import React, { FC, useMemo, useState } from 'react';
import { postFeedById, postThread } from 'rest/feedsAPI';
import AppState from '../../../../AppState';
import {
  CreateThread,
  ThreadType,
} from '../../../../generated/api/feed/createThread';
import { Post } from '../../../../generated/entity/feed/thread';
import { getEntityFeedLink } from '../../../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../../../utils/FeedUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ActivityThreadPanelBody from '../../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanelBody';
import AddAnnouncementModal from '../../../Modals/AnnouncementModal/AddAnnouncementModal';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  entityName: string;
  onClose: () => void;
}

const AnnouncementDrawer: FC<Props> = ({
  open,
  onClose,
  entityFQN,
  entityType,
  entityName,
}) => {
  const [isAnnouncement, setIsAnnouncement] = useState<boolean>(false);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const title = (
    <Space
      className="tw-justify-between"
      data-testid="title"
      style={{ width: '100%' }}>
      <Typography.Text className="tw-font-medium">
        Announcements on {entityName}
      </Typography.Text>
      <CloseOutlined onClick={onClose} />
    </Space>
  );

  const createThread = (data: CreateThread) => {
    postThread(data).catch((err: AxiosError) => {
      showErrorToast(err);
    });
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread);
  };

  const postFeedHandler = (value: string, id: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    } as Post;
    postFeedById(id, data).catch((err: AxiosError) => {
      showErrorToast(err);
    });
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    const callback = () => {
      return;
    };

    updateThreadData(threadId, postId, isThread, data, callback);
  };

  return (
    <>
      <div data-testid="announcement-drawer">
        <Drawer
          closable={false}
          open={open}
          placement="right"
          title={title}
          width={576}
          onClose={onClose}>
          <div className="tw-flex tw-justify-end">
            <Button
              data-testid="add-announcement"
              type="primary"
              onClick={() => setIsAnnouncement(true)}>
              Add Announcement
            </Button>
          </div>

          <ActivityThreadPanelBody
            className="tw-p-0"
            createThread={createThread}
            deletePostHandler={deletePostHandler}
            key={uniqueId()}
            postFeedHandler={postFeedHandler}
            showHeader={false}
            threadLink={getEntityFeedLink(entityType, entityFQN)}
            threadType={ThreadType.Announcement}
            updateThreadHandler={updateThreadHandler}
          />
        </Drawer>
      </div>

      {isAnnouncement && (
        <AddAnnouncementModal
          entityFQN={entityFQN || ''}
          entityType={entityType || ''}
          open={isAnnouncement}
          onCancel={() => setIsAnnouncement(false)}
        />
      )}
    </>
  );
};

export default observer(AnnouncementDrawer);
