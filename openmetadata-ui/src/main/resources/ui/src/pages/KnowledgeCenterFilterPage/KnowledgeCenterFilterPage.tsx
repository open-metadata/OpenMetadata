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
  Box,
  EmptyPlaceholder,
  Grid,
  Skeleton,
  SkeletonParagraph,
} from '@openmetadata/ui-core-components';
import { Lock01 } from '@openmetadata/ui-core-components/icons';
import { getLayoutGutter } from '../../utils/common/layout.utils';

import { AxiosError } from 'axios';
import { isEmpty, map, uniqBy, uniqueId } from 'lodash';
import { RefObject, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import KnowledgeCard from '../../components/KnowledgeCenter/KnowledgeCard/KnowledgeCard';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { PAGE_SIZE_BASE, ROUTES } from '../../constants/constants';
import { getKnowledgePageFields } from '../../constants/KnowledgeCenter.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Paging } from '../../generated/type/paging';
import { useLocationSearch } from '../../hooks/LocationSearch/useLocationSearch';
import { useElementInView } from '../../hooks/useElementInView';
import { KnowledgePage } from '../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../rest/knowledgeCenterAPI';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { Transi18next } from '../../utils/i18next/LocalUtil';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

type KnowledgeCenterFilter = {
  entityId: string;
  entityType: EntityType;
};

const KnowledgeCenterFilterPage = () => {
  const { t } = useTranslation();
  const { getResourcePermission } = usePermissionProvider();
  const { entityId, entityType } = useLocationSearch<KnowledgeCenterFilter>();
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [elementRef, isInView] = useElementInView({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [knowledgePages, setKnowledgePages] = useState<KnowledgePage[]>([]);
  const [paging, setPaging] = useState<Paging>({ total: 0 });

  const fetchPermission = async () => {
    try {
      setIsLoading(true);
      const response = await getResourcePermission(
        ResourceEntity.KNOWLEDGE_PAGE as unknown as ResourceEntity
      );
      setPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKnowledgePages = async (after?: string) => {
    if (after) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const { data, paging: pagingObj } = await getListKnowledgePages({
        fields: getKnowledgePageFields(),
        after,
        limit: PAGE_SIZE_BASE,
        entityId,
        entityType,
      });
      setKnowledgePages((prev) =>
        uniqBy(after ? [...prev, ...data] : data, 'id')
      );
      setPaging(pagingObj);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Resource-level permission (usePermissionProvider().getResourcePermission(KNOWLEDGE_PAGE),
  // itself OperationPermission-shaped) run through getDerivedPermissionFlags per the Batch 3
  // DatabaseSchemaTable.tsx / Batch 8 ContextCenter-trio precedent. `hasViewAccess` is a
  // byte-for-byte match of the old bare `ViewAll || ViewBasic` OR.
  const hasViewPermission = useMemo(
    () => getDerivedPermissionFlags(permissions).hasViewAccess,
    [permissions]
  );

  const breadcrumbs = useMemo(() => {
    const entityRef = knowledgePages[0]?.relatedEntities?.find(
      (entity) => entity.id === entityId
    );

    if (!entityRef) {
      return [];
    }

    const name = getEntityName(entityRef);

    return [
      {
        name: t('label.context-center'),
        url: ROUTES.CONTEXT_CENTER,
      },
      {
        name,
        url: getEntityLinkFromType(
          entityRef?.fullyQualifiedName ?? '',
          entityType
        ),
      },
      {
        name: t('label.related-article-plural'),
        url: '',
        activeTitle: false,
      },
    ];
  }, [knowledgePages, entityId]);

  useEffect(() => {
    fetchPermission();
  }, []);

  // The filter identity (entityId/entityType) is read from the query string via
  // useLocationSearch, so a same-path navigation to a different entity re-renders
  // this instance without remounting it (notably under KeepAliveRoutes in AI app
  // mode, which caches by path and ignores the query string). Reset the listing
  // and paging state and refetch whenever the entity changes so stale articles
  // from the previous entity are never shown.
  useEffect(() => {
    if (hasViewPermission) {
      setKnowledgePages([]);
      setPaging({ total: 0 });
      fetchKnowledgePages();
    }
  }, [hasViewPermission, entityId, entityType]);

  /**
   * Handle infinite scrolling
   */
  useEffect(() => {
    const after = paging.after;
    if (isInView && after && !isLoadingMore && hasViewPermission) {
      fetchKnowledgePages(after);
    }
  }, [isInView, paging, isLoadingMore, hasViewPermission]);

  if (isLoading) {
    return (
      <PageLayoutV1 pageTitle={t('label.context-center')}>
        <div className="knowledge-center-filter-page">
          <Grid
            className="layout-row layout-grid"
            data-testid="knowledge-page-listing"
            style={{ ...getLayoutGutter(0, 56) }}>
            {Array.from({ length: 4 }).map(() => (
              <Grid.Item
                className="layout-column knowledge-card-col"
                key={uniqueId()}
                span={24}>
                <Grid
                  className="layout-row layout-grid"
                  style={{ ...getLayoutGutter(16, 16) }}>
                  <Grid.Item className="layout-column" span={24}>
                    <Box
                      inline
                      align="center"
                      className="layout-space layout-space-horizontal"
                      gap={2}
                      itemClassName="layout-space-item">
                      <div className="tw:flex tw:gap-4">
                        <Skeleton
                          animation={false}
                          variant="circular"
                          width={40}
                        />
                        <div className="tw:flex-1">
                          <Skeleton animation={false} height={16} />
                        </div>
                      </div>
                      <Skeleton animation={false} height={16} width={150} />
                    </Box>
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={24}>
                    <SkeletonParagraph
                      className="m-b-sm"
                      rows={1}
                      title={false}
                    />
                    <SkeletonParagraph rows={2} title={false} />
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={24}>
                    <Box
                      inline
                      align="center"
                      className="layout-space layout-space-horizontal"
                      gap={2}
                      itemClassName="layout-space-item">
                      <Skeleton height={16} width={100} />
                      <Skeleton height={16} width={100} />
                      <Skeleton height={16} width={100} />
                    </Box>
                  </Grid.Item>
                </Grid>
              </Grid.Item>
            ))}
          </Grid>
        </div>
      </PageLayoutV1>
    );
  }

  if (!hasViewPermission) {
    return (
      <div className="tw:relative tw:flex-1 tw:h-[calc(100vh-80px)]">
        <EmptyPlaceholder
          description={
            <Transi18next
              i18nKey="message.no-access-placeholder"
              renderElement={<b />}
              values={{
                entity: t('label.view-entity', {
                  entity: t('label.context-center'),
                }),
              }}
            />
          }
          icon={<Lock01 className="tw:text-secondary" />}
          title={t('label.access-denied')}
        />
      </div>
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.context-center')}>
      <div className="knowledge-center-filter-page">
        <Grid
          className="layout-row layout-grid"
          style={{ ...getLayoutGutter(0, 24) }}>
          {!isEmpty(breadcrumbs) && (
            <Grid.Item className="layout-column d-flex items-center" span={16}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Grid.Item>
          )}
          <Grid.Item className="layout-column" span={24}>
            <Grid
              className="layout-row layout-grid"
              data-testid="knowledge-page-listing"
              style={{ ...getLayoutGutter(0, 56) }}>
              {map(knowledgePages, (knowledgePage) => (
                <Grid.Item
                  className="layout-column knowledge-card-col"
                  key={knowledgePage.id}
                  span={24}>
                  <KnowledgeCard readonly knowledgeItem={knowledgePage} />
                </Grid.Item>
              ))}
            </Grid>
          </Grid.Item>
        </Grid>

        {isLoadingMore ? <Loader /> : null}
        <div
          className="w-full"
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
          style={{ height: '2px' }}
        />
      </div>
    </PageLayoutV1>
  );
};

export default KnowledgeCenterFilterPage;
