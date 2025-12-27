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

import { CloseOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty, Space, Spin, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLearningResourcesByContext,
  LearningResource,
} from '../../../rest/learningResourceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { LearningResourceCard } from '../LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../ResourcePlayer/ResourcePlayerModal.component';
import { LearningDrawerProps } from './LearningDrawer.interface';
import './LearningDrawer.less';

const { Title, Text } = Typography;

export const LearningDrawer: React.FC<LearningDrawerProps> = ({
  open,
  pageId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<LearningResource | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const fetchResources = useCallback(async () => {
    if (!open || !pageId) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 50,
        fields: 'categories,contexts,difficulty,estimatedDuration',
      });
      setResources(response.data || []);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.learning-resources-fetch-error')
      );
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, [open, pageId, t]);

  useEffect(() => {
    if (open) {
      fetchResources();
    }
  }, [open, fetchResources]);

  const handleResourceClick = useCallback((resource: LearningResource) => {
    setSelectedResource(resource);
    setPlayerOpen(true);
  }, []);

  const handlePlayerClose = useCallback(() => {
    setPlayerOpen(false);
    setSelectedResource(null);
  }, []);

  const getPageTitle = useCallback(() => {
    const titleMap: Record<string, string> = {
      glossary: t('label.glossary'),
      glossaryTerm: t('label.glossary-term'),
      domain: t('label.domain'),
      dataProduct: t('label.data-product'),
      dataQuality: t('label.data-quality'),
      observability: t('label.observability'),
      governance: t('label.governance'),
      discovery: t('label.discovery'),
      administration: t('label.administration'),
    };

    return titleMap[pageId] || pageId;
  }, [pageId, t]);

  return (
    <>
      <Drawer
        destroyOnClose
        className="learning-drawer"
        closable={false}
        open={open}
        placement="right"
        title={
          <Space align="start" className="w-full" size="middle">
            <div className="flex-1">
              <Title level={4}>
                {t('label.learning-resources-for', {
                  context: getPageTitle(),
                })}
              </Title>
              {resources.length > 0 && (
                <Text type="secondary">
                  {t('message.resources-available', {
                    count: resources.length,
                  })}
                </Text>
              )}
            </div>
            <Button
              data-testid="close-drawer"
              icon={<CloseOutlined />}
              size="small"
              type="text"
              onClick={onClose}
            />
          </Space>
        }
        width={480}
        onClose={onClose}>
        <div className="learning-drawer-content">
          {isLoading ? (
            <div className="learning-drawer-loading">
              <Spin
                indicator={<LoadingOutlined spin style={{ fontSize: 24 }} />}
                tip={t('label.loading')}
              />
            </div>
          ) : resources.length === 0 ? (
            <Empty
              description={t('message.no-learning-resources-available')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Space className="w-full" direction="vertical" size="middle">
              {resources.map((resource) => (
                <LearningResourceCard
                  key={resource.id}
                  resource={resource}
                  onClick={() => handleResourceClick(resource)}
                />
              ))}
            </Space>
          )}
        </div>
      </Drawer>

      {selectedResource && (
        <ResourcePlayerModal
          open={playerOpen}
          resource={selectedResource}
          onClose={handlePlayerClose}
        />
      )}
    </>
  );
};
