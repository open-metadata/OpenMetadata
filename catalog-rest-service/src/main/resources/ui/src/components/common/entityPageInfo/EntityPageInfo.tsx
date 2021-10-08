import classNames from 'classnames';
import { isNil } from 'lodash';
import { ColumnTags, TableDetail } from 'Models';
import React, { useEffect, useState } from 'react';
import { FOLLOWERS_VIEW_CAP, LIST_SIZE } from '../../../constants/constants';
import { User } from '../../../generated/entity/teams/user';
import { getHtmlForNonAdminAction } from '../../../utils/CommonUtils';
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

type ExtraInfo = {
  key?: string;
  value: string | number;
  isLink?: boolean;
  placeholderText?: string;
  openInNewTab?: boolean;
};

type Props = {
  titleLinks: TitleBreadcrumbProps['titleLinks'];
  isFollowing: boolean;
  followHandler: () => void;
  followers: number;
  extraInfo: Array<ExtraInfo>;
  tier: string;
  tags: Array<ColumnTags>;
  isTagEditable?: boolean;
  tagList?: Array<string>;
  owner?: TableDetail['owner'];
  hasEditAccess?: boolean;
  tagsHandler?: (selectedTags?: Array<string>) => void;
  followersList: Array<User>;
  entityName: string;
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
}: Props) => {
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [entityFollowers, setEntityFollowers] =
    useState<Array<User>>(followersList);
  const [isViewMore, setIsViewMore] = useState<boolean>(false);
  const handleTagSelection = (selectedTags?: Array<ColumnTags>) => {
    tagsHandler?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsEditable(false);
  };

  const getSelectedTags = () => {
    return tier
      ? [
          ...tags.map((tag) => ({
            tagFQN: tag.tagFQN,
            isRemovable: true,
          })),
          { tagFQN: tier, isRemovable: false },
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
          <p>{entityName} dosen&#39;t have any followers yet</p>
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

  useEffect(() => {
    setEntityFollowers(followersList);
  }, [followersList]);

  return (
    <div>
      <div className="tw-flex tw-flex-col">
        <div className="tw-flex tw-flex-initial tw-justify-between tw-items-center">
          <TitleBreadcrumb titleLinks={titleLinks} />
          <div className="tw-flex tw-h-6 tw-ml-2 tw-mt-2">
            <span
              className={classNames(
                'tw-flex tw-border tw-border-primary tw-rounded',
                isFollowing ? 'tw-bg-primary tw-text-white' : 'tw-text-primary'
              )}>
              <button
                className={classNames(
                  'tw-text-xs tw-border-r tw-font-normal tw-py-1 tw-px-2 tw-rounded-l focus:tw-outline-none',
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
                <span className="tw-text-xs tw-border-l-0 tw-font-normal tw-py-1 tw-px-2 tw-rounded-r tw-cursor-pointer hover:tw-underline">
                  {followers}
                </span>
              </PopOver>
            </span>
          </div>
        </div>
      </div>
      <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1">
        {extraInfo.map((info, index) => (
          <span key={index}>
            {!isNil(info.key) ? (
              <>
                <span className="tw-text-grey-muted tw-font-normal">
                  {info.key} :
                </span>{' '}
                <span className="tw-pl-1 tw-font-normal">
                  {info.isLink ? (
                    <a
                      className="link-text"
                      href={info.value as string}
                      rel="noopener noreferrer"
                      target={info.openInNewTab ? '_blank' : '_self'}>
                      <>
                        <span className="tw-mr-1">
                          {info.placeholderText || info.value}
                        </span>
                        {info.openInNewTab && (
                          <SVGIcons
                            alt="external-link"
                            className="tw-align-middle"
                            icon="external-link"
                            width="12px"
                          />
                        )}
                      </>
                    </a>
                  ) : (
                    info.value || '--'
                  )}
                </span>
                {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
                  <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                    •
                  </span>
                ) : null}
              </>
            ) : !isNil(info.value) ? (
              <>
                <span className="tw-font-normal">{info.value}</span>
                {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
                  <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                    •
                  </span>
                ) : null}
              </>
            ) : null}
          </span>
        ))}
      </div>
      <div className="tw-flex tw-flex-wrap tw-pt-1 tw-group">
        {(!isEditable || !isTagEditable) && (
          <>
            {(tags.length > 0 || tier) && (
              <i className="fas fa-tags tw-px-1 tw-mt-2 tw-text-grey-muted" />
            )}
            {tier && (
              <Tags className="tw-bg-tag" tag={`#${tier.split('.')[1]}`} />
            )}
            {tags.length > 0 && (
              <>
                {tags.slice(0, LIST_SIZE).map((tag, index) => (
                  <Tags
                    className="tw-bg-tag"
                    key={index}
                    tag={`#${tag.tagFQN}`}
                  />
                ))}

                {tags.slice(LIST_SIZE).length > 0 && (
                  <PopOver
                    html={
                      <>
                        {tags.slice(LIST_SIZE).map((tag, index) => (
                          <Tags
                            className="tw-bg-tag tw-px-2"
                            key={index}
                            tag={`#${tag.tagFQN}`}
                          />
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
                  <span className="">
                    <Tags
                      className="tw-border-main tw-text-primary"
                      tag="+ Add tag"
                      type="outlined"
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
