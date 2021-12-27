/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { EntityTags, ExtraInfo, TableDetail } from 'Models';
import React, { useEffect, useState } from 'react';
import { FOLLOWERS_VIEW_CAP, LIST_SIZE } from '../../../constants/constants';
import { User } from '../../../generated/entity/teams/user';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getHtmlForNonAdminAction } from '../../../utils/CommonUtils';
import { getInfoElements } from '../../../utils/EntityUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { getFollowerDetail } from '../../../utils/TableUtils';
import TagsContainer from '../../tags-container/tags-container';
import Tags from '../../tags/tags';
import Avatar from '../avatar/Avatar';
import NonAdminAction from '../non-admin-action/NonAdminAction';
import PopOver from '../popover/PopOver';
import TitleBreadcrumb from '../title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../title-breadcrumb/title-breadcrumb.interface';
import FollowersModal from './FollowersModal';

type Props = {
  titleLinks: TitleBreadcrumbProps['titleLinks'];
  isFollowing?: boolean;
  followers?: number;
  extraInfo: Array<ExtraInfo>;
  tier: TagLabel;
  tags: Array<EntityTags>;
  isTagEditable?: boolean;
  tagList?: Array<string>;
  owner?: TableDetail['owner'];
  hasEditAccess?: boolean;
  followersList: Array<User>;
  entityName: string;
  version?: string;
  isVersionSelected?: boolean;
  followHandler?: () => void;
  tagsHandler?: (selectedTags?: Array<string>) => void;
  versionHandler?: () => void;
};

