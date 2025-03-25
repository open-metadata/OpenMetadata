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

import { Button, Col, Row, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import '../../components/ActivityFeed/ActivityFeedTab/activity-feed-tab.less';
import '../../components/Announcement/announcement.less';
import { UIPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import {
  AnnoucementStatus,
  Post,
  Thread,
  ThreadType,
} from '../../generated/entity/feed/thread';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getAnnouncements, postFeedById } from '../../rest/feedsAPI';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedEditor from '../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import ActivityFeedListV1 from '../ActivityFeed/ActivityFeedList/ActivityFeedListV1.component';
import FeedPanelBodyV1 from '../ActivityFeed/ActivityFeedPanel/FeedPanelBodyV1';
import FeedPanelHeader from '../ActivityFeed/ActivityFeedPanel/FeedPanelHeader';
import AddAnnouncementModal from '../Modals/AnnouncementModal/AddAnnouncementModal';
interface AnnouncementTabProps {
  fqn: string;
  entityType: EntityType;
  permissions: UIPermission;
}

const AnnouncementTab: React.FC<AnnouncementTabProps> = ({
  fqn,
  entityType,
  permissions,
}) => {
  const [announcementFilter, setAnnouncementFilter] =
    useState<AnnoucementStatus>(AnnoucementStatus.Active);
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] =
    useState<boolean>(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedAnnouncementThread, setSelectedAnnouncementThread] =
    useState<Thread>();
  const { currentUser } = useApplicationStore();

  const getThreads = async () => {
    try {
      const res = await getAnnouncements(
        announcementFilter === AnnoucementStatus.Active,
        getEntityFeedLink(entityType, fqn)
      );
      setThreads(res.data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.thread-plural-lowercase'),
        })
      );
    }
  };

  const handleUpdateAnnouncementFilter = (filter: AnnoucementStatus) => {
    setAnnouncementFilter(filter);
  };

  useEffect(() => {
    getThreads();
  }, [announcementFilter]);

  const updateSelectedThread = (thread: Thread) => {
    setSelectedAnnouncementThread(thread);
  };

  // add announcement
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
    getThreads();
  }, [announcementFilter]);

  // reply on announcements
  const postFeed = useCallback(async (value: string, id: string) => {
    if (!currentUser) {
      return;
    }

    const data = {
      message: value,
      from: currentUser.name,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      setSelectedAnnouncementThread(res);
      const { id: responseId, posts } = res;
      setThreads((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  }, []);

  const onSave = (message: string) => {
    postFeed(message, selectedAnnouncementThread?.id ?? '').catch(() => {
      // ignore since error is displayed in toast in the parent promise.
      // Added block for sonar code smell
    });
  };

  const updateAnnouncementThreads = useCallback(() => {
    getThreads();
  }, [getThreads]);

  return (
    <div className="two-column-layout">
      <Row gutter={[0, 16]} style={{ height: '100%' }}>
        <Col className="left-column" md={12} xs={24}>
          <div className="d-flex p-sm p-x-lg justify-between activity-feed-task @grey-1">
            <div className="d-flex gap-4">
              <Typography.Text
                className={classNames(
                  'cursor-pointer p-l-xss d-flex items-center',
                  {
                    'font-medium':
                      announcementFilter === AnnoucementStatus.Active,
                  }
                )}
                data-testid="active-announcement"
                onClick={() => {
                  handleUpdateAnnouncementFilter(AnnoucementStatus.Active);
                }}>
                {0} {t('label.active')}
              </Typography.Text>
              <Typography.Text
                className={classNames('cursor-pointer d-flex items-center', {
                  'font-medium':
                    announcementFilter === AnnoucementStatus.Inactive,
                })}
                data-testid="inactive-announcements"
                onClick={() => {
                  handleUpdateAnnouncementFilter(AnnoucementStatus.Inactive);
                }}>
                {0} {t('label.inactive')}
              </Typography.Text>
            </div>
            <Tooltip title={t('message.no-permission-to-view')}>
              <Button
                data-testid="add-announcement-btn"
                disabled={
                  !permissions[entityType.slice(0, -1) as keyof UIPermission]
                    ?.EditAll
                }
                type="primary"
                onClick={handleOpenAnnouncementModal}>
                {t('label.add')}
              </Button>
            </Tooltip>
          </div>
          <ActivityFeedListV1
            hidePopover
            isAnnouncementTab
            isForFeedTab
            activeFeedId={selectedAnnouncementThread?.id}
            componentsVisibility={{
              showThreadIcon: false,
              showRepliesContainer: true,
            }}
            emptyPlaceholderText={t('message.no-announcement-message')}
            feedList={threads}
            isLoading={false}
            permissions={
              permissions[entityType.slice(0, -1) as keyof UIPermission]
                ?.EditAll
            }
            selectedThread={selectedAnnouncementThread}
            showThread={false}
            updateAnnouncementThreads={updateAnnouncementThreads}
            onFeedClick={updateSelectedThread}
          />
        </Col>

        {selectedAnnouncementThread && (
          <Col className="right-column" md={12} xs={24}>
            <div id="feed-panel">
              <div className="feed-explore-heading">
                <FeedPanelHeader
                  hideCloseIcon
                  className="p-x-md"
                  entityLink={selectedAnnouncementThread?.about}
                  feed={selectedAnnouncementThread}
                  threadType={
                    selectedAnnouncementThread?.type ?? ThreadType.Conversation
                  }
                  onCancel={noop}
                />
              </div>

              <div className="m-md">
                <FeedPanelBodyV1
                  isAnnouncementCard
                  isAnnouncementTab
                  isForFeedTab
                  isOpenInDrawer
                  showThread
                  componentsVisibility={{
                    showThreadIcon: false,
                    showRepliesContainer: false,
                  }}
                  feed={selectedAnnouncementThread}
                  hidePopover={false}
                  updateAnnouncementThreads={updateAnnouncementThreads}
                />
                <ActivityFeedEditor
                  className="m-t-md feed-editor"
                  onSave={onSave}
                />
              </div>
            </div>
          </Col>
        )}
      </Row>
      {isAddAnnouncementOpen && (
        <AddAnnouncementModal
          isAnnouncementTab
          entityFQN={fqn || ''}
          entityType={entityType || ''}
          open={isAddAnnouncementOpen}
          onCancel={handleCloseAnnouncementModal}
          onSave={handleSaveAnnouncement}
        />
      )}
    </div>
  );
};

export default AnnouncementTab;
