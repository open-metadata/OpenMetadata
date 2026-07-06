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
  Dropdown,
  Skeleton,
  Tabs,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  UploadCloud01,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, isUndefined, toString, uniqBy } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as CopyIcon } from '../../../assets/svg/action-icons/copy.svg';
import { ReactComponent as DotsVerticalIcon } from '../../../assets/svg/action-icons/dots-vertical.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/action-icons/edit.svg';
import { ReactComponent as EditorIcon } from '../../../assets/svg/action-icons/editor.svg';
import { ReactComponent as FileIcon } from '../../../assets/svg/action-icons/file.svg';
import { ReactComponent as FollowActiveIcon } from '../../../assets/svg/action-icons/follow-active.svg';
import { ReactComponent as FollowIcon } from '../../../assets/svg/action-icons/follow.svg';
import { ReactComponent as GlobeIcon } from '../../../assets/svg/action-icons/globe.svg';
import { ReactComponent as ChatIcon } from '../../../assets/svg/action-icons/message-chat.svg';
import { ReactComponent as ThumbsDownActiveIcon } from '../../../assets/svg/action-icons/thumbs-down-active.svg';
import { ReactComponent as ThumbsDownIcon } from '../../../assets/svg/action-icons/thumbs-down.svg';
import { ReactComponent as ThumbsUpActiveIcon } from '../../../assets/svg/action-icons/thumbs-up-active.svg';
import { ReactComponent as ThumbsUpIcon } from '../../../assets/svg/action-icons/thumbs-up.svg';
import { ReactComponent as TrashIcon } from '../../../assets/svg/action-icons/trash.svg';
import { ReactComponent as UserIcon } from '../../../assets/svg/action-icons/user.svg';
import { ReactComponent as SidebarCollapsible } from '../../../assets/svg/ic-sidebar-collapsible.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import Loader from '../../../components/common/Loader/Loader';
import TabsLabel from '../../../components/common/TabsLabel/TabsLabel.component';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
import { EntityStatusBadge } from '../../../components/Entity/EntityStatusBadge/EntityStatusBadge.component';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useArticleDraftStore } from '../../../hooks/useArticleDraftStore';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { useFqn } from '../../../hooks/useFqn';
import {
  ContentChangeState,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import { deleteKnowledgePage } from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import EntityLink from '../../../utils/EntityLink';
import { getKnowledgePageName } from '../../../utils/KnowledgePagePureUtils';
import { updateKnowledgeCenterRecentViewed } from '../../../utils/KnowledgePageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
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
  onSetThreadLink,
  fetchKnowledgePageHierarchy,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { entityRules } = useEntityRules(EntityType.KNOWLEDGE_PAGE);
  const { currentUser } = useApplicationStore();
  const { removeDraft } = useArticleDraftStore();
  const USERId = currentUser?.id ?? '';
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState<QueryVoteType | null>(null);
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();
  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const isEmbedded = contextCenterClassBase.isEmbeddedMode();

  const breadcrumbItems = useMemo(
    () => [
      contextCenterClassBase.getContextCenterRootBreadcrumb(t),
      {
        label: t('label.article-plural'),
        href: contextCenterClassBase.getArticlesListPath(),
      },
      {
        label: getKnowledgePageName(knowledgePage, t),
      },
    ],
    [knowledgePage?.id, knowledgePage?.name, knowledgePage?.displayName, t]
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
    return uniqBy(knowledgePage?.editors ?? [], 'name').slice(0, 5);
  }, [knowledgePage]);

  const { owners, firstDomain, extraDomains } = useMemo(() => {
    const domains = knowledgePage?.domains ?? [];
    const owners = knowledgePage?.owners ?? [];

    return {
      owners,
      firstDomain: domains[0],
      extraDomains: domains.slice(1),
    };
  }, [knowledgePage]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!knowledgePage?.id) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteKnowledgePage(knowledgePage.id);
      removeDraft(knowledgePage.id);
      updateKnowledgeCenterRecentViewed(
        recentlyViewed.filter((page) => page.id !== knowledgePage.id)
      );
      await fetchKnowledgePageHierarchy?.(true);
      setIsDeleteModalOpen(false);
      navigate(contextCenterClassBase.getArticlesListPath());
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  }, [knowledgePage, recentlyViewed, fetchKnowledgePageHierarchy, removeDraft]);

  const handleVersionClick = () => {
    navigate(contextCenterClassBase.getArticleVersionPath(fqn, version));
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

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      if (!knowledgePage || !onUpdate) {
        return;
      }
      const updated = cloneDeep(knowledgePage);
      updated.domains = Array.isArray(selectedDomain)
        ? selectedDomain
        : [selectedDomain];
      await onUpdate(updated);
    },
    [knowledgePage, onUpdate]
  );

  const handleOwnerSave = useCallback(
    async (updatedOwners?: EntityReference[]) => {
      if (!knowledgePage || !onUpdate) {
        return;
      }
      const updated = cloneDeep(knowledgePage);
      updated.owners = updatedOwners;
      await onUpdate(updated);
    },
    [knowledgePage, onUpdate]
  );

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

  const breadcrumbInsideCard = contextCenterClassBase.isBreadcrumbInsideCard();
  const headerCardClassName = contextCenterClassBase.getHeaderCardClassName();

  const breadcrumbEl = (
    <HeaderBreadcrumb items={breadcrumbItems} showHome={!isEmbedded} />
  );

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
      className="tw:flex tw:flex-col tw:mb-5"
      data-testid="article-detail-header">
      {!breadcrumbInsideCard && breadcrumbEl}

      <Card
        className={classNames(
          'tw:mb-0 tw:p-6 tw:pb-0 tw:pr-3',
          headerCardClassName
        )}>
        {breadcrumbInsideCard && <div className="tw:mb-4">{breadcrumbEl}</div>}
        {/* Row 1: title + meta + actions */}
        <div className="tw:flex tw:items-center tw:justify-between tw:mb-6">
          <div className="tw:flex tw:gap-4 tw:items-stretch tw:w-full tw:max-w-[60%] tw:pr-3">
            <div className="h:full tw:w-auto tw:shrink-0 tw:bg-tertiary tw:rounded-xl tw:flex tw:items-center tw:p-2">
              <FileIcon
                className="tw:text-quaternary"
                height={40}
                style={{ verticalAlign: 'middle', flexShrink: 0 }}
                width={40}
              />
            </div>

            <div className="tw:flex tw:flex-col tw:gap-2 tw:min-w-0">
              {/* Article name with icon */}
              <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap">
                <Typography ellipsis as="h3" className="tw:truncate">
                  {getKnowledgePageName(knowledgePage, t)}
                </Typography>
                {entityStatusBadge}
              </div>

              {/* Domain · Owner row */}
              <div className="tw:flex tw:items-center tw:gap-3 tw:flex-wrap tw:text-sm">
                {/* Domain */}
                <div className="tw:flex tw:items-center tw:gap-1.5">
                  <Tooltip title={t('label.domain')}>
                    <TooltipTrigger className="tw:leading-0">
                      <GlobeIcon
                        className="tw:shrink-0 tw:text-quaternary"
                        height={16}
                        width={16}
                      />
                    </TooltipTrigger>
                  </Tooltip>
                  <Typography
                    className={
                      firstDomain ? 'tw:text-primary' : 'tw:text-quaternary'
                    }
                    data-testid="domain-link"
                    size="text-sm"
                    weight="regular">
                    {firstDomain
                      ? firstDomain.displayName ?? firstDomain.name
                      : t('label.no-entity', { entity: t('label.domain') })}
                  </Typography>
                  {extraDomains.length > 0 && (
                    <span className="tw:inline-flex tw:items-center tw:rounded-full tw:bg-tertiary tw:px-1.5 tw:py-0.5 tw:text-xs tw:font-medium tw:text-tertiary">
                      +{extraDomains.length}
                    </span>
                  )}
                  {permissions.EditAll && (
                    <DomainSelectableList
                      isClearable
                      hasPermission={permissions.EditAll}
                      multiple={entityRules.canAddMultipleDomains}
                      selectedDomain={knowledgePage?.domains ?? []}
                      onUpdate={handleDomainSave}>
                      <ButtonUtility
                        className="tw:p-1"
                        color="secondary"
                        data-testid="edit-domain-btn"
                        icon={<EditIcon height={11} width={11} />}
                        tooltip={t('label.edit-entity', {
                          entity: t('label.domain'),
                        })}
                      />
                    </DomainSelectableList>
                  )}
                </div>

                {/* Dot separator */}
                <Dot className="tw:text-fg-quaternary" size="xs" />

                {/* Owners */}
                <div className="tw:flex tw:items-center tw:gap-1.5">
                  <Tooltip title={t('label.owner-plural')}>
                    <TooltipTrigger className="tw:leading-0">
                      <UserIcon
                        className="tw:shrink-0 tw:text-quaternary"
                        height={16}
                        width={16}
                      />
                    </TooltipTrigger>
                  </Tooltip>

                  {owners.length > 0 ? (
                    <div className="article-detail-owner-label">
                      <OwnerLabel
                        hasPermission={false}
                        isCompactView={false}
                        multiple={{ user: true, team: true }}
                        owners={owners}
                        showLabel={false}
                      />
                    </div>
                  ) : (
                    <Typography
                      className="tw:text-quaternary"
                      size="text-sm"
                      weight="regular">
                      {t('label.no-entity', { entity: t('label.owner') })}
                    </Typography>
                  )}
                  {(permissions.EditAll || permissions.EditOwners) && (
                    <UserTeamSelectableList
                      hasPermission={
                        permissions.EditAll || permissions.EditOwners
                      }
                      multiple={{
                        user: entityRules.canAddMultipleUserOwners,
                        team: entityRules.canAddMultipleTeamOwner,
                      }}
                      owner={knowledgePage?.owners}
                      onUpdate={handleOwnerSave}>
                      <ButtonUtility
                        className="tw:p-1"
                        color="secondary"
                        data-testid="edit-owner-btn"
                        icon={<EditIcon height={11} width={11} />}
                        tooltip={t('label.edit-entity', {
                          entity: t('label.owner-plural'),
                        })}
                      />
                    </UserTeamSelectableList>
                  )}
                </div>

                {/* Editors */}
                {editors.length > 0 && (
                  <>
                    <Dot className="tw:text-fg-quaternary" size="xs" />
                    <div className="tw:flex tw:items-center tw:gap-1.5">
                      <Tooltip title={t('label.editor')}>
                        <TooltipTrigger className="tw:leading-0">
                          <EditorIcon
                            className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-fg-disabled"
                            height={16}
                            width={16}
                          />
                        </TooltipTrigger>
                      </Tooltip>
                      <div className="article-detail-owner-label tw:flex tw:items-center tw:gap-0.5">
                        <OwnerLabel
                          hasPermission={false}
                          isCompactView={false}
                          multiple={{ user: true, team: true }}
                          owners={editors}
                          showLabel={false}
                        />
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

                <ButtonUtility
                  className={
                    voteStatus === QueryVoteType.votedUp
                      ? 'tw:text-fg-brand-primary'
                      : undefined
                  }
                  color="tertiary"
                  data-testid="upvote-btn"
                  disabled={knowledgePage?.deleted || voteLoading !== null}
                  icon={
                    voteStatus === QueryVoteType.votedUp ? <ThumbsUpActiveIcon
                      height={18}
                      width={18}
                    /> :
                    <ThumbsUpIcon
                      height={18}
                      width={18}
                    />
                  }
                  tooltip={t('label.up-vote')}
                  onClick={() => handleVoteChange(QueryVoteType.votedUp)}
                />
            {/* Down vote */}

                <ButtonUtility
                className={
                    voteStatus === QueryVoteType.votedDown
                      ? 'tw:text-fg-brand-primary'
                      : undefined
                  }
                  color="tertiary"
                  data-testid="downvote-btn"
                  disabled={knowledgePage?.deleted || voteLoading !== null}
                  icon={
                     voteStatus === QueryVoteType.votedDown ? <ThumbsDownActiveIcon
                      height={18}
                      width={18}
                    /> :
                    <ThumbsDownIcon
                      height={18}
                      width={18}
                    />
                  }
                  tooltip={t('label.down-vote')}
                  onClick={() => handleVoteChange(QueryVoteType.votedDown)}
                />


                <ButtonUtility
                  color="tertiary"
                  data-testid="conversation"
                  icon={<ChatIcon height={18} width={18} />}
                  tooltip={t('label.conversation')}
                  onClick={handleOpenConversation}
                />

 
              <ButtonUtility
                color="tertiary"
                data-testid="follow-btn"
                disabled={isFollowLoading || knowledgePage?.deleted}
                icon={isFollowing ? <FollowIcon height={18} width={18} /> : <FollowActiveIcon height={18} width={18} /> }
                tooltip={isFollowing ? t('label.un-follow') : t('label.follow')}
                onClick={handleFollowClick}
              />
            <CopyLinkButton
              className="tw:w-7.5 tw:h-7.5"
              color="tertiary"
              testId="copy-btn"
              url={window.location.href}>
              <CopyIcon height={18} width={18} />
            </CopyLinkButton>

            {permissions?.Delete && (
              <Dropdown.Root>
                 <ButtonUtility
                  color="tertiary"
                  data-testid="edit-memory-btn"
                  icon={ <DotsVerticalIcon height={18} width={18} />}
                  size="sm"
                  tooltip={t('label.manage-entity', {
                              entity: t('label.article'),
                            })}
                />
                <Dropdown.Popover className="tw:w-30">
                  <Dropdown.Menu
                    onAction={(key) => {
                      if (key === 'delete') {
                        setIsDeleteModalOpen(true);
                      }
                    }}>
                    <Dropdown.Item data-testid="delete-btn" id="delete">
                      <div className="tw:flex tw:items-center tw:gap-2">
                        <TrashIcon
                          aria-hidden="true"
                          className="ttw:shrink-0 tw:text-error-primary"
                          height={18}
                          width={18}
                        />
                        <Typography
                          ellipsis
                          className="tw:grow tw:text-error-primary"
                          size="text-sm"
                          weight="medium">
                          {t('label.delete')}
                        </Typography>
                      </div>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            )}

            <DeleteModal
              entityTitle={getKnowledgePageName(knowledgePage, t)}
              isDeleting={isDeleting}
              message={t('message.delete-entity-permanently', {
                entityType: t('label.article-lowercase'),
              })}
              open={isDeleteModalOpen}
              onCancel={() => setIsDeleteModalOpen(false)}
              onDelete={handleDeleteConfirm}
            />
          </div>
        </div>

        {/* Row 2: tab strip + right-panel toggle */}
        <div className="tw:flex tw:items-center tw:justify-between">
          <Tabs
            className="tw:w-auto"
            selectedKey={activeTab}
            onSelectionChange={(key) => onTabChange?.(String(key))}>
            <Tabs.List className="tw:gap-6" type="underline">
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
                  data-testid="right-panel-toggle-btn"
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
