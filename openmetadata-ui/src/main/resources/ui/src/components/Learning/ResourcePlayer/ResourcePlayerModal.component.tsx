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

import { ClockCircleOutlined } from '@ant-design/icons';
import { Button, Modal, Space, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleViewer } from './ArticleViewer.component';
import { ResourcePlayerModalProps } from './ResourcePlayerModal.interface';
import './ResourcePlayerModal.less';
import { StorylaneTour } from './StorylaneTour.component';
import { VideoPlayer } from './VideoPlayer.component';

const { Title, Text } = Typography;

export const ResourcePlayerModal: React.FC<ResourcePlayerModalProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();

  const formattedDuration = useMemo(() => {
    if (!resource.estimatedDuration) {
      return null;
    }
    const minutes = Math.floor(resource.estimatedDuration / 60);
    const seconds = resource.estimatedDuration % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  }, [resource.estimatedDuration]);

  const renderPlayer = useMemo(() => {
    switch (resource.resourceType) {
      case 'Video':
        return <VideoPlayer resource={resource} />;
      case 'Storylane':
        return <StorylaneTour resource={resource} />;
      case 'Article':
        return <ArticleViewer resource={resource} />;
      default:
        return <div>{t('message.unsupported-resource-type')}</div>;
    }
  }, [resource, t]);

  return (
    <Modal
      centered
      destroyOnClose
      className="resource-player-modal"
      footer={<Button onClick={onClose}>{t('label.close')}</Button>}
      open={open}
      title={
        <Space direction="vertical" size="small">
          <Title level={4}>{resource.displayName || resource.name}</Title>
          <Space wrap size="small">
            {resource.difficulty && (
              <Tag color="blue">{resource.difficulty}</Tag>
            )}
            {formattedDuration && (
              <Tag icon={<ClockCircleOutlined />}>{formattedDuration}</Tag>
            )}
          </Space>
          {resource.description && (
            <Text type="secondary">{resource.description}</Text>
          )}
        </Space>
      }
      width="90%"
      onCancel={onClose}>
      <div className="resource-player-content">{renderPlayer}</div>
    </Modal>
  );
};
