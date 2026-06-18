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
import {
  Badge,
  Box,
  ButtonUtility,
  Card,
  Dot,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  KnowledgePage,
  PageType,
  QuickLink,
  RecentlyViewedQuickLinks,
  RecentViewedKnowledgePage,
} from '../../../interface/knowledge-center.interface';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { t } from '../../../utils/i18next/LocalUtil';
import { getKnowledgePageName } from '../../../utils/KnowledgePagePureUtils';
import {
  addToKnowledgeCenterRecentViewed,
  updateKnowledgeCenterRecentViewed,
} from '../../../utils/KnowledgePageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { stripMarkdown } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../QuickLinkFormModal/QuickLinkFormModal';

import { Trash01 } from '@untitledui/icons';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { deleteKnowledgePage } from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';

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
  onDelete,
  onRefreshTagsCategory,
  readonly = false,
}) => {
  const { getEntityPermissionByFqn } = usePermissionProvider();

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
  } = knowledgePage;

  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [isDelete, setIsDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
  const path = isQuickLink
    ? (knowledgePage.page as QuickLink).url
    : contextCenterClassBase.getArticlePath(knowledgePage.fullyQualifiedName);

  const { firstDomain } = useMemo(() => {
    const domains = knowledgePage.domains ?? [];

    return { firstDomain: domains[0] };
  }, [knowledgePage]);

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
      <Box align="center" gap={1}>
        {editPermission && (
          <ButtonUtility
            color="tertiary"
            data-testid="edit-quick-link-btn"
            icon={<EditIcon height={16} width={16} />}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              e.preventDefault();
              setShowAddLinkModal(true);
            }}
          />
        )}
        {permissions?.Delete && (
          <ButtonUtility
            color="tertiary"
            data-testid="delete-quick-link-btn"
            icon={<Trash01 height={16} width={16} />}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              e.preventDefault();
              setIsDelete(true);
            }}
          />
        )}
      </Box>
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
    <Card
      className="tw:flex tw:flex-col tw:cursor-pointer tw:transition-[border-color,transform] tw:duration-150 tw:hover:border-blue-200 tw:hover:-translate-y-px"
      data-testid={`knowledge-card-${displayName || name}`}>
      <Link
        className="tw:flex tw:flex-col tw:gap-2.5 tw:px-5 tw:py-4.5"
        data-testid={isQuickLink ? 'knowledge-link' : 'knowledge-page-link'}
        style={{ textDecoration: 'none', color: 'inherit' }}
        target={isQuickLink ? '_blank' : '_self'}
        to={path}
        onClick={handleQuickLinkRecentView}>
        {/* Row 1: title + timestamp */}
        <Box align="center" justify="between">
          <Box align="center" className="tw:max-w-[70%]" gap={2}>
            <Typography
              ellipsis
              data-testid="knowledge-card-title"
              size="text-lg"
              weight="semibold">
              {getKnowledgePageName(knowledgePage, t)}
            </Typography>
            {isQuickLink && !readonly && quickLinkActions}
          </Box>
          <Typography
            className="tw:text-gray-500"
            data-testid="updated-at"
            size="text-xs">
            {t('label.last-edited-time', {
              time: getShortRelativeTime(updatedAt),
            })}
          </Typography>
        </Box>

        {/* Row 3: plain-text description */}
        {description.trim() ? (
          <Typography
            className="tw:text-gray-600 tw:line-clamp-2 tw:leading-[1.55]"
            data-testid="knowledge-card-description"
            size="text-sm">
            {stripMarkdown(description)}
          </Typography>
        ) : (
          <Typography
            className="tw:text-gray-400"
            data-testid="no-description"
            size="text-sm">
            {t('label.no-description')}
          </Typography>
        )}

        {/* Row 4: owner · dot · domain · spacer → tags */}
        <Box
          align="center"
          className="tw:pt-2"
          data-testid="knowledge-footer"
          gap={3}>
          {owners?.[0] ? (
            <UserPopOverCard
              showUserName
              className="tw:text-xs tw:font-medium tw:text-gray-700 tw:gap-2 tw:max-w-40"
              displayName={getEntityName(owners?.[0])}
              profileWidth={20}
              userName={getEntityName(owners?.[0])}
            />
          ) : (
            <Typography
              className="tw:text-gray-400"
              data-testid="owner-name"
              size="text-xs"
              weight="medium">
              {t('label.no-entity', { entity: t('label.owner') })}
            </Typography>
          )}

          <Dot className="tw:text-gray-400" size="micro" />
          <div className="tw:max-w-40">
            <Typography
              ellipsis
              className={firstDomain ? 'tw:text-gray-500' : 'tw:text-gray-400'}
              data-testid="domain-name"
              size="text-xs">
              {firstDomain?.displayName ??
                firstDomain?.name ??
                t('label.no-entity', { entity: t('label.domain') })}
            </Typography>
          </div>

          <span className="tw:flex-1" />

          {(knowledgePage.tags ?? []).slice(0, 2).map((tag) => (
            <Badge
              className="tw:max-w-30"
              key={String(tag.tagFQN ?? '')}
              size="md"
              type="modern">
              <Typography
                ellipsis
                className="tw:font-mono tw:text-gray-700"
                size="text-xs">
                {getEntityName(tag)}
              </Typography>
            </Badge>
          ))}
          {(knowledgePage.tags ?? []).length > 2 && (
            <Badge size="md" type="modern">
              <Typography
                className="tw:font-mono tw:text-gray-700"
                size="text-xs">
                +{(knowledgePage.tags ?? []).length - 2}
              </Typography>
            </Badge>
          )}
        </Box>
      </Link>

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
      <DeleteModal
        entityTitle={getKnowledgePageName(knowledgePage, t)}
        isDeleting={isDeleting}
        message={t('message.delete-entity-permanently', {
          entityType: t('label.quick-link'),
        })}
        open={isDelete}
        onCancel={() => setIsDelete(false)}
        onDelete={async () => {
          setIsDeleting(true);
          try {
            await deleteKnowledgePage(knowledgePage.id, false, true);
            afterDeleteAction(false);
          } catch (error) {
            showErrorToast(error as AxiosError);
          } finally {
            setIsDeleting(false);
            setIsDelete(false);
          }
        }}
      />
    </Card>
  );
};

export default KnowledgeCard;
