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

import { Button, Col, Dropdown, Row, Skeleton, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactComponent as TaskCloseIcon } from '../../assets/svg/ic-check-circle-new.svg';
import { ReactComponent as TaskCloseIconBlue } from '../../assets/svg/ic-close-task.svg';
import { ReactComponent as FilterIcon } from '../../assets/svg/ic-feeds-filter.svg';
import { ReactComponent as TaskOpenIcon } from '../../assets/svg/ic-open-task.svg';
import { ReactComponent as TaskIcon } from '../../assets/svg/ic-task-new.svg';
import '../../components/ActivityFeed/ActivityFeedTab/activity-feed-tab.less';
import '../../components/Announcement/announcement.less';
import { ICON_DIMENSION_USER_PAGE } from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import {
  AnnoucementStatus,
  Post,
  Thread,
} from '../../generated/entity/feed/thread';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { FeedCounts } from '../../interface/feed.interface';
import {
  getAnnouncements,
  getFeedCount,
  postFeedById,
} from '../../rest/feedsAPI';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedListV1 from '../ActivityFeed/ActivityFeedList/ActivityFeedListV1.component';
import FeedPanelBodyV1New from '../ActivityFeed/ActivityFeedPanel/FeedPanelBodyV1New';
import AddAnnouncementModal from '../Modals/AnnouncementModal/AddAnnouncementModal';

interface AnnouncementTabProps {
  fqn: string;
  entityType: EntityType;
  permissions: OperationPermission;
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
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const { currentUser } = useApplicationStore();
  const [countData, setCountData] = useState<{
    loading: boolean;
    data: FeedCounts;
  }>({
    loading: false,
    data: FEED_COUNT_INITIAL_DATA,
  });

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
    fetchFeedsCount();
  }, []);

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
    postFeed(message, selectedAnnouncementThread?.id ?? '')
      .then(() => {
        setShowFeedEditor(false);
      })
      .catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
  };

  const updateAnnouncementThreads = useCallback(() => {
    getThreads();
  }, [getThreads]);

  const fetchFeedsCount = async () => {
    setCountData((prev) => ({ ...prev, loading: true }));
    try {
      const res = await getFeedCount(getEntityFeedLink(entityType, fqn));
      setCountData((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          activeAnnouncementCount: res[0]?.activeAnnouncementCount ?? 0,
          inactiveAnnouncementCount: res[0]?.inactiveAnnouncementCount ?? 0,
          totalAnnouncementCount: res[0]?.totalAnnouncementCount ?? 0,
        },
      }));
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.entity-feed-count-error'));
    }
    setCountData((prev) => ({ ...prev, loading: false }));
  };

  useEffect(() => {
    fetchFeedsCount();
  }, []);

  const announcementFilterOptions = useMemo(
    () => [
      {
        key: AnnoucementStatus.Active,
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: announcementFilter === AnnoucementStatus.Active }
            )}
            data-testid="active-announcements">
            <div className="flex items-center space-x-2">
              {announcementFilter === AnnoucementStatus.Active ? (
                <TaskOpenIcon
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              ) : (
                <TaskIcon className="m-r-xs" {...ICON_DIMENSION_USER_PAGE} />
              )}
              <span
                className={classNames('task-tab-filter-item', {
                  selected: announcementFilter === AnnoucementStatus.Active,
                })}>
                {t('label.active')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: announcementFilter === AnnoucementStatus.Active,
              })}>
              <span className="task-count-text">
                {countData.loading ? (
                  <Skeleton.Button
                    active
                    className="count-loader"
                    size="small"
                  />
                ) : (
                  countData.data?.activeAnnouncementCount
                )}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleUpdateAnnouncementFilter(AnnoucementStatus.Active);
        },
      },
      {
        key: AnnoucementStatus.Inactive,
        label: (
          <div
            className={classNames(
              'flex items-center justify-between px-4 py-2 gap-2',
              { active: announcementFilter === AnnoucementStatus.Inactive }
            )}
            data-testid="inactive-announcements">
            <div className="flex items-center space-x-2">
              {announcementFilter === AnnoucementStatus.Inactive ? (
                <TaskCloseIconBlue
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              ) : (
                <TaskCloseIcon
                  className="m-r-xs"
                  {...ICON_DIMENSION_USER_PAGE}
                />
              )}
              <span
                className={classNames('task-tab-filter-item', {
                  selected: announcementFilter === AnnoucementStatus.Inactive,
                })}>
                {t('label.inactive')}
              </span>
            </div>
            <span
              className={classNames('task-count-container d-flex flex-center', {
                active: announcementFilter === AnnoucementStatus.Inactive,
              })}>
              <span className="task-count-text">
                {countData.loading ? (
                  <Skeleton.Button
                    active
                    className="count-loader"
                    size="small"
                  />
                ) : (
                  countData.data.inactiveAnnouncementCount
                )}
              </span>
            </span>
          </div>
        ),
        onClick: () => {
          handleUpdateAnnouncementFilter(AnnoucementStatus.Inactive);
        },
      },
    ],
    [announcementFilter, countData, handleUpdateAnnouncementFilter]
  );

  return (
    <div className="two-column-layout">
      <Row gutter={[0, 16]} style={{ height: '100%' }}>
        <Col className="left-column" md={12} xs={24}>
          <div className="d-flex p-md p-x-lg p-b-0 justify-between d-flex">
            <div className="d-flex gap-4">
              <Dropdown
                menu={{
                  items: announcementFilterOptions,
                  selectedKeys: [...announcementFilter],
                }}
                overlayClassName="task-tab-custom-dropdown"
                trigger={['click']}>
                <Button
                  className="feed-filter-icon"
                  data-testid="announcement-filter-icon"
                  icon={<FilterIcon height={16} />}
                />
              </Dropdown>
            </div>
            {!permissions?.EditAll ? (
              <Tooltip title={t('message.no-permission-to-view')}>
                <Button
                  data-testid="add-announcement-btn"
                  disabled={!permissions?.EditAll}
                  type="primary"
                  onClick={handleOpenAnnouncementModal}>
                  {t('label.add')}
                </Button>
              </Tooltip>
            ) : (
              <Button
                data-testid="add-announcement-btn"
                type="primary"
                onClick={handleOpenAnnouncementModal}>
                {t('label.add')}
              </Button>
            )}
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
            permissions={permissions?.EditAll}
            selectedThread={selectedAnnouncementThread}
            showThread={false}
            updateAnnouncementThreads={updateAnnouncementThreads}
            onFeedClick={updateSelectedThread}
            onSave={onSave}
          />
        </Col>

        {selectedAnnouncementThread && (
          <Col className="right-column" md={12} xs={24}>
            <div id="feed-panel">
              <div>
                <FeedPanelBodyV1New
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
