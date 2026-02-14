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
import { Drawer, Empty, Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLearningResourcesByContext,
  LearningResource,
} from '../../../rest/learningResourceAPI';
import { LearningResourceCard } from '../LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../ResourcePlayer/ResourcePlayerModal.component';
import './learning-drawer.less';
import { LearningDrawerProps } from './LearningDrawer.interface';

const { Title } = Typography;

export const LearningDrawer: React.FC<LearningDrawerProps> = ({
  open,
  pageId,
  title,
  onClose,
}) => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<LearningResource | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const fetchResources = useCallback(async () => {
    if (!open || !pageId) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 50,
        fields: 'categories,contexts,difficulty,estimatedDuration',
      });
      setResources(response.data || []);
    } catch {
      setHasError(true);
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, [open, pageId]);

  useEffect(() => {
    if (open) {
      fetchResources();
    }
  }, [open, fetchResources]);

  const handleResourceClick = useCallback(
    (resource: LearningResource) => {
      setSelectedResource(resource);
      setPlayerOpen(true);
      onClose();
    },
    [onClose]
  );

  const handlePlayerClose = useCallback(() => {
    setPlayerOpen(false);
    setSelectedResource(null);
  }, []);

  const getPageTitle = useCallback(() => {
    if (title) {
      return title;
    }

    const titleMap: Record<string, string> = {
      glossary: t('label.glossary'),
      glossaryTerm: t('label.glossary-term'),
      domain: t('label.domain'),
      dataProduct: t('label.data-product'),
      dataQuality: t('label.data-quality'),
    };

    return titleMap[pageId] || pageId;
  }, [pageId, title, t]);

  return (
    <>
      <Drawer
        destroyOnClose
        className="learning-drawer"
        closable={false}
        data-testid="learning-drawer"
        open={open}
        placement="right"
        title={
          <div className="learning-drawer-header">
            <Title className="learning-drawer-title" level={5}>
              {t('label.entity-resource', { entity: getPageTitle() })}
            </Title>
            <CloseOutlined
              className="learning-drawer-close"
              data-testid="close-drawer"
              onClick={onClose}
            />
          </div>
        }
        width={576}
        onClose={onClose}>
        <div className="learning-drawer-content">
          {isLoading ? (
            <div className="learning-drawer-loading">
              <Spin
                data-testid="loader"
                indicator={<LoadingOutlined spin style={{ fontSize: 24 }} />}
              />
            </div>
          ) : hasError ? (
            <Empty
              description={t('message.failed-to-load-learning-resources')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : resources.length === 0 ? (
            <Empty
              description={t('message.no-learning-resources-available')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="learning-drawer-cards">
              {resources.map((resource) => (
                <LearningResourceCard
                  key={resource.id}
                  resource={resource}
                  onClick={handleResourceClick}
                />
              ))}
            </div>
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
