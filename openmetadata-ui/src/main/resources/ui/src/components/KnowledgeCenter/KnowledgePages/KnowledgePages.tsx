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
  ButtonUtility,
  Grid,
  TreeSelect,
  TreeSelectDataFetcher,
  TreeSelectNode,
  Typography,
} from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import {
  Article,
  Edit01,
  Plus,
  QuickLink as QuickLinkIcon,
} from '@openmetadata/ui-core-components/icons';
import axios, { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, map } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { PAGE_SIZE, ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Paging } from '../../../generated/type/paging';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from '../../../interface/knowledge-center.interface';
import {
  addKnowledgePageUsage,
  getListKnowledgePages,
  removeKnowledgePageUsage,
} from '../../../rest/knowledgeCenterAPI';
import { searchQuery } from '../../../rest/searchAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  escapeESReservedCharacters,
  getSafeHttpUrl,
} from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { canLinkArticlesToEntity } from './KnowledgePages.utils';

const KnowledgePages: FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [knowledgePages, setKnowledgePages] = useState<KnowledgePage[]>([]);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [hasLoadError, setHasLoadError] = useState(false);
  const {
    data: { id: entityId = '', deleted } = {},
    type: entityType,
    filterWidgets,
    permissions,
  } = useGenericContext<{ id: string; deleted?: boolean }>();
  const { permissions: resourcePermissions } = usePermissionProvider();
  const canLinkArticles = canLinkArticlesToEntity({
    entityType,
    entityPermissions: permissions,
    articlePermissions: resourcePermissions?.[ResourceEntity.KNOWLEDGE_PAGE],
    deleted,
  });

  const fetchKnowledgePages = async () => {
    setIsLoading(true);
    try {
      const { data, paging } = await getListKnowledgePages({
        entityId,
        entityType,
      });
      setKnowledgePages(data);
      setPaging(paging);
      setHasLoadError(false);
    } catch {
      // No toast: the widget hides itself instead of offering links over an unknown list.
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (entityId && entityType) {
      fetchKnowledgePages();
    } else {
      setIsLoading(false);
    }
  }, [entityId, entityType]);

  const getPageIcon = (pageType?: PageType) =>
    pageType === PageType.QUICK_LINK ? (
      <QuickLinkIcon size={16} />
    ) : (
      <Article size={16} />
    );

  const toArticleNode = (
    page: KnowledgePage
  ): TreeSelectNode<KnowledgePage> => ({
    id: page.id,
    label: getEntityName(page),
    value: page.id,
    data: page,
    isLeaf: true,
    icon: getPageIcon(page.pageType),
  });

  const fetchArticleOptions: TreeSelectDataFetcher<KnowledgePage> = useCallback(
    async ({ searchTerm, after }) => {
      // The search API pages by number, so the cursor is the next page number.
      const pageNumber = Number(after ?? 1);
      try {
        const response = await searchQuery({
          query: searchTerm
            ? `*${escapeESReservedCharacters(searchTerm)}*`
            : '*',
          pageNumber,
          pageSize: PAGE_SIZE,
          searchIndex: SearchIndex.KNOWLEDGE_PAGE_INDEX,
        });
        const total = response.hits.total.value;
        const hits = response.hits.hits;
        const hasMore = (pageNumber - 1) * PAGE_SIZE + hits.length < total;

        return {
          nodes: hits.map(({ _source }) => toArticleNode(_source)),
          hasMore,
          total,
          nextCursor: hasMore ? String(pageNumber + 1) : undefined,
        };
      } catch (error) {
        if (axios.isCancel(error)) {
          throw error;
        }
        showErrorToast(error as AxiosError);

        return { nodes: [] };
      }
    },
    []
  );

  const selectedNodes = useMemo(
    () => knowledgePages.map(toArticleNode),
    [knowledgePages]
  );

  const handleLinkUpdate = async (
    value:
      | TreeSelectNode<KnowledgePage>[]
      | TreeSelectNode<KnowledgePage>
      | null
  ) => {
    const selectedIds = new Set(value ? [value].flat().map((n) => n.id) : []);
    const currentIds = new Set(knowledgePages.map((p) => p.id));
    const entityRef = { id: entityId, type: entityType };

    // Diff only against the listed pages: links beyond the first page are never touched.
    const linkRequests = [...selectedIds]
      .filter((id) => !currentIds.has(id))
      .map((id) => addKnowledgePageUsage(id, [entityRef]));
    const unlinkRequests = knowledgePages
      .filter((p) => !selectedIds.has(p.id))
      .map((p) => removeKnowledgePageUsage(p.id, [entityRef]));

    const results = await Promise.allSettled([
      ...linkRequests,
      ...unlinkRequests,
    ]);
    results.forEach((result) => {
      if (result.status === 'rejected') {
        showErrorToast(result.reason);
      }
    });
    await fetchKnowledgePages();
  };

  const [editIcon, editTooltipKey] = isEmpty(knowledgePages)
    ? [Plus, 'label.add-entity']
    : [Edit01, 'label.edit-entity'];

  const articlePicker = canLinkArticles && (
    <TreeSelect<KnowledgePage>
      multiple
      searchable
      commitMode="staged"
      data-testid="article-picker"
      fetchData={fetchArticleOptions}
      // The server already filtered; local re-filtering would hide matches.
      filterNode={() => true}
      noDataMessage={t('label.no-entity-available', {
        entity: t('label.article-plural'),
      })}
      popoverClassName="article-picker-popover"
      renderTrigger={({ toggle }) => (
        <ButtonUtility
          data-testid="edit-linked-articles"
          icon={editIcon}
          tooltip={t(editTooltipKey, { entity: t('label.article-plural') })}
          onClick={toggle}
        />
      )}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.article-plural'),
      })}
      showExpandIcon={false}
      value={selectedNodes}
      onChange={handleLinkUpdate}
    />
  );

  // only show view all if length is greater than PAGE_SIZE i.e 10
  const headerExtra = (
    <>
      {paging?.total > PAGE_SIZE && (
        <Link
          data-testid="view-all-data-asset-related-articles"
          to={`${ROUTES.CONTEXT_CENTER_FILTER}?entityId=${entityId}&entityType=${entityType}`}>
          {t('label.view-all')}
        </Link>
      )}
      {articlePicker}
    </>
  );

  const content = (
    <div
      className="entity-list-body article-list"
      data-testid="knowledge-pages">
      {map(knowledgePages, (knowledgePage, index) => {
        const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
        const quickLink = knowledgePage.page as QuickLink;

        return (
          <Grid
            className={`layout-row layout-grid ${classNames({
              'm-b-sm': knowledgePages.length - 1 !== index,
            })}`}
            data-testid="article-entry"
            key={knowledgePage.id}
            style={{ ...getLayoutGutter(0, 4) }}>
            <Grid.Item
              className="layout-column d-flex items-center gap-2"
              span={24}>
              <span>
                {isQuickLink ? (
                  <QuickLinkIcon
                    data-testid="link-icon"
                    size={16}
                    style={{ verticalAlign: 'middle' }}
                  />
                ) : (
                  <Article
                    data-testid="article-icon"
                    size={16}
                    style={{ verticalAlign: 'middle' }}
                  />
                )}
              </span>
              <Link
                className="no-underline w-max-95 truncate"
                data-testid="page-link"
                target={isQuickLink ? '_blank' : '_self'}
                to={
                  isQuickLink
                    ? getSafeHttpUrl(quickLink.url) ?? '#'
                    : {
                        pathname: contextCenterClassBase.getArticlePath(
                          knowledgePage.fullyQualifiedName
                        ),
                      }
                }>
                <Typography
                  className="article-header"
                  ellipsis={{
                    tooltip: true,
                    excludeTriggerFromTabOrder: true,
                  }}>
                  {getEntityName(knowledgePage)}
                </Typography>
              </Link>
            </Grid.Item>
          </Grid>
        );
      })}
    </div>
  );

  const hideWidget =
    hasLoadError || (isEmpty(knowledgePages) && !canLinkArticles);

  useEffect(() => {
    if (!isLoading && hideWidget) {
      filterWidgets?.([DetailPageWidgetKeys.KNOWLEDGE_ARTICLE]);
    }
  }, [isLoading, hideWidget]);

  if (isLoading) {
    return <Loader />;
  }

  if (hideWidget) {
    return null;
  }

  return (
    <WidgetCard
      dataTestId="knowledge-center"
      headerExtra={headerExtra}
      isExpandDisabled={isEmpty(knowledgePages)}
      title={t('label.context-center')}>
      {content}
    </WidgetCard>
  );
};

export default KnowledgePages;
