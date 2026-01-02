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
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import {
  deleteLearningResource,
  getLearningResourcesList,
  LearningResource,
} from '../../rest/learningResourceAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { LearningResourceForm } from './LearningResourceForm.component';
import './LearningResourcesPage.less';

const { Title } = Typography;

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

  const columns: ColumnsType<LearningResource> = [
    {
      dataIndex: 'displayName',
      key: 'displayName',
      render: (_, record) => record.displayName || record.name,
      title: t('label.name'),
      width: 250,
    },
    {
      dataIndex: 'resourceType',
      key: 'resourceType',
      render: (type) => <Tag>{type}</Tag>,
      title: t('label.type'),
      width: 120,
    },
    {
      dataIndex: 'categories',
      key: 'categories',
      render: (categories: string[]) => (
        <Space wrap size={4}>
          {categories?.map((cat) => (
            <Tag key={cat}>{cat}</Tag>
          ))}
        </Space>
      ),
      title: t('label.category-plural'),
      width: 200,
    },
    {
      dataIndex: 'contexts',
      key: 'contexts',
      render: (contexts: Array<{ pageId: string; componentId?: string }>) => (
        <Space wrap size={4}>
          {contexts?.map((ctx, idx) => (
            <Tag key={idx}>
              {ctx.pageId}
              {ctx.componentId ? `:${ctx.componentId}` : ''}
            </Tag>
          ))}
        </Space>
      ),
      title: t('label.context'),
      width: 200,
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'success' : 'default'}>
          {status || 'Active'}
        </Tag>
      ),
      title: t('label.status'),
      width: 100,
    },
    {
      fixed: 'right',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('label.preview')}>
            <Button
              ghost
              data-testid={`preview-${record.name}`}
              icon={<EyeOutlined />}
              size="small"
              type="primary"
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title={t('label.edit')}>
            <Button
              data-testid={`edit-${record.name}`}
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={t('label.delete')}>
            <Button
              danger
              data-testid={`delete-${record.name}`}
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
      title: t('label.action-plural'),
      width: 150,
    },
  ];

  return (
    <div className="learning-resources-page">
      <Card>
        <div className="page-header">
          <Title level={3}>{t('label.learning-resources')}</Title>
          <Button
            data-testid="create-resource"
            icon={<PlusOutlined />}
            type="primary"
            onClick={handleCreate}>
            {t('label.add-entity', { entity: t('label.resource') })}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={resources}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} ${t('label.resource-plural')}`,
          }}
          rowKey="id"
          scroll={{ x: 1200 }}
        />
      </Card>

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
