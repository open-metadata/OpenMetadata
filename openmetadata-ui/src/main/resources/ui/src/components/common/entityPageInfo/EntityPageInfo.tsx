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

import { StarOutlined } from '@ant-design/icons';
import { Button, Col, Dropdown, Popover, Row, Space, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import VersionButton from 'components/VersionButton/VersionButton.component';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isUndefined, toString } from 'lodash';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { getActiveAnnouncement } from 'rest/feedsAPI';
import { sortTagsCaseInsensitive } from 'utils/CommonUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { ReactComponent as IconCommentPlus } from '../../../assets/svg/add-chat.svg';
import { ReactComponent as IconComments } from '../../../assets/svg/comment.svg';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { ReactComponent as IconTaskColor } from '../../../assets/svg/Task-ic.svg';
import { FOLLOWERS_VIEW_CAP, ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Table } from '../../../generated/entity/data/table';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/type/entityReference';
import { LabelType, State, TagLabel } from '../../../generated/type/tagLabel';
import { useAfterMount } from '../../../hooks/useAfterMount';
import { EntityFieldThreads } from '../../../interface/feed.interface';
import { ANNOUNCEMENT_ENTITIES } from '../../../utils/AnnouncementsUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { fetchTagsAndGlossaryTerms } from '../../../utils/TagsUtils';
import {
  getRequestTagsPath,
  getUpdateTagsPath,
  TASK_ENTITIES,
} from '../../../utils/TasksUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TagsContainer from '../../Tag/TagsContainer/tags-container';
import EntitySummaryDetails from '../EntitySummaryDetails/EntitySummaryDetails';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { TitleBreadcrumbProps } from '../title-breadcrumb/title-breadcrumb.interface';
import AnnouncementCard from './AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from './AnnouncementDrawer/AnnouncementDrawer';
import FollowersModal from './FollowersModal';
import ManageButton from './ManageButton/ManageButton';

interface Props {
  titleLinks: TitleBreadcrumbProps['titleLinks'];
  isFollowing?: boolean;
  deleted?: boolean;
  followers?: number;
  extraInfo: Array<ExtraInfo>;
  tier: TagLabel | undefined;
  tags: Array<EntityTags>;
  isTagEditable?: boolean;
  followersList: Array<EntityReference>;
  entityName: string;
  entityId?: string;
  entityType?: string;
  entityFqn?: string;
  version?: number;
  canDelete?: boolean;
  isVersionSelected?: boolean;
  entityFieldThreads?: EntityFieldThreads[];
  entityFieldTasks?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  followHandler?: () => void;
  tagsHandler?: (selectedTags?: Array<EntityTags>) => void;
  versionHandler?: () => void;
  updateOwner?: (value: Table['owner']) => void;
  updateTier?: (value: string) => void;
  currentOwner?: Dashboard['owner'];
  removeTier?: () => void;
  onRestoreEntity?: () => void;
  isRecursiveDelete?: boolean;
  extraDropdownContent?: ItemType[];
  serviceType: string;
}

