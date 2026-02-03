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
import { Button, Modal, Tag, Tooltip, Typography } from 'antd';
import { DateTime } from 'luxon';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_THEME } from '../../../constants/Appearance.constants';
import { ResourceType } from '../../../constants/Learning.constants';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import { ArticleViewer } from './ArticleViewer.component';
import './resource-player-modal.less';
import { ResourcePlayerModalProps } from './ResourcePlayerModal.interface';
import { StorylaneTour } from './StorylaneTour.component';
import { VideoPlayer } from './VideoPlayer.component';

const { Link, Paragraph, Text } = Typography;

export const ResourcePlayerModal: React.FC<ResourcePlayerModalProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  const formattedDuration = useMemo(() => {
    if (!resource.estimatedDuration) {
      return null;
    }
    const minutes = Math.floor(resource.estimatedDuration / 60);
    const durationLabel =
      resource.resourceType === 'Article'
        ? t('label.min-read')
        : t('label.min-watch');

    return `${minutes} ${durationLabel}`;
  }, [resource.estimatedDuration, resource.resourceType, t]);

  const formattedDate = useMemo(() => {
    if (!resource.updatedAt) {
      return null;
    }

    return DateTime.fromMillis(resource.updatedAt).toFormat('LLL d, yyyy');
  }, [resource.updatedAt]);

  const categoryTags = useMemo(() => {
    if (!resource.categories || resource.categories.length === 0) {
      return [];
    }

    return resource.categories;
  }, [resource.categories]);

  const getCategoryColors = useCallback((category: string) => {
    const categoryInfo =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return {
      bgColor: categoryInfo?.bgColor ?? DEFAULT_THEME.hoverColor,
      borderColor: categoryInfo?.borderColor ?? DEFAULT_THEME.infoColor,
      color: categoryInfo?.color ?? DEFAULT_THEME.primaryColor,
    };
  }, []);

  const handleViewMoreClick = useCallback(() => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  }, [isDescriptionExpanded]);

  const handleFullScreenToggle = useCallback(async () => {
    if (!fullscreenRef.current) {
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullScreen(false);
      } else {
        await fullscreenRef.current.requestFullscreen();
        setIsFullScreen(true);
      }
    } catch {
      setIsFullScreen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [open]);

  const renderPlayer = useMemo(() => {
    switch (resource.resourceType) {
      case ResourceType.Video:
        return <VideoPlayer resource={resource} />;
      case ResourceType.Storylane:
        return <StorylaneTour resource={resource} />;
      case ResourceType.Article:
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
      <div
        className={`resource-player-fullscreen-wrapper ${
          isFullScreen ? 'fullscreen' : ''
        }`}
        ref={fullscreenRef}>
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
                  <Link
                    className="view-more-link"
                    onClick={handleViewMoreClick}>
                    {isDescriptionExpanded
                      ? t('label.view-less')
                      : t('label.view-more')}
                  </Link>
                )}
              </div>
            )}

            <div className="resource-meta-row">
              <div className="resource-tags">
                {categoryTags.map((category) => {
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
              </div>

              {(formattedDate || formattedDuration) && (
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
              )}
            </div>
          </div>

          <div className="header-actions flex gap-4">
            <Tooltip
              title={
                isFullScreen
                  ? t('label.exit-full-screen')
                  : t('label.fullscreen')
              }>
              <Button
                className="expand-button remove-button-default-styling"
                data-testid={
                  isFullScreen ? 'minimize-button' : 'maximize-button'
                }
                onClick={handleFullScreenToggle}>
                {isFullScreen ? (
                  <ShrinkOutlined width={20} />
                ) : (
                  <ExpandAltOutlined width={20} />
                )}
              </Button>
            </Tooltip>
            <Button
              className="close-button remove-button-default-styling"
              onClick={onClose}>
              <CloseOutlined />
            </Button>
          </div>
        </div>

        <div className="resource-player-content">{renderPlayer}</div>
      </div>
    </Modal>
  );
};
