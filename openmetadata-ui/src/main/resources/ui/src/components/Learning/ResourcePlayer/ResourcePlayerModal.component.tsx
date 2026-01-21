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
  CloseOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import { Button, Modal, Tag, Typography } from 'antd';
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import { ArticleViewer } from './ArticleViewer.component';
import './resource-player-modal.style.less';
import { ResourcePlayerModalProps } from './ResourcePlayerModal.interface';
import { StorylaneTour } from './StorylaneTour.component';
import { VideoPlayer } from './VideoPlayer.component';

const { Link, Paragraph, Text } = Typography;

const MAX_VISIBLE_TAGS = 3;

export const ResourcePlayerModal: React.FC<ResourcePlayerModalProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  const formattedDuration = useMemo(() => {
    if (!resource.estimatedDuration) {
      return null;
    }
    const minutes = Math.floor(resource.estimatedDuration / 60);

    return `${minutes} ${t('label.min-watch')}`;
  }, [resource.estimatedDuration, t]);

  const formattedDate = useMemo(() => {
    if (!resource.updatedAt) {
      return null;
    }

    return DateTime.fromMillis(resource.updatedAt).toFormat('LLL d, yyyy');
  }, [resource.updatedAt]);

  const categoryTags = useMemo(() => {
    if (!resource.categories || resource.categories.length === 0) {
      return { visible: [], remaining: 0 };
    }

    const visible = resource.categories.slice(0, MAX_VISIBLE_TAGS);
    const remaining = resource.categories.length - MAX_VISIBLE_TAGS;

    return { visible, remaining };
  }, [resource.categories]);

  const getCategoryColors = useCallback((category: string) => {
    const categoryInfo =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return {
      bgColor: categoryInfo?.bgColor ?? '#f8f9fc',
      borderColor: categoryInfo?.borderColor ?? '#d5d9eb',
      color: categoryInfo?.color ?? '#363f72',
    };
  }, []);

  const handleViewMoreClick = useCallback(() => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  }, [isDescriptionExpanded]);

  const handleFullScreenToggle = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

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
      className={`resource-player-modal ${isFullScreen ? 'fullscreen' : ''}`}
      closable={false}
      footer={null}
      open={open}
      width={isFullScreen ? '100vw' : '1143px'}
      onCancel={onClose}>
      <div className="resource-player-header">
        <div className="resource-player-info">
          <Text strong className="resource-title">
            {resource.displayName || resource.name}
          </Text>

          {resource.description && (
            <div className="resource-description-container">
              <Paragraph
                className="resource-description"
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

          <div className="resource-meta-row">
            <div className="resource-tags">
              {categoryTags.visible.map((category) => {
                const colors = getCategoryColors(category);

                return (
                  <Tag
                    className="category-tag"
                    key={category}
                    style={{
                      backgroundColor: colors.bgColor,
                      borderColor: colors.borderColor,
                      color: colors.color,
                    }}>
                    {LEARNING_CATEGORIES[
                      category as keyof typeof LEARNING_CATEGORIES
                    ]?.label ?? category}
                  </Tag>
                );
              })}
              {categoryTags.remaining > 0 && (
                <Tag className="category-tag more-tag">
                  +{categoryTags.remaining}
                </Tag>
              )}
            </div>

            <div className="resource-meta">
              {formattedDate && (
                <Text className="meta-text">{formattedDate}</Text>
              )}
              {formattedDate && formattedDuration && (
                <span className="meta-separator">|</span>
              )}
              {formattedDuration && (
                <Text className="meta-text">{formattedDuration}</Text>
              )}
            </div>
          </div>
        </div>

        <div className="header-actions flex gap-4">
          <Button
            className="expand-button remove-button-default-styling"
            onClick={handleFullScreenToggle}>
            {isFullScreen ? (
              <ShrinkOutlined width={20} />
            ) : (
              <ExpandAltOutlined width={20} />
            )}
          </Button>
          <Button
            className="close-button remove-button-default-styling"
            onClick={onClose}>
            <CloseOutlined />
          </Button>
        </div>
      </div>

      <div className="resource-player-content">{renderPlayer}</div>
    </Modal>
  );
};
