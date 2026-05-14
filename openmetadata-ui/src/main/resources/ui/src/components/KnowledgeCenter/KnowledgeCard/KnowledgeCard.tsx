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
import Icon from '@ant-design/icons';
import { Col, Divider, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ThumbsUpFilled } from '../../../assets/svg/thumbs-up-filled.svg';
import { ReactComponent as ThumbsUpOutline } from '../../../assets/svg/thumbs-up-outline.svg';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { EntityType } from '../../../enums/entity.enum';

import TagsViewer from '../../../components/Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../../components/Tag/TagsViewer/TagsViewer.interface';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconArticle } from '../../../assets/svg/ic-articles.svg';
import { ReactComponent as BookMarkIcon } from '../../../assets/svg/ic-bookmark.svg';
import { ReactComponent as BookMarkedIcon } from '../../../assets/svg/ic-bookmarked.svg';
import { ReactComponent as LinkIcon } from '../../../assets/svg/ic-link.svg';
import { ReactComponent as UpdatedAtIcon } from '../../../assets/svg/ic-updated.svg';
import Loader from '../../../components/common/Loader/Loader';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
import { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  KnowledgePage,
  PageType,
  QuickLink,
  RecentlyViewedQuickLinks,
  RecentViewedKnowledgePage,
} from '../../../interface/knowledge-center.interface';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { getFrontEndFormat } from '../../../utils/FeedUtils';
import { t } from '../../../utils/i18next/LocalUtil';
import {
  addToKnowledgeCenterRecentViewed,
  updateKnowledgeCenterRecentViewed,
} from '../../../utils/KnowledgePageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../QuickLinkFormModal/QuickLinkFormModal';

import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import './knowledge-card.less';

export interface KnowledgeCardProps {
  knowledgeItem: KnowledgePage;
  onUpdateVote?: (data: VotingDataProps, id: string) => Promise<void>;
  onFollow?: (id: string) => Promise<void>;
  onUnFollow?: (id: string) => Promise<void>;
  onDelete?: (id: string) => void;
  onRefreshTagsCategory?: (value: boolean) => void;
  readonly?: boolean;
}

