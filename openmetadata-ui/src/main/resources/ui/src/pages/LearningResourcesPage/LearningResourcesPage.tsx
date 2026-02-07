/*
 *  Copyright 2024 Collate.
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

import { PlusOutlined } from '@ant-design/icons';
import {
  Box,
  Paper,
  TableContainer,
  Typography,
  useTheme,
} from '@mui/material';
import { Trash01 } from '@untitledui/icons';
import { Button, Space, Table, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as ArticleIcon } from '../../assets/svg/ic_article.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/ic_video.svg';
import { useSearch } from '../../components/common/atoms/navigation/useSearch';
import { useViewToggle } from '../../components/common/atoms/navigation/useViewToggle';
import { usePaginationControls } from '../../components/common/atoms/pagination/usePaginationControls';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { LEARNING_CATEGORIES } from '../../components/Learning/Learning.interface';
import { LearningResourceCard } from '../../components/Learning/LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  DEFAULT_PAGE_SIZE,
  MAX_VISIBLE_CONTEXTS,
  MAX_VISIBLE_TAGS,
  PAGE_IDS,
} from '../../constants/Learning.constants';
import { LearningResource } from '../../rest/learningResourceAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { useLearningResourceActions } from './hooks/useLearningResourceActions';
import {
  LearningResourceFilterState,
  useLearningResourceFilters,
} from './hooks/useLearningResourceFilters';
import { useLearningResources } from './hooks/useLearningResources';
import { LearningResourceForm } from './LearningResourceForm.component';
import './LearningResourcesPage.less';

export const LearningResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [searchText, setSearchText] = useState('');
  const [filterState, setFilterState] = useState<LearningResourceFilterState>(
    {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  const { filteredResources, isLoading, refetch } = useLearningResources({
    searchText,
    filterState,
  });

  const {
    isFormOpen,
    isPlayerOpen,
    selectedResource,
    editingResource,
    handleCreate,
    handleEdit,
    handleDelete,
    handlePreview,
    handleFormClose,
    handlePlayerClose,
  } = useLearningResourceActions({ onRefetch: refetch });

  const { view, viewToggle } = useViewToggle({ defaultView: 'table' });
  const { search } = useSearch({
    searchPlaceholder: t('label.search-entity', {
      entity: t('label.resource'),
    }),
    onSearchChange: setSearchText,
    initialSearchQuery: searchText,
  });
  const { quickFilters, filterSelectionDisplay } = useLearningResourceFilters({
    filterState,
    onFilterChange: setFilterState,
  });

  const getResourceTypeIcon = useCallback((type: string) => {
    const icons: Record<
      string,
      React.ComponentType<React.SVGProps<SVGSVGElement>>
    > = {
      Video: VideoIcon,
      Storylane: StoryLaneIcon,
      Article: ArticleIcon,
    };
    const Icon = icons[type] ?? ArticleIcon;

    return (
      <div className={`type-icon-wrapper ${type.toLowerCase()}-icon`}>
        <Icon height={24} width={24} />
      </div>
    );
  }, []);

  const getCategoryColors = useCallback((category: string) => {
    const info =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return {
      bgColor: info?.bgColor ?? '#f8f9fc',
      borderColor: info?.borderColor ?? '#d5d9eb',
      color: info?.color ?? '#363f72',
    };
  }, []);

  const columns: ColumnsType<LearningResource> = useMemo(
    () => [
      {
        dataIndex: 'displayName',
        key: 'displayName',
        render: (_, record) => (
          <div
            className="content-name-cell"
            role="button"
            tabIndex={0}
            onClick={() => handlePreview(record)}
            onKeyDown={(e) => e.key === 'Enter' && handlePreview(record)}>
            {getResourceTypeIcon(record.resourceType)}
            <span className="content-name">
              {record.displayName || record.name}
            </span>
          </div>
        ),
        title: t('label.content-name'),
        width: 300,
      },
      {
        dataIndex: 'categories',
        key: 'categories',
        render: (categories: string[], record: LearningResource) => {
          if (!categories?.length) {
            return null;
          }
          const visible = categories.slice(0, MAX_VISIBLE_TAGS);
          const remaining = categories.length - MAX_VISIBLE_TAGS;

          return (
            <div className="category-tags">
              {visible.map((cat) => {
                const colors = getCategoryColors(cat);

                return (
                  <Tag
                    className="category-tag"
                    key={cat}
                    style={{
                      backgroundColor: colors.bgColor,
                      borderColor: colors.borderColor,
                      color: colors.color,
                    }}>
                    {LEARNING_CATEGORIES[
                      cat as keyof typeof LEARNING_CATEGORIES
                    ]?.label ?? cat}
                  </Tag>
                );
              })}
              {remaining > 0 && (
                <Tag
                  className="category-tag more-tag"
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(record);
                  }}>
                  +{remaining}
                </Tag>
              )}
            </div>
          );
        },
        title: t('label.category-plural'),
        width: 250,
      },
      {
        dataIndex: 'contexts',
        key: 'contexts',
        render: (
          contexts: Array<{ pageId: string; componentId?: string }>,
          record: LearningResource
        ) => {
          if (!contexts?.length) {
            return null;
          }
          const visible = contexts.slice(0, MAX_VISIBLE_CONTEXTS);
          const remaining = contexts.length - MAX_VISIBLE_CONTEXTS;
          const getContextLabel = (pageId: string) =>
            PAGE_IDS.find((c) => c.value === pageId)?.label ?? pageId;

          return (
            <div className="context-tags">
              {visible.map((ctx, idx) => (
                <Tag className="context-tag" key={`${ctx.pageId}-${idx}`}>
                  {getContextLabel(ctx.pageId)}
                </Tag>
              ))}
              {remaining > 0 && (
                <Tag
                  className="context-tag more-tag"
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(record);
                  }}>
                  +{remaining}
                </Tag>
              )}
            </div>
          );
        },
        title: t('label.context'),
        width: 200,
      },
      {
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (updatedAt: number) => (
          <Typography
            component="span"
            sx={{
              color: theme.palette.allShades?.gray?.[600],
              fontSize: 14,
            }}>
            {updatedAt
              ? DateTime.fromMillis(updatedAt).toFormat('LLL d, yyyy')
              : '-'}
          </Typography>
        ),
        title: t('label.updated-at'),
        width: 120,
      },
      {
        fixed: 'right',
        key: 'actions',
        render: (_, record) => (
          <Space align="center" size={8}>
            <Tooltip placement="topRight" title={t('label.edit')}>
              <Button
                className="learning-resource-action-btn"
                data-testid={`edit-${record.name}`}
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(record);
                }}>
                <IconEdit height={14} name={t('label.edit')} width={14} />
              </Button>
            </Tooltip>
            <Tooltip placement="topRight" title={t('label.delete')}>
              <Button
                className="learning-resource-action-btn"
                data-testid={`delete-${record.name}`}
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(record);
                }}>
                <Trash01 size={14} />
              </Button>
            </Tooltip>
          </Space>
        ),
        title: t('label.action-plural'),
        width: 80,
      },
    ],
    [
      t,
      theme,
      getResourceTypeIcon,
      getCategoryColors,
      handlePreview,
      handleEdit,
      handleDelete,
    ]
  );

  const totalFiltered = filteredResources.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;

  const paginatedResources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredResources.slice(start, start + pageSize);
  }, [filteredResources, currentPage, pageSize]);

  const { paginationControls } = usePaginationControls({
    currentPage,
    totalPages,
    totalEntities: totalFiltered,
    pageSize,
    onPageChange: setCurrentPage,
    loading: isLoading,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterState]);

  const breadcrumbs = useMemo(
    () => [
      { name: t('label.setting-plural'), url: getSettingPath() },
      {
        name: t('label.preference-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PREFERENCES),
      },
      { name: t('label.learning-resource'), url: '' },
    ],
    [t]
  );

  const tableContainerSx = useMemo(
    () => ({
      mb: 5,
      backgroundColor: 'background.paper',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column' as const,
      height: 'calc(100vh - 220px)',
      minHeight: 400,
    }),
    []
  );

  const headerBoxSx = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
      px: 6,
      py: 4,
      borderBottom: '1px solid',
      borderColor: theme.palette.allShades?.gray?.[200],
      flexShrink: 0,
    }),
    [theme]
  );

  const paginationBoxSx = useMemo(
    () => ({
      flexShrink: 0,
      backgroundColor: 'background.paper',
      borderTop: `1px solid ${theme.palette.allShades?.gray?.[200]}`,
      boxShadow:
        '0px -13px 16px -4px rgba(10, 13, 18, 0.04), 0px -4px 6px -2px rgba(10, 13, 18, 0.04)',
      zIndex: 1,
    }),
    [theme]
  );

  const renderCardView = useCallback(
    () => (
      <>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            px: 6,
            py: 4,
          }}>
          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 8,
              }}>
              <Loader />
            </Box>
          ) : isEmpty(paginatedResources) ? (
            <Box
              sx={{
                textAlign: 'center',
                margin: '16px 24px',
                padding: '9px 0',
              }}>
              {t('server.no-records-found')}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
              }}>
              {paginatedResources.map((resource) => (
                <LearningResourceCard
                  key={resource.id}
                  resource={resource}
                  onClick={handlePreview}
                />
              ))}
            </Box>
          )}
        </Box>
        <Box sx={paginationBoxSx}>{paginationControls}</Box>
      </>
    ),
    [
      isLoading,
      paginatedResources,
      handlePreview,
      paginationControls,
      paginationBoxSx,
      t,
    ]
  );

  const renderTableView = useCallback(
    () => (
      <>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Table
            columns={columns}
            dataSource={paginatedResources}
            loading={isLoading}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1000, y: 'calc(100vh - 420px)' }}
          />
        </Box>
        <Box sx={paginationBoxSx}>{paginationControls}</Box>
      </>
    ),
    [
      columns,
      paginatedResources,
      isLoading,
      paginationControls,
      paginationBoxSx,
    ]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.learning-resource')}>
      <div
        className="learning-resources-page"
        data-testid="learning-resources-page">
        <TitleBreadcrumb titleLinks={breadcrumbs} />

        <div className="page-header">
          <div className="page-header-title">
            <h4 className="page-title" data-testid="page-title">
              {t('label.learning-resource')}
            </h4>
            <p className="page-description">
              {t('message.learning-resources-management-description')}
            </p>
          </div>
          <Button
            data-testid="create-resource"
            icon={<PlusOutlined />}
            type="primary"
            onClick={handleCreate}>
            {t('label.add-entity', { entity: t('label.resource') })}
          </Button>
        </div>

        <TableContainer component={Paper} sx={tableContainerSx}>
          <Box sx={headerBoxSx}>
            <Box
              sx={{
                display: 'flex',
                gap: 5,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
              {search}
              {quickFilters}
              <Box ml="auto" />
              {viewToggle}
            </Box>
            {filterSelectionDisplay}
          </Box>
          {view === 'table' ? (
            <Box
              data-testid="table-view-container"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}>
              {renderTableView()}
            </Box>
          ) : (
            <Box
              data-testid="card-view-container"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}>
              {renderCardView()}
            </Box>
          )}
        </TableContainer>

        {isFormOpen && (
          <LearningResourceForm
            open={isFormOpen}
            resource={editingResource}
            onClose={handleFormClose}
          />
        )}

        {selectedResource && (
          <ResourcePlayerModal
            open={isPlayerOpen}
            resource={selectedResource}
            onClose={handlePlayerClose}
          />
        )}
      </div>
    </PageLayoutV1>
  );
};