const EntityPageInfo = ({
  titleLinks,
  isFollowing,
  followHandler,
  followers,
  extraInfo,
  tier,
  tags,
  isTagEditable = false,
  tagList = [],
  owner,
  hasEditAccess,
  tagsHandler,
  followersList = [],
  entityName,
  version,
  isVersionSelected,
  versionHandler,
}: Props) => {
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [entityFollowers, setEntityFollowers] =
    useState<Array<User>>(followersList);
  const [isViewMore, setIsViewMore] = useState<boolean>(false);
  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    tagsHandler?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsEditable(false);
  };

  const getSelectedTags = () => {
    return tier?.tagFQN
      ? [
          ...tags.map((tag) => ({
            tagFQN: tag.tagFQN,
            isRemovable: true,
          })),
          { tagFQN: tier.tagFQN, isRemovable: false },
        ]
      : [
          ...tags.map((tag) => ({
            tagFQN: tag.tagFQN,
            isRemovable: true,
          })),
        ];
  };

  const getFollowers = () => {
    const list = entityFollowers
      .map((follower) => getFollowerDetail(follower.id))
      .filter(Boolean);

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
                <Avatar
                  name={(follower?.displayName || follower?.name) as string}
                  width="30"
                />
                <span className="tw-self-center tw-ml-2">
                  {follower?.displayName || follower?.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p>{entityName} doesn&#39;t have any followers yet</p>
        )}
        {list.length > FOLLOWERS_VIEW_CAP && (
          <p
            className="link-text tw-text-sm tw-py-2"
            onClick={() => setIsViewMore(true)}>
            View more
          </p>
        )}
      </div>
    );
  };

  const getVersionButton = (version: string) => {
    return (
      <div className="tw-flex tw-h-6 tw-ml-2 tw-mt-2" onClick={versionHandler}>
        <span
          className={classNames(
            'tw-flex tw-border tw-border-primary tw-rounded',
            !isUndefined(isVersionSelected)
              ? 'tw-bg-primary tw-text-white'
              : 'tw-text-primary'
          )}>
          <button
            className={classNames(
              'tw-text-xs tw-border-r tw-font-medium tw-py-1 tw-px-2 tw-rounded-l focus:tw-outline-none',
              !isUndefined(isVersionSelected)
                ? 'tw-border-white'
                : 'tw-border-primary'
            )}
            data-testid="version-button">
            <SVGIcons
              alt="version icon"
              icon={isVersionSelected ? 'icon-version-white' : 'icon-version'}
            />{' '}
            Versions
          </button>

          <span
            className="tw-text-xs tw-border-l-0 tw-font-medium tw-py-1 tw-px-2 tw-rounded-r tw-cursor-pointer"
            data-testid="getversions">
            {parseFloat(version).toFixed(1)}
          </span>
        </span>
      </div>
    );
  };

  useEffect(() => {
    setEntityFollowers(followersList);
  }, [followersList]);

  return (
    <div>
      <div className="tw-flex tw-flex-col">
        <div className="tw-flex tw-flex-initial tw-justify-between tw-items-center">
          <TitleBreadcrumb titleLinks={titleLinks} />
          <div className="tw-flex">
            {!isUndefined(version) ? (
              <>
                {!isUndefined(isVersionSelected) ? (
                  <PopOver
                    html={
                      <p className="tw-text-xs">
                        Viewing older version <br />
                        Go to latest to update details
                      </p>
                    }
                    position="top"
                    trigger="mouseenter">
                    {getVersionButton(version)}
                  </PopOver>
                ) : (
                  <>{getVersionButton(version as string)}</>
                )}
              </>
            ) : null}
            {!isUndefined(isFollowing) ? (
              <div className="tw-flex tw-h-6 tw-ml-2 tw-mt-2">
                <span
                  className={classNames(
                    'tw-flex tw-border tw-border-primary tw-rounded',
                    isFollowing
                      ? 'tw-bg-primary tw-text-white'
                      : 'tw-text-primary'
                  )}>
                  <button
                    className={classNames(
                      'tw-text-xs tw-border-r tw-font-medium tw-py-1 tw-px-2 tw-rounded-l focus:tw-outline-none',
                      isFollowing ? 'tw-border-white' : 'tw-border-primary'
                    )}
                    data-testid="follow-button"
                    onClick={followHandler}>
                    {isFollowing ? (
                      <>
                        <i className="fas fa-star" /> Unfollow
                      </>
                    ) : (
                      <>
                        <i className="far fa-star" /> Follow
                      </>
                    )}
                  </button>
                  <PopOver
                    className="tw-justify-center tw-items-center"
                    html={getFollowers()}
                    position="bottom"
                    theme="light"
                    trigger="click">
                    <span
                      className="tw-text-xs tw-border-l-0 tw-font-medium tw-py-1 tw-px-2 tw-rounded-r tw-cursor-pointer hover:tw-underline"
                      data-testid="getFollowerDetail">
                      {followers}
                    </span>
                  </PopOver>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-ml-7 tw-flex-wrap">
        {extraInfo.map((info, index) => (
          <span className="tw-flex" key={index}>
            {getInfoElements(info)}
            {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
              <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                |
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="tw-flex tw-flex-wrap tw-pt-1 tw-ml-7 tw-group">
        {(!isEditable || !isTagEditable) && (
          <>
            {(tags.length > 0 || !isEmpty(tier)) && (
              <SVGIcons
                alt="icon-tag"
                className="tw-mx-1"
                icon="icon-tag-grey"
                width="16"
              />
            )}
            {tier?.tagFQN && (
              <Tags
                startWith="#"
                tag={{ ...tier, tagFQN: tier.tagFQN.split('.')[1] }}
                type="label"
              />
            )}
            {tags.length > 0 && (
              <>
                {tags.slice(0, LIST_SIZE).map((tag, index) => (
                  <Tags
                    className={classNames(
                      { 'diff-added tw-mx-1': tag?.added },
                      { 'diff-removed': tag?.removed }
                    )}
                    key={index}
                    startWith="#"
                    tag={tag}
                    type="label"
                  />
                ))}

                {tags.slice(LIST_SIZE).length > 0 && (
                  <PopOver
                    html={
                      <>
                        {tags.slice(LIST_SIZE).map((tag, index) => (
                          <p className="tw-text-left" key={index}>
                            <Tags
                              className={classNames(
                                { 'diff-added tw-mx-1': tag?.added },
                                { 'diff-removed': tag?.removed }
                              )}
                              startWith="#"
                              tag={tag}
                              type="label"
                            />
                          </p>
                        ))}
                      </>
                    }
                    position="bottom"
                    theme="light"
                    trigger="click">
                    <span className="tw-cursor-pointer tw-text-xs link-text v-align-sub tw--ml-1">
                      •••
                    </span>
                  </PopOver>
                )}
              </>
            )}
          </>
        )}
        {isTagEditable && (
          <NonAdminAction
            html={getHtmlForNonAdminAction(Boolean(owner))}
            isOwner={hasEditAccess}
            position="bottom"
            trigger="click">
            <div
              className="tw-inline-block"
              onClick={() => setIsEditable(true)}>
              <TagsContainer
                editable={isEditable}
                selectedTags={getSelectedTags()}
                showTags={!isTagEditable}
                tagList={tagList}
                onCancel={() => {
                  handleTagSelection();
                }}
                onSelectionChange={(tags) => {
                  handleTagSelection(tags);
                }}>
                {tags.length || tier ? (
                  <button className=" tw-ml-1 focus:tw-outline-none">
                    <SVGIcons
                      alt="edit"
                      icon="icon-edit"
                      title="Edit"
                      width="12px"
                    />
                  </button>
                ) : (
                  <span>
                    <Tags
                      className="tw-text-primary"
                      startWith="+ "
                      tag="Add tag"
                      type="label"
                    />
                  </span>
                )}
              </TagsContainer>
            </div>
          </NonAdminAction>
        )}
      </div>
      {isViewMore && (
        <FollowersModal
          header={
            <>
              Followers of <span className="tw-text-black">{entityName}</span>{' '}
            </>
          }
          list={[
            ...entityFollowers
              .map((follower) => getFollowerDetail(follower.id))
              .filter(Boolean)
              .map((user) => ({
                displayName: user?.displayName as string,
                name: user?.name as string,
                id: user?.id as string,
              })),
          ]}
          onCancel={() => setIsViewMore(false)}
        />
      )}
    </div>
  );
};

export default EntityPageInfo;