const EntityPageInfo = ({
  titleLinks,
  isFollowing,
  deleted = false,
  followHandler,
  followers,
  extraInfo,
  tier,
  tags,
  isTagEditable = false,
  tagsHandler,
  followersList = [],
  entityName,
  entityId,
  version,
  isVersionSelected,
  versionHandler,
  entityFieldThreads,
  onThreadLinkSelect,
  entityFqn,
  entityType,
  updateOwner,
  updateTier,
  canDelete,
  currentOwner,
  entityFieldTasks,
  removeTier,
  onRestoreEntity,
  isRecursiveDelete = false,
  extraDropdownContent,
  serviceType,
}: Props) => {
  const history = useHistory();
  const location = useLocation();
  const tagThread = entityFieldThreads?.[0];
  const tagTask = entityFieldTasks?.[0];
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isViewMore, setIsViewMore] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<TagOption>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);

  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawer] =
    useState<boolean>(false);

  const [activeAnnouncement, setActiveAnnouncement] = useState<Thread>();

  const isTourPage = useMemo(
    () => location.pathname.includes(ROUTES.TOUR),
    [location.pathname]
  );

  const handleRequestTags = () => {
    history.push(getRequestTagsPath(entityType as string, entityFqn as string));
  };
  const handleUpdateTags = () => {
    history.push(getUpdateTagsPath(entityType as string, entityFqn as string));
  };

  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const prevTags =
        tags?.filter((tag) =>
          selectedTags
            .map((selTag) => selTag.tagFQN)
            .includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags
            ?.map((prevTag) => prevTag.tagFQN)
            .includes(tag.tagFQN);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));
      tagsHandler?.([...prevTags, ...newTags]);
    }
    setIsEditable(false);
  };

  const getSelectedTags = useCallback(
    () =>
      sortTagsCaseInsensitive([
        ...tags.map((tag) => ({
          ...tag,
        })),
      ]),
    [tags]
  );

  const entityFollowers = useMemo(() => {
    const list = cloneDeep(followersList);

    return (
      <div
        className={classNames('tw-max-h-96 tw-overflow-y-auto', {
          'tw-flex tw-justify-center tw-items-center tw-py-2':
            list.length === 0,
        })}>
        {list.length > 0 ? (
          <div
            className={classNames('tw-grid tw-gap-3', {
              'tw-grid-cols-2': list.length > 1,
            })}>
            {list.slice(0, FOLLOWERS_VIEW_CAP).map((follower, index) => (
              <div className="tw-flex" key={index}>
                <ProfilePicture
                  displayName={follower?.displayName || follower?.name}
                  id={follower?.id || ''}
                  name={follower?.name || ''}
                  width="20"
                />
                <span className="tw-self-center tw-ml-2">
                  {follower?.displayName || follower?.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p>{t('message.entity-does-not-have-followers', { entityName })}</p>
        )}
        {list.length > FOLLOWERS_VIEW_CAP && (
          <p
            className="link-text tw-text-sm tw-py-2"
            onClick={() => setIsViewMore(true)}>
            {t('label.view-more')}
          </p>
        )}
      </div>
    );
  }, [followersList]);

  const fetchTags = async () => {
    setIsTagLoading(true);
    try {
      const tags = await fetchTagsAndGlossaryTerms();
      setTagList(tags);
    } catch (error) {
      setTagList([]);
    }
    setIsTagLoading(false);
  };

  const getThreadElements = () => {
    if (!isUndefined(entityFieldThreads)) {
      return !isUndefined(tagThread) ? (
        <Col>
          <Button
            className="p-0 flex-center"
            data-testid="tag-thread"
            size="small"
            type="text"
            onClick={() => onThreadLinkSelect?.(tagThread.entityLink)}>
            <Space align="center" className="w-full h-full" size={2}>
              <IconComments height={16} name="comments" width={16} />
              <span data-testid="tag-thread-count">{tagThread.count}</span>
            </Space>
          </Button>
        </Col>
      ) : (
        <Col>
          <Button
            className="p-0 flex-center"
            data-testid="start-tag-thread"
            icon={<IconCommentPlus height={16} name="comments" width={16} />}
            size="small"
            type="text"
            onClick={() =>
              onThreadLinkSelect?.(
                getEntityFeedLink(entityType, entityFqn, 'tags')
              )
            }
          />
        </Col>
      );
    } else {
      return null;
    }
  };

  const getRequestTagsElements = useCallback(() => {
    const hasTags = !isEmpty(tags);
    const text = hasTags
      ? t('label.update-request-tag-plural')
      : t('label.request-tag-plural');

    return onThreadLinkSelect &&
      TASK_ENTITIES.includes(entityType as EntityType) ? (
      <Col>
        <Button
          className="p-0 flex-center"
          data-testid="request-entity-tags"
          size="small"
          type="text"
          onClick={hasTags ? handleUpdateTags : handleRequestTags}>
          <Popover
            destroyTooltipOnHide
            content={text}
            overlayClassName="ant-popover-request-description"
            trigger="hover"
            zIndex={9999}>
            <IconRequest
              className="anticon"
              height={16}
              name="request-tags"
              width={16}
            />
          </Popover>
        </Button>
      </Col>
    ) : null;
  }, [tags]);

  const getTaskElement = useCallback(() => {
    return !isUndefined(tagTask) ? (
      <Col>
        <Button
          className="p-0 flex-center"
          data-testid="tag-task"
          size="small"
          type="text"
          onClick={() =>
            onThreadLinkSelect?.(tagTask.entityLink, ThreadType.Task)
          }>
          <Space align="center" className="w-full h-full" size={2}>
            <IconTaskColor height={16} name="comments" width={16} />
            <span data-testid="tag-task-count">{tagTask.count}</span>
          </Space>
        </Button>
      </Col>
    ) : null;
  }, [tagTask]);

  const fetchActiveAnnouncement = async () => {
    try {
      const announcements = await getActiveAnnouncement(
        getEntityFeedLink(entityType, entityFqn)
      );

      if (!isEmpty(announcements.data)) {
        setActiveAnnouncement(announcements.data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useAfterMount(() => {
    if (
      ANNOUNCEMENT_ENTITIES.includes(entityType as EntityType) &&
      !isTourPage
    ) {
      fetchActiveAnnouncement();
    }
  });

  return (
    <Space
      className="w-full"
      data-testid="entity-page-info"
      direction="vertical">
      <EntityHeader
        breadcrumb={titleLinks}
        entityData={{
          displayName: entityName,
          name: entityName,
          deleted,
        }}
        entityType={(entityType as EntityType) ?? EntityType.TABLE}
        extra={
          <Space align="center" id="version-and-follow-section">
            {!isUndefined(version) && (
              <VersionButton
                className="m-l-xs px-1.5"
                selected={Boolean(isVersionSelected)}
                version={toString(version)}
                onClick={versionHandler}
              />
            )}
            {!isUndefined(isFollowing) ? (
              <Dropdown.Button
                data-testid="entity-follow-button"
                icon={
                  <Typography.Text
                    className={classNames(
                      isFollowing ? 'text-white' : 'text-primary'
                    )}
                    data-testid="follower-value">
                    {followers}
                  </Typography.Text>
                }
                menu={{
                  items: [
                    {
                      key: 'followers',
                      label: entityFollowers,
                    },
                  ],
                }}
                trigger={['click']}
                type={isFollowing ? 'primary' : 'default'}
                onClick={() => {
                  !deleted && followHandler?.();
                }}>
                <Space
                  align="center"
                  className={classNames(
                    isFollowing ? 'text-white' : 'text-primary'
                  )}
                  data-testid="follow-button">
                  <StarOutlined className="text-xs" />
                  {isFollowing ? t('label.un-follow') : t('label.follow')}
                </Space>
              </Dropdown.Button>
            ) : null}

            {!isVersionSelected && (
              <ManageButton
                allowSoftDelete={!deleted}
                canDelete={canDelete}
                deleted={deleted}
                entityFQN={entityFqn}
                entityId={entityId}
                entityName={entityName}
                entityType={entityType}
                extraDropdownContent={extraDropdownContent}
                isRecursiveDelete={isRecursiveDelete}
                onAnnouncementClick={() => setIsAnnouncementDrawer(true)}
                onRestoreEntity={onRestoreEntity}
              />
            )}
          </Space>
        }
        icon={
          serviceType && (
            <img className="h-8" src={serviceTypeLogo(serviceType)} />
          )
        }
        serviceName={serviceType ?? ''}
      />

      <Space wrap className="justify-between w-full" size={16}>
        <Space direction="vertical">
          <Space wrap align="center" data-testid="extrainfo" size={4}>
            {extraInfo.map((info, index) => (
              <span
                className="tw-flex tw-items-center"
                data-testid={info.key || `info${index}`}
                key={index}>
                <EntitySummaryDetails
                  currentOwner={currentOwner}
                  data={info}
                  deleted={deleted}
                  removeTier={removeTier}
                  tier={tier}
                  updateOwner={updateOwner}
                  updateTier={updateTier}
                />
                {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
                  <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                    {t('label.pipe-symbol')}
                  </span>
                ) : null}
              </span>
            ))}
          </Space>
          <Row align="middle" data-testid="entity-tags" gutter={8}>
            {isTagEditable && !deleted && (
              <>
                <Col>
                  <Space
                    align="center"
                    className="w-full h-full"
                    data-testid="tags-wrapper"
                    size={8}
                    onClick={() => {
                      // Fetch tags and terms only once
                      if (tagList.length === 0) {
                        fetchTags();
                      }
                      setIsEditable(true);
                    }}>
                    <TagsContainer
                      showEditTagButton
                      className="w-min-20"
                      dropDownHorzPosRight={false}
                      editable={isEditable}
                      isLoading={isTagLoading}
                      selectedTags={getSelectedTags()}
                      showAddTagButton={getSelectedTags().length === 0}
                      size="small"
                      tagList={tagList}
                      onCancel={() => {
                        handleTagSelection();
                      }}
                      onSelectionChange={(tags) => {
                        handleTagSelection(tags);
                      }}
                    />
                  </Space>
                </Col>
                {getRequestTagsElements()}
                {getTaskElement()}
                {getThreadElements()}
              </>
            )}
          </Row>
        </Space>
        {activeAnnouncement && (
          <AnnouncementCard
            announcement={activeAnnouncement}
            onClick={() => setIsAnnouncementDrawer(true)}
          />
        )}
      </Space>
      <FollowersModal
        header={t('label.followers-of-entity-name', {
          entityName,
        })}
        list={followersList}
        visible={isViewMore}
        onCancel={() => setIsViewMore(false)}
      />
      {isAnnouncementDrawerOpen && (
        <AnnouncementDrawer
          entityFQN={entityFqn || ''}
          entityName={entityName || ''}
          entityType={entityType || ''}
          open={isAnnouncementDrawerOpen}
          onClose={() => setIsAnnouncementDrawer(false)}
        />
      )}
    </Space>
  );
};

export default EntityPageInfo;
