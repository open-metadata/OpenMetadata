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
import { Card, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Post, ThreadType } from '../../generated/entity/feed/thread';
import { getFeedById } from '../../rest/feedsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedEditor from '../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import AnnouncementBadge from '../ActivityFeed/Shared/AnnouncementBadge';
import { AnnouncementFeedCardProp } from './Announcement.interface';
import './announcement.less';
import AnnouncementFeedCardBody from './AnnouncementFeedCardBody.component';

const AnnouncementFeedCard = ({
  feed,
  task,
  editPermission,
  postFeed,
  onConfirmation,
  updateThreadHandler,
}: AnnouncementFeedCardProp) => {
  const { t } = useTranslation();
  const [isReplyThreadVisible, setReplyThreadVisible] =
    useState<boolean>(false);
  const [postFeedData, setPostFeedData] = useState<Post[]>([]);

  const fetchAnnouncementThreadData = async () => {
    try {
      const res = await getFeedById(task.id);
      setPostFeedData(res.data.posts ?? []);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('message.entity-fetch-error', {
          entity: t('label.message-lowercase-plural'),
        })
      );
    }
  };

  const handleUpdateThreadHandler = async (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    await updateThreadHandler(threadId, postId, isThread, data);

    if (isReplyThreadVisible) {
      fetchAnnouncementThreadData();
    }
  };

  const handleSaveReply = async (value: string) => {
    await postFeed(value, task.id);

    if (isReplyThreadVisible) {
      fetchAnnouncementThreadData();
    }
  };

  const handleOpenReplyThread = () => {
    fetchAnnouncementThreadData();
    setReplyThreadVisible((prev) => !prev);
  };

  // fetch announcement thread after delete action
  useEffect(() => {
    if (postFeedData.length !== task.postsCount) {
      if (isReplyThreadVisible) {
        fetchAnnouncementThreadData();
      }
    }
  }, [task.postsCount]);

  return (
    <>
      <Card
        className="ant-card-feed announcement-thread-card"
        data-testid="announcement-card">
        <AnnouncementBadge />
        <AnnouncementFeedCardBody
          isEntityFeed
          isThread
          announcementDetails={task.announcement}
          editPermission={editPermission}
          entityLink={task.about}
          feed={feed}
          feedType={task.type || ThreadType.Conversation}
          isReplyThreadOpen={isReplyThreadVisible}
          showReplyThread={handleOpenReplyThread}
          task={task}
          threadId={task.id}
          updateThreadHandler={handleUpdateThreadHandler}
          onConfirmation={onConfirmation}
          onReply={handleOpenReplyThread}
        />
      </Card>

      {isReplyThreadVisible && (
        <Row className="m-t-lg" gutter={[10, 0]} wrap={false}>
          <Col className="d-flex justify-end" flex="74px">
            <div className="feed-line" />
          </Col>
          <Col flex="auto">
            <div className="w-full m-l-xs" data-testid="replies">
              {postFeedData.map((reply, key) => (
                <AnnouncementFeedCardBody
                  isEntityFeed
                  className="m-b-sm"
                  editPermission={editPermission}
                  feed={reply}
                  feedType={task.type || ThreadType.Conversation}
                  key={key}
                  showRepliesButton={false}
                  task={task}
                  threadId={task.id}
                  updateThreadHandler={handleUpdateThreadHandler}
                  onConfirmation={onConfirmation}
                />
              ))}
            </div>
            <ActivityFeedEditor onSave={handleSaveReply} />
          </Col>
        </Row>
      )}
    </>
  );
};

export default AnnouncementFeedCard;