const KnowledgeCard: FC<KnowledgeCardProps> = ({
  knowledgeItem,
  onUpdateVote,
  onFollow,
  onUnFollow,
  onDelete,
  onRefreshTagsCategory,
  readonly = false,
}) => {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';

  const [knowledgePage, setKnowledgePage] = useState(knowledgeItem);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const {
    name,
    displayName = '',
    owners = [],
    updatedAt,
    description = '',
    votes,
    updatedBy,
    followers = [],
  } = knowledgePage;

  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [isDelete, setIsDelete] = useState(false);
  const [votesLoading, setVotesLoading] = useState<{
    votedUp: boolean;
    votedDown: boolean;
  }>({
    votedUp: false,
    votedDown: false,
  });

  const [isBookmaking, setIsBookmaking] = useState(false);
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();
  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const fetchPermission = async (fqn: string) => {
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.KNOWLEDGE_PAGE as unknown as ResourceEntity,
        fqn
      );
      setPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const voteStatus = useMemo(() => {
    if (isUndefined(votes)) {
      return QueryVoteType.unVoted;
    }

    const upVoters = votes.upVoters || [];
    const downVoters = votes.downVoters || [];

    if (upVoters.some((user) => user.id === USERId)) {
      return QueryVoteType.votedUp;
    } else if (downVoters.some((user) => user.id === USERId)) {
      return QueryVoteType.votedDown;
    } else {
      return QueryVoteType.unVoted;
    }
  }, [votes, USERId]);

  const isVoteUp = voteStatus === QueryVoteType.votedUp;
  const isVoteDown = voteStatus === QueryVoteType.votedDown;
  const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
  const isFollowing = Boolean(followers?.some(({ id }) => id === USERId));
  const path = isQuickLink
    ? (knowledgePage.page as QuickLink).url
    : contextCenterClassBase.getArticlePath(knowledgePage.fullyQualifiedName);

  const handleVoteChange = async (type: QueryVoteType) => {
    let updatedVoteType;

    // current vote is same as selected vote, it means user is removing vote, else up/down voting
    if (voteStatus === type) {
      updatedVoteType = QueryVoteType.unVoted;
    } else {
      updatedVoteType = type;
    }

    setVotesLoading((prev) => ({
      ...prev,
      [type]: true,
    }));

    await onUpdateVote?.({ updatedVoteType }, knowledgePage.id);

    setVotesLoading((prev) => ({
      ...prev,
      [type]: false,
    }));
  };

  const handleBookmarkChange = useCallback(
    async (id: string) => {
      setIsBookmaking(true);
      if (isFollowing) {
        await onUnFollow?.(id);
      } else {
        await onFollow?.(id);
      }
      setIsBookmaking(false);
    },
    [isFollowing, onUnFollow, onFollow]
  );

  const handleQuickLinkUpdate = async (
    formData: QuickLinkFormModalFormData
  ) => {
    setKnowledgePage((prevKnowledgePage) => ({
      ...prevKnowledgePage,
      displayName: formData.displayName,
      description: formData.description,
      tags: formData.tags,
      page: {
        url: formData.url,
      },
      relatedEntities: formData?.relatedEntities,
    }));
    onRefreshTagsCategory?.(true);
  };

  const handleToggleDelete = () => {
    setKnowledgePage((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };
  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => {
      updateKnowledgeCenterRecentViewed(
        recentlyViewed.filter((page) => page.id !== knowledgePage?.id)
      );
      isSoftDelete ? handleToggleDelete() : onDelete?.(knowledgePage?.id);
      onRefreshTagsCategory?.(true);
    },
    [knowledgePage, onDelete, handleToggleDelete, onRefreshTagsCategory]
  );

  const quickLinkActions = useMemo(() => {
    const editPermission =
      permissions?.EditAll ||
      permissions?.EditDisplayName ||
      permissions?.EditDescription ||
      permissions?.EditTags;

    return (
      <>
        {editPermission && (
          <EditIcon
            data-testid="edit-quick-link-btn"
            height={16}
            style={{ verticalAlign: 'middle' }}
            width={16}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowAddLinkModal(true);
            }}
          />
        )}
        {permissions?.Delete && (
          <IconDelete
            data-testid="delete-quick-link-btn"
            height={14}
            style={{ verticalAlign: 'middle', color: DE_ACTIVE_COLOR }}
            width={14}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsDelete(true);
            }}
          />
        )}
      </>
    );
  }, [permissions]);

  const handleQuickLinkRecentView = useCallback(() => {
    if (isQuickLink) {
      addToKnowledgeCenterRecentViewed(
        knowledgePage as RecentViewedKnowledgePage
      );
    }
  }, [isQuickLink, knowledgePage]);

  useEffect(() => {
    setKnowledgePage(knowledgeItem);
    if (knowledgeItem.pageType === PageType.QUICK_LINK) {
      fetchPermission(knowledgeItem.fullyQualifiedName);
    }
  }, [knowledgeItem]);

  return (
    <Row
      className="knowledge-card p-box global-border-radius"
      data-testid={displayName || name}
      gutter={[12, 12]}>
      <Col data-testid="date-owner-col" span={24}>
        <Space size={12}>
          <div className="d-flex">
            <OwnerLabel hasPermission={false} owners={owners} />
          </div>
          <p className="d-flex">
            <UpdatedAtIcon className="self-center" height={16} width={16} />
            <span
              className="self-center m-l-xs text-grey-muted"
              data-testid="updated-at">
              {formatDate(updatedAt)}
            </span>
          </p>
        </Space>
      </Col>

      <Col data-testid="knowledge-title-description" span={24}>
        <Link
          className="no-underline w-full d-block"
          data-testid={isQuickLink ? 'knowledge-link' : 'knowledge-page-link'}
          target={isQuickLink ? '_blank' : '_self'}
          to={path}
          onClick={handleQuickLinkRecentView}>
          <Space className="tw:w-full" direction="vertical" size={8}>
            <div className="flex items-center gap-2">
              {isQuickLink ? (
                <LinkIcon
                  height={20}
                  style={{ verticalAlign: 'middle' }}
                  width={20}
                />
              ) : (
                <IconArticle
                  height={20}
                  style={{ verticalAlign: 'middle' }}
                  width={20}
                />
              )}
              <Typography.Text
                className="m-b-0 d-block entity-header-display-name text-lg font-semibold cursor-pointer knowledge-card-title text-primary"
                data-testid="entity-header-display-name"
                ellipsis={{ tooltip: true }}>
                {knowledgePage?.displayName || t('label.untitled')}
              </Typography.Text>
              {isQuickLink && !readonly && quickLinkActions}
            </div>

            {description.trim() ? (
              <RichTextEditorPreviewerV1
                showReadMoreBtn
                className="max-two-lines"
                markdown={getFrontEndFormat(description)}
              />
            ) : (
              <span className="text-grey-muted" data-testid="no-description">
                {t('label.no-description')}
              </span>
            )}
          </Space>
        </Link>
      </Col>
      {(knowledgePage.tags ?? []).length > 0 && (
        <Col data-testid="knowledge-tags" span={24}>
          <TagsViewer
            displayType={DisplayType.POPOVER}
            showNoDataPlaceholder={false}
            tags={knowledgePage.tags ?? []}
          />
        </Col>
      )}
      <Col data-testid="knowledge-metadata" span={24}>
        <Row gutter={[8, 8]}>
          {!readonly && (
            <Col>
              <Space data-testid="votes-section">
                <div
                  className="cursor-pointer"
                  data-testid="up-vote-btn"
                  onClick={() => handleVoteChange(QueryVoteType.votedUp)}>
                  <Space>
                    {votesLoading.votedUp ? (
                      <Loader size="x-small" />
                    ) : (
                      <Icon
                        className="text-grey-muted"
                        component={isVoteUp ? ThumbsUpFilled : ThumbsUpOutline}
                        style={{
                          fontSize: '16px',
                          color: isVoteUp ? '#008376' : '',
                        }}
                      />
                    )}

                    <span
                      className="text-grey-muted"
                      data-testid="up-vote-count">
                      {votes?.upVotes ?? 0}
                    </span>
                  </Space>
                </div>
                <div
                  className="cursor-pointer"
                  data-testid="down-vote-btn"
                  onClick={() => handleVoteChange(QueryVoteType.votedDown)}>
                  <Space>
                    {votesLoading.votedDown ? (
                      <Loader size="x-small" />
                    ) : (
                      <Icon
                        className="rotate-inverse text-grey-muted"
                        component={
                          isVoteDown ? ThumbsUpFilled : ThumbsUpOutline
                        }
                        style={{
                          fontSize: '16px',
                          color: isVoteDown ? '#E7B85D' : '',
                        }}
                      />
                    )}
                    <span
                      className="text-grey-muted"
                      data-testid="down-vote-count">
                      {votes?.downVotes ?? 0}
                    </span>
                  </Space>
                </div>
              </Space>
              <Divider className="self-center m-x-sm" type="vertical" />
            </Col>
          )}
          <Col>
            <Space className="updated-by-container text-grey-muted">
              <span>{`${t('label.last-edited-by')}:`}</span>
              <UserPopOverCard profileWidth={22} userName={updatedBy} />
            </Space>
            <Divider className="self-center m-x-sm" type="vertical" />
          </Col>
          <Col>
            <Space className="text-grey-muted">
              <span>{`${t('label.last-updated')}:`}</span>
              <span data-testid="updated-at-metadata">
                {formatDate(updatedAt)}
              </span>
            </Space>
          </Col>
          {!readonly && (
            <Col data-testid="bookmark-section">
              <Divider className="self-center m-x-sm" type="vertical" />
              {isBookmaking ? (
                <Loader size="x-small" style={{ marginTop: '4px' }} />
              ) : (
                <Icon
                  className="text-grey-muted cursor-pointer"
                  component={isFollowing ? BookMarkedIcon : BookMarkIcon}
                  data-isfollowing={isFollowing}
                  data-testid="bookmark-btn"
                  style={{ fontSize: '20px' }}
                  onClick={() => handleBookmarkChange(knowledgePage.id)}
                />
              )}
            </Col>
          )}
        </Row>
      </Col>
      {showAddLinkModal && (
        <QuickLinkFormModal
          isOpen={showAddLinkModal}
          permissions={permissions}
          quickLink={knowledgePage}
          onCancel={() => setShowAddLinkModal(false)}
          onSave={(data) => {
            handleQuickLinkUpdate(data);
            setShowAddLinkModal(false);
          }}
        />
      )}
      {isDelete && (
        <DeleteWidgetModal
          afterDeleteAction={afterDeleteAction}
          allowSoftDelete={false}
          entityId={knowledgePage.id}
          entityName={knowledgePage.displayName || t('label.untitled')}
          entityType={EntityType.KNOWLEDGE_CENTER}
          isRecursiveDelete={false}
          prepareType={false}
          successMessage={t('server.entity-deleted-successfully', {
            entity: t('label.quick-link'),
          })}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}
    </Row>
  );
};

export default KnowledgeCard;
