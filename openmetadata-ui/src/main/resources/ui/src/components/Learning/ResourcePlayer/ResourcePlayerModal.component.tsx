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
  Badge,
  Box,
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Maximize01, Minimize01, XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { DateTime } from 'luxon';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_IDS, ResourceType } from '../../../constants/Learning.constants';
import type { LearningResource } from '../../../rest/learningResourceAPI';
import { getLearningResourceById } from '../../../rest/learningResourceAPI';
import {
  CATEGORY_BADGE_COLORS,
  LEARNING_CATEGORIES,
  ResourceCategory,
} from '../Learning.interface';
import { ArticleViewer } from './ArticleViewer.component';
import { ResourcePlayerModalProps } from './ResourcePlayerModal.interface';
import { StorylaneTour } from './StorylaneTour.component';
import { VideoPlayer } from './VideoPlayer.component';

const FULLSCREEN_CONTAINER_ID = 'resource-player-fullscreen';

const FULLSCREEN_PLAYER_CLASS = [
  'tw:flex-1 tw:min-h-0',
  'tw:[&>*]:size-full! tw:[&>*]:p-4!',
  'tw:[&>*>*]:size-full! tw:[&>*>*]:max-h-none! tw:[&>*>*]:max-w-none! tw:[&>*>*]:aspect-auto!',
].join(' ');

export const ResourcePlayerModal: React.FC<ResourcePlayerModalProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fetchedResource, setFetchedResource] =
    useState<LearningResource | null>(null);

  useEffect(() => {
    if (open && resource?.id) {
      getLearningResourceById(resource.id)
        .then(setFetchedResource)
        .catch(() => setFetchedResource(null));
    } else {
      setFetchedResource(null);
    }
  }, [open, resource?.id]);

  const displayResource = fetchedResource ?? resource;

  const formattedDuration = displayResource.estimatedDuration
    ? `${Math.floor(displayResource.estimatedDuration / 60)} ${
        displayResource.resourceType === 'Article'
          ? t('label.min-read')
          : t('label.min-watch')
      }`
    : null;

  const formattedDate = displayResource.updatedAt
    ? DateTime.fromMillis(displayResource.updatedAt).toFormat('LLL d, yyyy')
    : null;

  const categoryTags = displayResource.categories ?? [];
  const contextItems = displayResource.contexts ?? [];

  const getContextLabel = (pageId: string) =>
    PAGE_IDS.find((c) => c.value === pageId)?.label ?? pageId;

  const getCategoryLabel = (category: string) =>
    LEARNING_CATEGORIES[category as ResourceCategory]?.label ?? category;

  const getCategoryColor = (category: string) =>
    CATEGORY_BADGE_COLORS[category as ResourceCategory] ?? 'gray';

  const handleFullScreenToggle = async () => {
    const element = document.getElementById(FULLSCREEN_CONTAINER_ID);
    if (!element) {
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullScreen(false);
      } else {
        await element.requestFullscreen();
        setIsFullScreen(true);
      }
    } catch {
      setIsFullScreen((prev) => !prev);
    }
  };

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

  const renderPlayer = () => {
    switch (displayResource.resourceType) {
      case ResourceType.Video:
        return <VideoPlayer resource={displayResource} />;
      case ResourceType.Storylane:
        return <StorylaneTour resource={displayResource} />;
      case ResourceType.Article:
        return <ArticleViewer resource={displayResource} />;
      default:
        return (
          <Typography as="span" className="tw:p-4" size="text-sm">
            {t('message.unsupported-resource-type')}
          </Typography>
        );
    }
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpenState) => {
        if (!isOpenState) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog width={1143}>
          <Box
            className={classNames(
              'tw:flex tw:flex-col tw:min-h-0',
              isFullScreen
                ? 'tw:h-screen tw:w-screen tw:overflow-hidden tw:bg-tertiary'
                : 'tw:max-h-[90vh] tw:overflow-auto'
            )}
            direction="col"
            id={FULLSCREEN_CONTAINER_ID}>
            <Box
              className={classNames(
                'tw:border-b tw:border-secondary tw:px-6 tw:py-3',
                isFullScreen && 'tw:shrink-0'
              )}
              direction="col">
              <Box align="start" className="tw:justify-between" gap={2}>
                <Box className="tw:flex-1 tw:min-w-0" direction="col">
                  <Typography
                    className="tw:text-primary tw:break-words"
                    size="text-md"
                    weight="semibold">
                    {displayResource.displayName || displayResource.name}
                  </Typography>

                  {displayResource.description && (
                    <Typography
                      aria-label={displayResource.description}
                      className="tw:pt-6 tw:text-[13px] tw:text-tertiary"
                      size="text-sm">
                      {displayResource.description}
                    </Typography>
                  )}

                  {categoryTags.length > 0 && (
                    <Box className="tw:flex-wrap tw:gap-1.5 tw:pt-3">
                      {categoryTags.map((category) => (
                        <Badge
                          color={getCategoryColor(category)}
                          key={category}
                          size="sm"
                          type="color">
                          {getCategoryLabel(category)}
                        </Badge>
                      ))}
                    </Box>
                  )}
                </Box>

                <Box align="center" className="tw:shrink-0" gap={1}>
                  <ButtonUtility
                    aria-label={
                      isFullScreen
                        ? t('label.exit-full-screen')
                        : t('label.fullscreen')
                    }
                    color="tertiary"
                    data-testid={
                      isFullScreen ? 'minimize-button' : 'maximize-button'
                    }
                    icon={isFullScreen ? Minimize01 : Maximize01}
                    size="xs"
                    tooltip={
                      isFullScreen
                        ? t('label.exit-full-screen')
                        : t('label.fullscreen')
                    }
                    onClick={handleFullScreenToggle}
                  />
                  <ButtonUtility
                    aria-label={t('label.close')}
                    color="tertiary"
                    data-testid="close-resource-player"
                    icon={XClose}
                    size="xs"
                    onClick={onClose}
                  />
                </Box>
              </Box>

              <Box
                align="center"
                className="tw:flex-wrap tw:justify-between tw:gap-1.5 tw:pt-3">
                <Box className="tw:flex-1 tw:min-w-0">
                  {contextItems.length > 0 && (
                    <Box className="tw:flex-wrap tw:gap-2">
                      {contextItems.map((ctx, idx) => (
                        <Badge
                          color="gray"
                          key={`${ctx.pageId}-${idx}`}
                          size="sm"
                          type="color">
                          {getContextLabel(ctx.pageId)}
                        </Badge>
                      ))}
                    </Box>
                  )}
                </Box>
                {(formattedDate || formattedDuration) && (
                  <Box align="center" className="tw:shrink-0 tw:gap-1">
                    {formattedDate && (
                      <Typography
                        as="span"
                        className="tw:text-tertiary"
                        size="text-xs">
                        {formattedDate}
                      </Typography>
                    )}
                    {formattedDate && formattedDuration && (
                      <Typography
                        as="span"
                        className="tw:text-quaternary"
                        size="text-xs">
                        |
                      </Typography>
                    )}
                    {formattedDuration && (
                      <Typography
                        as="span"
                        className="tw:text-quaternary"
                        size="text-xs">
                        {formattedDuration}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            <Box
              className={classNames(
                'tw:w-full tw:bg-tertiary',
                isFullScreen && FULLSCREEN_PLAYER_CLASS
              )}
              direction="col">
              {renderPlayer()}
            </Box>
          </Box>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
