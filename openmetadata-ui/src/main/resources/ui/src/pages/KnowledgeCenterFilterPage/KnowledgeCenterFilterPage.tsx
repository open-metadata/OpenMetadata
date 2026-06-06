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
import { Col, Row, Skeleton, Space } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, map, uniqBy, uniqueId } from 'lodash';
import { RefObject, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import KnowledgeCard from '../../components/KnowledgeCenter/KnowledgeCard/KnowledgeCard';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { PAGE_SIZE_BASE, ROUTES } from '../../constants/constants';
import { getKnowledgePageFields } from '../../constants/KnowledgeCenter.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { Paging } from '../../generated/type/paging';
import { useLocationSearch } from '../../hooks/LocationSearch/useLocationSearch';
import { useElementInView } from '../../hooks/useElementInView';
import { KnowledgePage } from '../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../rest/knowledgeCenterAPI';
import { getEntityLinkFromType, getEntityName } from '../../utils/EntityUtils';
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

  const hasViewPermission = useMemo(
    () => permissions.ViewAll || permissions.ViewBasic,
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
        name: t('label.knowledge-center'),
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

  useEffect(() => {
    if (hasViewPermission) {
      fetchKnowledgePages();
    }
  }, [hasViewPermission]);

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
      <PageLayoutV1 pageTitle={t('label.knowledge-center')}>
        <div className="knowledge-center-filter-page">
          <Row data-testid="knowledge-page-listing" gutter={[0, 56]}>
            {Array.from({ length: 4 }).map(() => (
              <Col className="knowledge-card-col" key={uniqueId()} span={24}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Space>
                      <Skeleton avatar paragraph={{ rows: 1 }} title={false} />
                      <Skeleton
                        paragraph={{ rows: 1, width: 150 }}
                        title={false}
                      />
                    </Space>
                  </Col>
                  <Col span={24}>
                    <Skeleton
                      active
                      className="m-b-sm"
                      paragraph={{ rows: 1 }}
                      title={false}
                    />
                    <Skeleton active paragraph={{ rows: 2 }} title={false} />
                  </Col>
                  <Col span={24}>
                    <Space>
                      <Skeleton
                        active
                        paragraph={{ rows: 1, width: 100 }}
                        title={false}
                      />
                      <Skeleton
                        active
                        paragraph={{ rows: 1, width: 100 }}
                        title={false}
                      />
                      <Skeleton
                        active
                        paragraph={{ rows: 1, width: 100 }}
                        title={false}
                      />
                    </Space>
                  </Col>
                </Row>
              </Col>
            ))}
          </Row>
        </div>
      </PageLayoutV1>
    );
  }

  if (!hasViewPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.knowledge-center'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.knowledge-center')}>
      <div className="knowledge-center-filter-page">
        <Row gutter={[0, 24]}>
          {!isEmpty(breadcrumbs) && (
            <Col className="d-flex items-center" span={16}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Col>
          )}
          <Col span={24}>
            <Row data-testid="knowledge-page-listing" gutter={[0, 56]}>
              {map(knowledgePages, (knowledgePage) => (
                <Col
                  className="knowledge-card-col"
                  key={knowledgePage.id}
                  span={24}>
                  <KnowledgeCard readonly knowledgeItem={knowledgePage} />
                </Col>
              ))}
            </Row>
          </Col>
        </Row>

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
