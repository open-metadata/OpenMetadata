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
  ClockCircleOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { Card, Progress, Space, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import { LearningResourceCardProps } from './LearningResourceCard.interface';
import './LearningResourceCard.less';

const { Text, Paragraph } = Typography;

export const LearningResourceCard: React.FC<LearningResourceCardProps> = ({
  resource,
  showProgress = false,
  onClick,
}) => {
  const resourceTypeIcon = useMemo(() => {
    switch (resource.resourceType) {
      case 'Video':
        return <PlayCircleOutlined />;
      case 'Storylane':
        return <RocketOutlined />;
      case 'Article':
        return <FileTextOutlined />;
      default:
        return <FileTextOutlined />;
    }
  }, [resource.resourceType]);

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

  const categoryInfo = useMemo(() => {
    if (resource.categories && resource.categories.length > 0) {
      return LEARNING_CATEGORIES[
        resource.categories[0] as keyof typeof LEARNING_CATEGORIES
      ];
    }

    return null;
  }, [resource.categories]);

  return (
    <Card
      className="learning-resource-card"
      data-testid={`learning-resource-card-${resource.name}`}
      hoverable={!!onClick}
      onClick={() => onClick?.(resource)}>
      <Space className="w-full" direction="vertical" size="small">
        <div className="learning-resource-header">
          <Space size="small">
            <span className="resource-type-icon">{resourceTypeIcon}</span>
            <Text strong>{resource.displayName || resource.name}</Text>
          </Space>
        </div>

        {resource.description && (
          <Paragraph
            className="learning-resource-description"
            ellipsis={{ rows: 2 }}>
            {resource.description}
          </Paragraph>
        )}

        <Space wrap className="learning-resource-meta" size="small">
          {resource.difficulty && <Tag>{resource.difficulty}</Tag>}
          {categoryInfo && <Tag>{categoryInfo.label}</Tag>}
          {formattedDuration && (
            <Tag icon={<ClockCircleOutlined />}>{formattedDuration}</Tag>
          )}
        </Space>

        {showProgress && resource.progress && (
          <div className="learning-resource-progress">
            <Progress
              percent={Math.round(resource.progress.progressPercent || 0)}
              size="small"
              status={
                resource.progress.status === 'Completed' ? 'success' : 'active'
              }
            />
          </div>
        )}
      </Space>
    </Card>
  );
};
