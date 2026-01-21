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

import { Tag, Typography } from 'antd';
import classNames from 'classnames';
import { DateTime } from 'luxon';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArticalIcon } from '../../../assets/svg/artical.svg';
import { ReactComponent as StoryLaneIcon } from '../../../assets/svg/story-lane.svg';
import { ReactComponent as VideoIcon } from '../../../assets/svg/video.svg';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import './learning-resource-card.style.less';
import { LearningResourceCardProps } from './LearningResourceCard.interface';

const { Text, Paragraph, Link } = Typography;

const MAX_VISIBLE_TAGS = 3;

export const LearningResourceCard: React.FC<LearningResourceCardProps> = ({
  resource,
  onClick,
}) => {
  const { t } = useTranslation();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  const resourceTypeIcon = useMemo(() => {
    switch (resource.resourceType) {
      case 'Video':
        return <VideoIcon className="resource-type-icon video-icon" />;
      case 'Storylane':
        return <StoryLaneIcon className="resource-type-icon storylane-icon" />;
      case 'Article':
        return <ArticalIcon className="resource-type-icon article-icon" />;
      default:
        return <ArticalIcon className="resource-type-icon article-icon" />;
    }
  }, [resource.resourceType]);

  const formattedDuration = useMemo(() => {
    if (!resource.estimatedDuration) {
      return null;
    }
    const minutes = Math.floor(resource.estimatedDuration / 60);

    return `${minutes} ${t('label.min-read')}`;
  }, [resource.estimatedDuration, t]);

  const formattedDate = useMemo(() => {
    if (!resource.updatedAt) {
      return null;
    }

    return DateTime.fromMillis(resource.updatedAt).toFormat('LLL dd, yyyy');
  }, [resource.updatedAt]);

  const categoryTags = useMemo(() => {
    if (!resource.categories || resource.categories.length === 0) {
      return { visible: [], remaining: 0 };
    }

    const visible = resource.categories.slice(0, MAX_VISIBLE_TAGS);
    const remaining = resource.categories.length - MAX_VISIBLE_TAGS;

    return { visible, remaining };
  }, [resource.categories]);

  const getCategoryColor = (category: string) => {
    const categoryInfo =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return categoryInfo?.color ?? '#1890ff';
  };

  const handleViewMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };

  return (
    <div
      className={classNames('learning-resource-card', {
        'learning-resource-card-clickable': !!onClick,
      })}
      data-testid={`learning-resource-card-${resource.name}`}
      onClick={() => onClick?.(resource)}>
      <div className="learning-resource-content">
        <div className="learning-resource-header">
          {resourceTypeIcon}
          <Text strong className="learning-resource-title">
            {resource.displayName || resource.name}
          </Text>
        </div>

        {resource.description && (
          <div className="learning-resource-description-container">
            <Paragraph
              className="learning-resource-description"
              ellipsis={
                isDescriptionExpanded
                  ? false
                  : { rows: 2, onEllipsis: setIsDescriptionTruncated }
              }>
              {resource.description}
            </Paragraph>
            {(isDescriptionTruncated || isDescriptionExpanded) && (
              <Link className="view-more-link" onClick={handleViewMoreClick}>
                {isDescriptionExpanded
                  ? t('label.view-less')
                  : t('label.view-more')}
              </Link>
            )}
          </div>
        )}

        <div className="learning-resource-footer">
          <div className="learning-resource-tags">
            {categoryTags.visible.map((category) => (
              <Tag
                className="category-tag"
                key={category}
                style={{
                  backgroundColor: `${getCategoryColor(category)}15`,
                  borderColor: getCategoryColor(category),
                  color: getCategoryColor(category),
                }}>
                {LEARNING_CATEGORIES[
                  category as keyof typeof LEARNING_CATEGORIES
                ]?.label ?? category}
              </Tag>
            ))}
            {categoryTags.remaining > 0 && (
              <Tag className="category-tag more-tag">
                +{categoryTags.remaining}
              </Tag>
            )}
          </div>

          <div className="learning-resource-meta">
            {formattedDate && (
              <Text className="meta-text" type="secondary">
                {formattedDate}
              </Text>
            )}
            {formattedDate && formattedDuration && (
              <span className="meta-separator">|</span>
            )}
            {formattedDuration && (
              <Text className="meta-text" type="secondary">
                {formattedDuration}
              </Text>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
