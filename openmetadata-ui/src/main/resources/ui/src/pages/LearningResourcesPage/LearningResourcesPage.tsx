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
  EditOutlined,
  FileTextOutlined,
  MenuOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Input, Modal, Select, Space, Table, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { LEARNING_CATEGORIES } from '../../components/Learning/Learning.interface';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  deleteLearningResource,
  getLearningResourcesList,
  LearningResource,
} from '../../rest/learningResourceAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { LearningResourceForm } from './LearningResourceForm.component';
import './LearningResourcesPage.less';

const RESOURCE_TYPES = ['Article', 'Video', 'Storylane'];
const CATEGORIES = [
  'Discovery',
  'Administration',
  'DataGovernance',
  'DataQuality',
  'Observability',
];
const STATUSES = ['Draft', 'Active', 'Deprecated'];
const MAX_VISIBLE_TAGS = 2;
const MAX_VISIBLE_CONTEXTS = 3;

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
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

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
      const matchesStatus =
        !filterStatus || (resource.status || 'Active') === filterStatus;

      return matchesSearch && matchesType && matchesCategory && matchesStatus;
    });
  }, [resources, searchText, filterType, filterCategory, filterStatus]);

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
        return <PlayCircleOutlined className="type-icon video-icon" />;
      case 'Storylane':
        return <RocketOutlined className="type-icon storylane-icon" />;
      case 'Article':
        return <FileTextOutlined className="type-icon article-icon" />;
      default:
        return <FileTextOutlined className="type-icon article-icon" />;
    }
  }, []);

  const getCategoryColor = useCallback((category: string) => {
    const categoryInfo =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return categoryInfo?.color ?? '#1890ff';
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
            {visibleCategories.map((cat) => (
              <Tag
                className="category-tag"
                key={cat}
                style={{
                  backgroundColor: `${getCategoryColor(cat)}15`,
                  borderColor: getCategoryColor(cat),
                  color: getCategoryColor(cat),
                }}>
                {LEARNING_CATEGORIES[cat as keyof typeof LEARNING_CATEGORIES]
                  ?.label ?? cat}
              </Tag>
            ))}
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

        return (
          <div className="context-tags">
            {visibleContexts.map((ctx, idx) => (
              <Tag className="context-tag" key={idx}>
                {ctx.pageId}
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
    <div className="learning-resources-page">
      <TitleBreadcrumb titleLinks={breadcrumbs} />

      <div className="page-header">
        <div className="page-header-title">
          <h4 className="page-title">{t('label.learning-resource')}</h4>
          <p className="page-description">
            {t('message.learning-resource-page-description')}
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
          options={RESOURCE_TYPES.map((type) => ({
            label: type,
            value: type,
          }))}
          placeholder={t('label.type')}
          value={filterType}
          onChange={setFilterType}
        />

        <Select
          allowClear
          className="filter-select"
          options={CATEGORIES.map((cat) => ({
            label:
              LEARNING_CATEGORIES[cat as keyof typeof LEARNING_CATEGORIES]
                ?.label ?? cat,
            value: cat,
          }))}
          placeholder={t('label.category')}
          value={filterCategory}
          onChange={setFilterCategory}
        />

        <Select
          allowClear
          className="filter-select"
          options={STATUSES.map((status) => ({
            label: status,
            value: status,
          }))}
          placeholder={t('label.status')}
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
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        rowKey="id"
        scroll={{ x: 1000 }}
      />

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
  );
};
