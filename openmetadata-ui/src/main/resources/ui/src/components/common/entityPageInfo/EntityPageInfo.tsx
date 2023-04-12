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

import { ExclamationCircleOutlined, StarFilled } from '@ant-design/icons';
import { Button, Popover, Space, Tooltip } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isUndefined, toString } from 'lodash';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getActiveAnnouncement } from 'rest/feedsAPI';
import { sortTagsCaseInsensitive } from 'utils/CommonUtils';
import { ReactComponent as IconCommentPlus } from '../../../assets/svg/add-chat.svg';
import { ReactComponent as IconComments } from '../../../assets/svg/comment.svg';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { ReactComponent as IconTaskColor } from '../../../assets/svg/Task-ic.svg';
import { FOLLOWERS_VIEW_CAP } from '../../../constants/constants';
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
import SVGIcons from '../../../utils/SvgUtils';
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
import TitleBreadcrumb from '../title-breadcrumb/title-breadcrumb.component';
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
}: Props) => {
  const history = useHistory();
  const tagThread = entityFieldThreads?.[0];
  const tagTask = entityFieldTasks?.[0];
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [entityFollowers, setEntityFollowers] =
    useState<Array<EntityReference>>(followersList);
  const [isViewMore, setIsViewMore] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<TagOption>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [versionFollowButtonWidth, setVersionFollowButtonWidth] = useState(
    document.getElementById('version-and-follow-section')?.offsetWidth
  );

  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawer] =
    useState<boolean>(false);

  const [activeAnnouncement, setActiveAnnouncement] = useState<Thread>();

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
      sortTagsCaseInsensitive(
        tier?.tagFQN
          ? [
              ...tags.map((tag) => ({
                ...tag,
              })),
              { tagFQN: tier.tagFQN },
            ]
          : [
              ...tags.map((tag) => ({
                ...tag,
              })),
            ]
      ),
    [tier, tags]
  );

  const getFollowers = () => {
    const list = cloneDeep(entityFollowers);

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
  };

  const getVersionButton = (version: string) => {
    return (
      <Button
        className={classNames(
          'tw-border tw-border-primary tw-rounded',
          !isUndefined(isVersionSelected) ? 'tw-text-white' : 'tw-text-primary'
        )}
        data-testid="version-button"
        size="small"
        type={!isUndefined(isVersionSelected) ? 'primary' : 'default'}
        onClick={versionHandler}>
        <Space>
          <span>
            <SVGIcons
              alt="version icon"
              icon={isVersionSelected ? 'icon-version-white' : 'icon-version'}
            />
            <span>{t('label.version-plural')}</span>
          </span>
          <span
            className={classNames(
              'tw-border-l tw-font-medium tw-cursor-pointer hover:tw-underline tw-pl-1',
              { 'tw-border-primary': isUndefined(isVersionSelected) }
            )}
            data-testid="version-value">
            {parseFloat(version).toFixed(1)}
          </span>
        </Space>
      </Button>
    );
  };

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
      ) : (
        <Button
          className="p-0 flex-center"
          data-testid="start-tag-thread"
          size="small"
          type="text"
          onClick={() =>
            onThreadLinkSelect?.(
              getEntityFeedLink(entityType, entityFqn, 'tags')
            )
          }>
          <IconCommentPlus height={16} name="comments" width={16} />
        </Button>
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
    ) : null;
  }, [tags]);

  const getTaskElement = useCallback(() => {
    return !isUndefined(tagTask) ? (
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

  useEffect(() => {
    setEntityFollowers(followersList);
  }, [followersList]);

  useAfterMount(() => {
    setVersionFollowButtonWidth(
      document.getElementById('version-and-follow-section')?.offsetWidth
    );
    if (ANNOUNCEMENT_ENTITIES.includes(entityType as EntityType)) {
      fetchActiveAnnouncement();
    }
  });

  return (
    <div data-testid="entity-page-info">
      <Space
        align="start"
        className="tw-justify-between"
        style={{ width: '100%' }}>
        <Space align="center">
          <TitleBreadcrumb
            titleLinks={titleLinks}
            widthDeductions={
              (versionFollowButtonWidth ? versionFollowButtonWidth : 0) + 30
            }
          />
          {deleted && (
            <div className="deleted-badge-button" data-testid="deleted-badge">
              <ExclamationCircleOutlined className="tw-mr-1" />
              {t('label.deleted')}
            </div>
          )}
        </Space>
        <Space align="center" id="version-and-follow-section">
          {!isUndefined(version) ? (
            <>
              {!isUndefined(isVersionSelected) ? (
                <Tooltip
                  placement="bottom"
                  title={
                    <p className="tw-text-xs">
                      {t('message.viewing-older-version')}
                    </p>
                  }
                  trigger="hover">
                  {getVersionButton(toString(version))}
                </Tooltip>
              ) : (
                <>{getVersionButton(toString(version))}</>
              )}
            </>
          ) : null}
          {!isUndefined(isFollowing) ? (
            <Button
              className={classNames(
                'tw-border tw-border-primary tw-rounded',
                isFollowing ? 'tw-text-white' : 'tw-text-primary'
              )}
              data-testid="follow-button"
              size="small"
              type={isFollowing ? 'primary' : 'default'}
              onClick={() => {
                !deleted && followHandler?.();
              }}>
              <Space>
                <StarFilled className="tw-text-xs" />
                {isFollowing ? t('label.un-follow') : t('label.follow')}
                <Popover content={getFollowers()} trigger="click">
                  <span
                    className={classNames(
                      'tw-border-l tw-font-medium tw-cursor-pointer hover:tw-underline tw-pl-1',
                      { 'tw-border-primary': !isFollowing }
                    )}
                    data-testid="follower-value"
                    onClick={(e) => e.stopPropagation()}>
                    {followers}
                  </span>
                </Popover>
              </Space>
            </Button>
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
      </Space>

      <Space wrap className="tw-justify-between" style={{ width: '100%' }}>
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
          <Space wrap align="center" data-testid="entity-tags" size={6}>
            {isTagEditable && !deleted && (
              <Fragment>
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
                <>
                  {getRequestTagsElements()}
                  {getTaskElement()}
                  {getThreadElements()}
                </>
              </Fragment>
            )}
          </Space>
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
        list={entityFollowers}
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
    </div>
  );
};

export default EntityPageInfo;
