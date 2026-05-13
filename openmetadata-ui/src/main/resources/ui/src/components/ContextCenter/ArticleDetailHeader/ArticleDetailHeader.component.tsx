/*
 *  Copyright 2026 Collate.
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

import {
  Badge,
  Button,
  ButtonUtility,
  Card,
  Dot,
  Skeleton,
  Tabs,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  DotsVertical,
  File06,
  Globe01,
  Home02,
  MessageChatSquare,
  Share07,
  ThumbsDown,
  ThumbsUp,
  UploadCloud01,
  User03,
} from '@untitledui/icons';
import { isEmpty, isUndefined, toString, uniqBy } from 'lodash';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as EditorIcon } from '../../../assets/svg/ic-editor.svg';
import { ReactComponent as SidebarCollapsible } from '../../../assets/svg/ic-sidebar-collapsible.svg';
import { ReactComponent as StarFilledIcon } from '../../../assets/svg/ic-star-filled.svg';
import { ReactComponent as StarIcon } from '../../../assets/svg/ic-star.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { DeleteType } from '../../../components/common/DeleteWidget/DeleteWidget.interface';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import Loader from '../../../components/common/Loader/Loader';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import TabsLabel from '../../../components/common/TabsLabel/TabsLabel.component';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
import { EntityStatusBadge } from '../../../components/Entity/EntityStatusBadge/EntityStatusBadge.component';
import { ROUTES } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { EntityStatus } from '../../../generated/governance/workflows/elements/nodes/automatedTask/setGlossaryTermStatusTask';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useFqn } from '../../../hooks/useFqn';
import {
  ContentChangeState,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import deleteWidgetClassBase from '../../../utils/DeleteWidget/DeleteWidgetClassBase';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getContextCenterArticleVersionsPath,
  updateKnowledgeCenterRecentViewed,
} from '../../../utils/KnowledgePageUtils';
import { ArticleDetailHeaderProps } from './ArticleDetailHeader.interface';

const ArticleDetailHeader: FC<ArticleDetailHeaderProps> = ({
  knowledgePage,
  contentChangeState,
  permissions,
  tabs,
  activeTab,
  isRightPanelOpen,
  feedCount,
  onTabChange,
  onToggleRightPanel,
  onVoteChange,
  onFollowChange,
  onToggleDelete,
  onSave,
  onSetThreadLink,
  fetchKnowledgePageHierarchy,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const [copyTooltip, setCopyTooltip] = useState<string>('');
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState<QueryVoteType | null>(null);
  const { onCopyToClipBoard } = useClipboard(window.location.href);
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();
  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const breadcrumbs = useMemo(
    () => [
      {
        name: '',
        icon: <Home02 size={14} />,
        url: '/',
        activeTitle: true,
      },
      { name: t('label.context-center'), url: ROUTES.CONTEXT_CENTER },
      {
        name: t('label.article-plural'),
        url: ROUTES.CONTEXT_CENTER_ARTICLES,
      },
      {
        activeTitle: true,
        name: getEntityName(knowledgePage) || t('label.untitled'),
        url: '',
      },
    ],
    [knowledgePage?.displayName, t]
  );

  const voteStatus = useMemo(() => {
    if (isUndefined(knowledgePage?.votes)) {
      return QueryVoteType.unVoted;
    }
    const upVoters = knowledgePage?.votes.upVoters ?? [];
    const downVoters = knowledgePage?.votes.downVoters ?? [];
    if (upVoters.some((u) => u.id === USERId)) {
      return QueryVoteType.votedUp;
    }
    if (downVoters.some((u) => u.id === USERId)) {
      return QueryVoteType.votedDown;
    }

    return QueryVoteType.unVoted;
  }, [knowledgePage, USERId]);

  const version = toString(knowledgePage?.version ?? '0.1');

  const isFollowing = useMemo(
    () => Boolean(knowledgePage?.followers?.some(({ id }) => id === USERId)),
    [knowledgePage?.followers, USERId]
  );

  const editors = useMemo(() => {
    const list = uniqBy(
      [...(knowledgePage?.editors ?? []), { name: knowledgePage?.updatedBy }],
      'name'
    );

    return list.slice(0, 5);
  }, [knowledgePage]);

  const domains = knowledgePage?.domains ?? [];
  const owners = knowledgePage?.owners ?? [];
  const firstDomain = domains[0];
  const extraDomains = domains.slice(1);

  const entityName = getEntityName(knowledgePage);
  const entityType = t('label.article');

  const deleteOptions = [
    {
      description: deleteWidgetClassBase.getDeleteMessage(
        entityName,
        entityType
      ),
      isAllowed: true,
      title: `${t('label.permanently-delete')} ${entityType} "${entityName}"`,
      type: DeleteType.HARD_DELETE,
    },
  ];

  const afterDeleteAction = async (isSoftDelete?: boolean) => {
    updateKnowledgeCenterRecentViewed(
      recentlyViewed.filter((page) => page.id !== knowledgePage?.id)
    );
    await fetchKnowledgePageHierarchy?.(true);
    if (isSoftDelete) {
      onToggleDelete();
    } else {
      navigate(ROUTES.CONTEXT_CENTER_ARTICLES);
    }
  };

  const handleVersionClick = () => {
    navigate(getContextCenterArticleVersionsPath(fqn, version));
  };

  const handleShare = async () => {
    await onCopyToClipBoard();
    setCopyTooltip(t('message.copy-to-clipboard'));
    setTimeout(() => setCopyTooltip(''), 2000);
  };

  const handleFollowClick = async () => {
    setIsFollowLoading(true);
    await onFollowChange();
    setIsFollowLoading(false);
  };

  const handleVoteChange = async (type: QueryVoteType) => {
    const updatedVoteType = voteStatus === type ? QueryVoteType.unVoted : type;
    setVoteLoading(type);
    await onVoteChange({ updatedVoteType });
    setVoteLoading(null);
  };

  const handleOpenConversation = () => {
    onSetThreadLink(
      EntityLink.getEntityLink(
        EntityType.KNOWLEDGE_PAGE,
        knowledgePage?.fullyQualifiedName ?? '',
        EntityField.DESCRIPTION
      )
    );
  };

  const entityStatusBadge = useMemo(() => {
    const shouldShowStatus = true;
    const entityStatus = knowledgePage?.entityStatus;

    if (
      !shouldShowStatus ||
      !entityStatus ||
      entityStatus === EntityStatus.Unprocessed
    ) {
      return null;
    }

    return <EntityStatusBadge showDivider={false} status={entityStatus} />;
  }, [knowledgePage?.entityStatus]);

  const contentChangeIcon = useMemo(() => {
    if (contentChangeState === ContentChangeState.SAVED) {
      return (
        <div data-testid="content-change-state">
          <Badge
            className="tw:flex tw:items-center tw:gap-2 tw:ring-0"
            color="success"
            size="lg"
            type="color">
            <UploadCloud01 size={16} />{' '}
            <Typography weight="medium">{t('label.saved')}</Typography>
          </Badge>
        </div>
      );
    } else if (contentChangeState === ContentChangeState.SAVING) {
      return <Loader size="x-small" />;
    } else if (contentChangeState === ContentChangeState.UN_SAVED) {
      return (
        <div data-testid="content-change-state">
          <Badge
            className="tw:flex tw:items-center tw:gap-2 tw:ring-0"
            color="gray"
            size="lg"
            type="color">
            <UploadCloud01 size={16} />{' '}
            <Typography weight="medium">{t('label.unsaved')}</Typography>
          </Badge>
        </div>
      );
    } else {
      return null;
    }
  }, [contentChangeState]);

  const showSaveButton =
    Boolean(onSave) &&
    contentChangeState === ContentChangeState.UN_SAVED &&
    (permissions.EditAll ||
      permissions.EditDescription ||
      permissions.EditDisplayName);

  if (!knowledgePage && !tabs) {
    return (
      <div
        className="tw:flex tw:flex-col tw:gap-3 tw:px-6 tw:py-4"
        data-testid="article-detail-header-skeleton">
        <Skeleton height={20} variant="rounded" width={300} />
        <Card className="tw:mb-0">
          <div className="tw:flex tw:items-center tw:justify-between tw:mb-3">
            <Skeleton height={28} variant="rounded" width={250} />
            <div className="tw:flex tw:items-center tw:gap-2">
              <Skeleton height={32} variant="rounded" width={80} />
              <Skeleton height={32} variant="rounded" width={32} />
              <Skeleton height={32} variant="rounded" width={32} />
            </div>
          </div>
          <Skeleton height={16} variant="rounded" width={180} />
        </Card>
      </div>
    );
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3 tw:mb-5"
      data-testid="article-detail-header">
      <TitleBreadcrumb useCustomArrow titleLinks={breadcrumbs} />

      <Card className="tw:mb-0 tw:p-6 tw:pb-0 tw:pr-3">
        {/* Row 1: title + meta + actions */}
        <div className="tw:flex tw:items-center tw:justify-between tw:mb-6">
          <div className="tw:flex tw:gap-4 tw:items-stretch tw:w-full tw:max-w-[60%] tw:pr-3">
            <div className="h:full tw:w-auto tw:shrink-0 tw:bg-gray-100 tw:rounded-xl tw:flex tw:items-center tw:p-2">
              <File06
                className="tw:text-gray-500"
                height={40}
                style={{ verticalAlign: 'middle', flexShrink: 0 }}
                width={40}
              />
            </div>

            <div className="tw:flex tw:flex-col tw:gap-2 tw:min-w-0">
              {/* Article name with icon */}
              <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap">
                <Typography ellipsis as="h3" className="tw:truncate">
                  {getEntityName(knowledgePage) || t('label.untitled')}
                </Typography>
                {entityStatusBadge}
              </div>

              {/* Domain · Owner row */}
              <div className="tw:flex tw:items-center tw:gap-3 tw:flex-wrap tw:text-sm">
                {/* Domain */}
                <div className="tw:flex tw:items-center tw:gap-1.5">
                  <Globe01
                    className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-fg-disabled"
                    size={16}
                  />
                  <Typography
                    className={
                      firstDomain ? 'tw:text-primary-900' : 'tw:text-gray-400'
                    }
                    size="text-sm"
                    weight="regular">
                    {firstDomain
                      ? firstDomain.displayName ?? firstDomain.name
                      : t('label.no-entity', { entity: t('label.domain') })}
                  </Typography>
                  {extraDomains.length > 0 && (
                    <span className="tw:inline-flex tw:items-center tw:rounded-full tw:bg-gray-100 tw:px-1.5 tw:py-0.5 tw:text-xs tw:font-medium tw:text-gray-600">
                      +{extraDomains.length}
                    </span>
                  )}
                </div>

                {/* Dot separator */}
                <Dot className="tw:text-gray-400" size="xs" />

                {/* Owners */}
                <div className="tw:flex tw:items-center tw:gap-1.5">
                  <User03
                    className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-fg-disabled"
                    size={16}
                  />
                  {owners.length > 0 ? (
                    <div className="tw:flex tw:items-center tw:gap-1">
                      {owners.slice(0, 2).map((owner) => (
                        <UserPopOverCard
                          className="tw:m-0"
                          key={owner.id}
                          profileWidth={20}
                          userName={owner.name ?? ''}
                        />
                      ))}
                      {owners.length > 2 && (
                        <Typography
                          className="tw:inline-flex tw:items-center tw:rounded-full tw:bg-gray-100 tw:px-1.5 tw:py-0.5 tw:text-gray-600"
                          size="text-xs"
                          weight="medium">
                          +{owners.length - 2}
                        </Typography>
                      )}
                    </div>
                  ) : (
                    <Typography
                      className="tw:text-gray-400"
                      size="text-sm"
                      weight="regular">
                      {t('label.no-entity', { entity: t('label.owner') })}
                    </Typography>
                  )}
                </div>

                {/* Editors */}
                {editors.length > 0 && (
                  <>
                    <Dot className="tw:text-gray-400" size="xs" />
                    <div className="tw:flex tw:items-center tw:gap-1.5">
                      <EditorIcon
                        className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-fg-disabled"
                        height={16}
                        width={16}
                      />
                      <div className="tw:flex tw:items-center tw:gap-0.5">
                        {editors.map((user) => (
                          <UserPopOverCard
                            key={user.name}
                            profileWidth={20}
                            userName={user.name ?? ''}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="tw:flex tw:items-center tw:gap-3 tw:shrink-0">
            {contentChangeIcon}

            {showSaveButton && (
              <Button color="primary" size="sm" onClick={onSave}>
                {t('label.save')}
              </Button>
            )}

            <Tooltip title={t('label.version-plural')}>
              <TooltipTrigger>
                <Button
                  className="tw:p-1.5"
                  color="secondary"
                  data-testid="version-btn"
                  iconLeading={<VersionIcon height={16} width={16} />}
                  size="sm"
                  onClick={handleVersionClick}>
                  {version}
                </Button>
              </TooltipTrigger>
            </Tooltip>

            {/* Up vote */}
            <Tooltip title={t('label.up-vote')}>
              <TooltipTrigger>
                <ButtonUtility
                  className={
                    voteStatus === QueryVoteType.votedUp
                      ? 'tw:text-brand-600'
                      : undefined
                  }
                  color="secondary"
                  data-testid="upvote-btn"
                  disabled={knowledgePage?.deleted || voteLoading !== null}
                  icon={
                    <ThumbsUp
                      className={
                        voteStatus === QueryVoteType.votedUp
                          ? 'tw:fill-blue-500 tw:stroke-white'
                          : 'tw:fill-none'
                      }
                      height={18}
                      width={18}
                    />
                  }
                  onClick={() => handleVoteChange(QueryVoteType.votedUp)}
                />
              </TooltipTrigger>
            </Tooltip>

            {/* Down vote */}
            <Tooltip title={t('label.down-vote')}>
              <TooltipTrigger>
                <ButtonUtility
                  className={
                    voteStatus === QueryVoteType.votedDown
                      ? 'tw:text-brand-600'
                      : undefined
                  }
                  color="secondary"
                  data-testid="downvote-btn"
                  disabled={knowledgePage?.deleted || voteLoading !== null}
                  icon={
                    <ThumbsDown
                      className={
                        voteStatus === QueryVoteType.votedDown
                          ? 'tw:fill-blue-500 tw:stroke-white'
                          : 'tw:fill-none'
                      }
                      height={18}
                      width={18}
                    />
                  }
                  onClick={() => handleVoteChange(QueryVoteType.votedDown)}
                />
              </TooltipTrigger>
            </Tooltip>

            <Tooltip title={t('label.conversation')}>
              <TooltipTrigger>
                <ButtonUtility
                  color="secondary"
                  data-testid="conversation"
                  icon={<MessageChatSquare height={20} width={20} />}
                  onClick={handleOpenConversation}
                />
              </TooltipTrigger>
            </Tooltip>

            <Tooltip
              title={isFollowing ? t('label.un-follow') : t('label.follow')}>
              <TooltipTrigger>
                <ButtonUtility
                  className={isFollowing ? 'tw:text-brand-600' : undefined}
                  color="secondary"
                  data-testid="follow-btn"
                  disabled={isFollowLoading || knowledgePage?.deleted}
                  icon={isFollowing ? StarFilledIcon : StarIcon}
                  onClick={handleFollowClick}
                />
              </TooltipTrigger>
            </Tooltip>

            <Tooltip
              isOpen={isEmpty(copyTooltip) ? undefined : true}
              title={isEmpty(copyTooltip) ? t('label.share') : copyTooltip}>
              <TooltipTrigger>
                <ButtonUtility
                  color="secondary"
                  icon={<Share07 height={20} width={20} />}
                  onClick={handleShare}
                />
              </TooltipTrigger>
            </Tooltip>

            {permissions?.Delete && (
              <ManageButton
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                allowSoftDelete={false}
                canDelete={permissions?.Delete}
                deleteButtonDescription={t(
                  'message.delete-entity-type-action-description',
                  { entityType }
                )}
                deleteOptions={deleteOptions}
                deleted={knowledgePage?.deleted}
                entityFQN={knowledgePage?.fullyQualifiedName}
                entityId={knowledgePage?.id}
                entityName={knowledgePage?.displayName ?? t('label.untitled')}
                entityType={EntityType.KNOWLEDGE_CENTER}
                prepareType={false}
                successMessage={t('server.entity-deleted-successfully', {
                  entity: entityType,
                })}
                trigger={(onClick) => (
                  <ButtonUtility
                    data-testid="manage-button"
                    icon={DotsVertical}
                    size="sm"
                    tooltip={t('label.manage-entity', {
                      entity: t('label.article'),
                    })}
                    onClick={onClick}
                  />
                )}
              />
            )}
          </div>
        </div>

        {/* Row 2: tab strip + right-panel toggle */}
        <div className="tw:flex tw:items-center tw:justify-between">
          <Tabs
            className="tw:w-auto"
            selectedKey={activeTab}
            onSelectionChange={(key) => onTabChange?.(String(key))}>
            <Tabs.List type="underline">
              {tabs?.map((tab) => (
                <Tabs.Item id={String(tab.key)} key={String(tab.key)}>
                  <TabsLabel
                    count={tab.key === 'activity_feed' ? feedCount : undefined}
                    id={String(tab.key)}
                    isActive={activeTab === String(tab.key)}
                    name={tab.name}
                  />
                </Tabs.Item>
              ))}
            </Tabs.List>
          </Tabs>

          {activeTab !== EntityTabs.ACTIVITY_FEED && (
            <Tooltip
              title={
                isRightPanelOpen
                  ? t('label.hide-meta-details')
                  : t('label.show-meta-details')
              }>
              <TooltipTrigger>
                <ButtonUtility
                  className="tw:relative tw:bottom-2.5"
                  color="tertiary"
                  icon={
                    <SidebarCollapsible
                      className={isRightPanelOpen ? undefined : 'tw:rotate-180'}
                      height={18}
                      width={18}
                    />
                  }
                  onClick={onToggleRightPanel}
                />
              </TooltipTrigger>
            </Tooltip>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ArticleDetailHeader;
