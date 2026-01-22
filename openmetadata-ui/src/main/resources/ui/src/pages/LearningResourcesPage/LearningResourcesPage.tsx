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

import {
  AppstoreOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  MenuOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Input, Modal, Select, Space, Table, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArticalIcon } from '../../assets/svg/artical.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/story-lane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/video.svg';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { LEARNING_CATEGORIES } from '../../components/Learning/Learning.interface';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  CATEGORIES,
  DEFAULT_PAGE_SIZE,
  LEARNING_RESOURCE_STATUSES,
  MAX_VISIBLE_CONTEXTS,
  MAX_VISIBLE_TAGS,
  PAGE_IDS,
  RESOURCE_TYPE_VALUES,
} from '../../constants/Learning.constants';
import {
  deleteLearningResource,
  getLearningResourcesList,
  LearningResource,
} from '../../rest/learningResourceAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { LearningResourceForm } from './LearningResourceForm.component';
import './LearningResourcesPage.less';

export const LearningResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<LearningResource | null>(null);
  const [editingResource, setEditingResource] =
    useState<LearningResource | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterContent, setFilterContent] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

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

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch =
        !searchText ||
        resource.name.toLowerCase().includes(searchText.toLowerCase()) ||
        resource.displayName?.toLowerCase().includes(searchText.toLowerCase());

      const matchesType = !filterType || resource.resourceType === filterType;
      const matchesCategory =
        !filterCategory ||
        resource.categories?.includes(
          filterCategory as
            | 'Discovery'
            | 'Administration'
            | 'DataGovernance'
            | 'DataQuality'
            | 'Observability'
        );
      const matchesContent =
        !filterContent ||
        resource.contexts?.some((ctx) => ctx.pageId === filterContent);
      const matchesStatus =
        !filterStatus || (resource.status || 'Active') === filterStatus;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesContent &&
        matchesStatus
      );
    });
  }, [
    resources,
    searchText,
    filterType,
    filterCategory,
    filterContent,
    filterStatus,
  ]);

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
              t('message.entity-deleted-successfully', {
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
        <Space className="action-buttons" size="small">
          <Tooltip title={t('label.edit')}>
            <Button
              className="action-btn"
              data-testid={`edit-${record.name}`}
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(record);
              }}
            />
          </Tooltip>
          <Tooltip title={t('label.delete')}>
            <Button
              className="action-btn delete-btn"
              data-testid={`delete-${record.name}`}
              icon={<DeleteOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(record);
              }}
            />
          </Tooltip>
        </Space>
      ),
      title: t('label.more-action'),
      width: 100,
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

        <div className="content-card">
          <div className="filter-bar">
            <Input
              allowClear
              className="search-input"
              placeholder={t('label.search-entity', {
                entity: t('label.resource'),
              })}
              prefix={<SearchOutlined className="search-icon" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />

            <Select
              allowClear
              className="filter-select"
              dropdownStyle={{ minWidth: 120 }}
              options={RESOURCE_TYPE_VALUES.map((type) => ({
                label: type,
                value: type,
              }))}
              placeholder={t('label.type')}
              suffixIcon={<DownOutlined className="filter-arrow" />}
              value={filterType}
              onChange={setFilterType}
            />

            <Select
              allowClear
              className="filter-select"
              dropdownStyle={{ minWidth: 140 }}
              options={CATEGORIES.map((cat) => ({
                label: cat.label,
                value: cat.value,
              }))}
              placeholder={t('label.category')}
              suffixIcon={<DownOutlined className="filter-arrow" />}
              value={filterCategory}
              onChange={setFilterCategory}
            />

            <Select
              allowClear
              className="filter-select"
              dropdownStyle={{ minWidth: 160 }}
              options={PAGE_IDS}
              placeholder={t('label.context')}
              suffixIcon={<DownOutlined className="filter-arrow" />}
              value={filterContent}
              onChange={setFilterContent}
            />

            <Select
              allowClear
              className="filter-select"
              dropdownStyle={{ minWidth: 120 }}
              options={LEARNING_RESOURCE_STATUSES.map((status) => ({
                label: status,
                value: status,
              }))}
              placeholder={t('label.status')}
              suffixIcon={<DownOutlined className="filter-arrow" />}
              value={filterStatus}
              onChange={setFilterStatus}
            />

            <div className="view-toggle">
              <Button
                className={viewMode === 'list' ? 'active' : ''}
                icon={<MenuOutlined />}
                type="text"
                onClick={() => setViewMode('list')}
              />
              <Button
                className={viewMode === 'card' ? 'active' : ''}
                icon={<AppstoreOutlined />}
                type="text"
                onClick={() => setViewMode('card')}
              />
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={filteredResources}
            loading={isLoading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              showSizeChanger: false,
              onChange: (page: number) => {
                setCurrentPage(page);
              },
            }}
            rowKey="id"
            scroll={{ x: 1000 }}
          />
        </div>

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
