import classNames from 'classnames';
import { ColumnTags } from 'Models';
import React, { useState } from 'react';
import { LIST_SIZE } from '../../../constants/constants';
import SVGIcons from '../../../utils/SvgUtils';
import TagsContainer from '../../tags-container/tags-container';
import Tags from '../../tags/tags';
import PopOver from '../popover/PopOver';
import TitleBreadcrumb from '../title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../title-breadcrumb/title-breadcrumb.interface';

type ExtraInfo = {
  key: string;
  value: string;
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
  tagsHandler?: (selectedTags?: Array<string>) => void;
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
  tagsHandler,
}: Props) => {
  const [isEditable, setIsEditable] = useState<boolean>(false);

  const handleTagSelection = (selectedTags?: Array<ColumnTags>) => {
    tagsHandler?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsEditable(false);
  };

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
              <span className="tw-text-xs tw-border-l-0 tw-font-normal tw-py-1 tw-px-2 tw-rounded-r">
                {followers}
              </span>
            </span>
          </div>
        </div>
      </div>
      <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1">
        {extraInfo.map((info, index) => (
          <span key={index}>
            <span className="tw-text-grey-muted tw-font-normal">
              {info.key} :
            </span>{' '}
            <span className="tw-pl-1tw-font-normal ">{info.value || '--'}</span>
            {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
              <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                •
              </span>
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
          <div onClick={() => setIsEditable(true)}>
            <TagsContainer
              editable={isEditable}
              selectedTags={[
                ...tags.map((tag) => ({
                  tagFQN: tag.tagFQN,
                  isRemovable: true,
                })),
                { tagFQN: tier, isRemovable: false },
              ]}
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
        )}
      </div>
    </div>
  );
};

export default EntityPageInfo;
