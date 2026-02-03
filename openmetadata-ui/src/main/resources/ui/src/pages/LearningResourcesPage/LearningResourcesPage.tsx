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
import { Box, Paper, TableContainer, useTheme } from '@mui/material';
import { Trash01 } from '@untitledui/icons';
import { Button, Modal, Space, Table, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArticalIcon } from '../../assets/svg/artical.svg';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/story-lane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/video.svg';
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
import {
  deleteLearningResource,
  getLearningResourcesList,
  LearningResource,
} from '../../rest/learningResourceAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useLearningResourceFilters } from './hooks/useLearningResourceFilters';
import { LearningResourceForm } from './LearningResourceForm.component';
import './LearningResourcesPage.less';

export const LearningResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<LearningResource | null>(null);
  const [editingResource, setEditingResource] =
    useState<LearningResource | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterState, setFilterState] = useState<{
    type?: string;
    category?: string;
    context?: string;
    status?: string;
  }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

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

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getLearningResourcesList({
        limit: 100,
        fields: 'categories,contexts,difficulty,estimatedDuration,owners',
      });
      setResources(response.data || []);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.learning-resources-fetch-error')
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchText,
    filterState.type,
    filterState.category,
    filterState.context,
    filterState.status,
  ]);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch =
        !searchText ||
        resource.name.toLowerCase().includes(searchText.toLowerCase()) ||
        resource.displayName?.toLowerCase().includes(searchText.toLowerCase());

      const matchesType =
        !filterState.type || resource.resourceType === filterState.type;
      const matchesCategory =
        !filterState.category ||
        resource.categories?.includes(
          filterState.category as
            | 'Discovery'
            | 'Administration'
            | 'DataGovernance'
            | 'DataQuality'
            | 'Observability'
        );
      const matchesContent =
        !filterState.context ||
        resource.contexts?.some((ctx) => ctx.pageId === filterState.context);
      const matchesStatus =
        !filterState.status ||
        (resource.status || 'Active') === filterState.status;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesContent &&
        matchesStatus
      );
    });
  }, [resources, searchText, filterState]);

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

  const handleCreate = useCallback(() => {
    setEditingResource(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((resource: LearningResource) => {
    setEditingResource(resource);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (resource: LearningResource) => {
      Modal.confirm({
        centered: true,
        content: t('message.are-you-sure-delete-entity', {
          entity: resource.displayName || resource.name,
        }),
        okText: t('label.delete'),
        okType: 'danger',
        title: t('label.delete-entity', {
          entity: t('label.learning-resource'),
        }),
        onOk: async () => {
          try {
            await deleteLearningResource(resource.id);
            showSuccessToast(
              t('server.entity-deleted-successfully', {
                entity: t('label.learning-resource'),
              })
            );
            fetchResources();
          } catch (error) {
            showErrorToast(error as AxiosError);
          }
        },
      });
    },
    [t, fetchResources]
  );

  const handlePreview = useCallback((resource: LearningResource) => {
    setSelectedResource(resource);
    setIsPlayerOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingResource(null);
    fetchResources();
  }, [fetchResources]);

  const handlePlayerClose = useCallback(() => {
    setIsPlayerOpen(false);
    setSelectedResource(null);
  }, []);

  const getResourceTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'Video':
        return (
          <div className="type-icon-wrapper video-icon">
            <VideoIcon />
          </div>
        );
      case 'Storylane':
        return (
          <div className="type-icon-wrapper storylane-icon">
            <StoryLaneIcon />
          </div>
        );
      case 'Article':
        return (
          <div className="type-icon-wrapper article-icon">
            <ArticalIcon />
          </div>
        );
      default:
        return (
          <div className="type-icon-wrapper article-icon">
            <ArticalIcon />
          </div>
        );
    }
  }, []);

  const getCategoryColors = useCallback((category: string) => {
    const categoryInfo =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return {
      bgColor: categoryInfo?.bgColor ?? '#f8f9fc',
      borderColor: categoryInfo?.borderColor ?? '#d5d9eb',
      color: categoryInfo?.color ?? '#363f72',
    };
  }, []);

  const breadcrumbs = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.preference-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PREFERENCES),
      },
      {
        name: t('label.learning-resource'),
        url: '',
      },
    ],
    [t]
  );

  const columns: ColumnsType<LearningResource> = [
    {
      dataIndex: 'displayName',
      key: 'displayName',
      render: (_, record) => (
        <div
          className="content-name-cell"
          onClick={() => handlePreview(record)}>
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
      render: (categories: string[]) => {
        if (!categories || categories.length === 0) {
          return null;
        }
        const visibleCategories = categories.slice(0, MAX_VISIBLE_TAGS);
        const remaining = categories.length - MAX_VISIBLE_TAGS;

        return (
          <div className="category-tags">
            {visibleCategories.map((cat) => {
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
                  {LEARNING_CATEGORIES[cat as keyof typeof LEARNING_CATEGORIES]
                    ?.label ?? cat}
                </Tag>
              );
            })}
            {remaining > 0 && (
              <Tag className="category-tag more-tag">+{remaining}</Tag>
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
      render: (contexts: Array<{ pageId: string; componentId?: string }>) => {
        if (!contexts || contexts.length === 0) {
          return null;
        }
        const visibleContexts = contexts.slice(0, MAX_VISIBLE_CONTEXTS);
        const remaining = contexts.length - MAX_VISIBLE_CONTEXTS;

        const getContextLabel = (pageId: string) => {
          const context = PAGE_IDS.find((c) => c.value === pageId);

          return context?.label ?? pageId;
        };

        return (
          <div className="context-tags">
            {visibleContexts.map((ctx, idx) => (
              <Tag className="context-tag" key={idx}>
                {getContextLabel(ctx.pageId)}
              </Tag>
            ))}
            {remaining > 0 && (
              <Tag className="context-tag more-tag">+{remaining}</Tag>
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
      render: (updatedAt: number) => {
        if (!updatedAt) {
          return '-';
        }

        return DateTime.fromMillis(updatedAt).toFormat('LLL d, yyyy');
      },
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
              className="p-0 flex-center"
              data-testid={`edit-${record.name}`}
              size="small"
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
              className="p-0 flex-center"
              data-testid={`delete-${record.name}`}
              size="small"
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
  ];

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

        <TableContainer
          component={Paper}
          sx={{
            mb: 5,
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              px: 6,
              py: 4,
              borderBottom: `1px solid`,
              borderColor: theme.palette.allShades?.gray?.[200],
            }}>
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
            <Box data-testid="table-view-container">
              <Table
                columns={columns}
                dataSource={paginatedResources}
                loading={isLoading}
                pagination={false}
                rowKey="id"
                scroll={{ x: 1000, y: 'calc(100vh - 320px)' }}
              />
              {paginationControls}
            </Box>
          ) : (
            <Box data-testid="card-view-container" sx={{ minHeight: 200 }}>
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
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 4,
                    m: 6,
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
              {paginationControls}
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
