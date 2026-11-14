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
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Maximize01,
  Minimize01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { DateTime } from 'luxon';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_IDS, ResourceType } from '../../../constants/Learning.constants';
import type { LearningResource } from '../../../rest/learningResourceAPI';
import { getLearningResourceById } from '../../../rest/learningResourceAPI';
import { getDurationUnitLabelKey } from '../../../utils/platform/learning.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import {
  CATEGORY_BADGE_COLORS,
  LEARNING_CATEGORIES,
  ResourceCategory,
} from '../Learning.interface';
import { ArticleViewer } from './ArticleViewer.component';
import { PdfViewer } from './PdfViewer';
import { ResourcePlayerModalProps } from './ResourcePlayerModal.interface';
import { StorylaneTour } from './StorylaneTour.component';
import { VideoPlayer } from './VideoPlayer.component';

const FULLSCREEN_CONTAINER_ID = 'resource-player-fullscreen';

const FULLSCREEN_PLAYER_CLASS = [
  'tw:flex-1 tw:min-h-0',
  'tw:[&>*]:size-full! tw:[&>*]:p-4!',
  'tw:[&>*>*]:size-full! tw:[&>*>*]:max-h-none! tw:[&>*>*]:max-w-none! tw:[&>*>*]:aspect-auto!',
].join(' ');

const getFormattedDuration = (
  resource: LearningResource,
  t: TFunction
): string | null =>
  resource.estimatedDuration
    ? `${Math.floor(resource.estimatedDuration / 60)} ${t(
        getDurationUnitLabelKey(resource.resourceType)
      )}`
    : null;

const getFormattedDate = (resource: LearningResource): string | null =>
  resource.updatedAt
    ? DateTime.fromMillis(resource.updatedAt).toFormat('LLL d, yyyy')
    : null;

const getContextLabel = (pageId: string) =>
  PAGE_IDS.find((c) => c.value === pageId)?.label ?? pageId;

const getCategoryLabel = (category: string) =>
  LEARNING_CATEGORIES[category as ResourceCategory]?.label ?? category;

const getCategoryColor = (category: string) =>
  CATEGORY_BADGE_COLORS[category as ResourceCategory] ?? 'gray';

interface ResourceHeaderProps {
  resource: LearningResource;
  isFullScreen: boolean;
  onFullScreenToggle: () => void;
  onClose?: () => void;
}

const ResourceDateDuration: FC<{ resource: LearningResource }> = ({
  resource,
}) => {
  const { t } = useTranslation();
  const formattedDate = getFormattedDate(resource);
  const formattedDuration = getFormattedDuration(resource, t);

  if (!formattedDate && !formattedDuration) {
    return null;
  }

  // The extra right margin separates the metadata from the header icon buttons,
  // which stay tightly grouped by the parent's gap.
  return (
    <Box
      align="center"
      className="tw:mr-2"
      data-testid="resource-date-duration"
      gap={1}>
      {formattedDate && (
        <Typography as="span" className="tw:text-tertiary" size="text-xs">
          {formattedDate}
        </Typography>
      )}
      {formattedDate && formattedDuration && (
        <Typography as="span" className="tw:text-quaternary" size="text-xs">
          |
        </Typography>
      )}
      {formattedDuration && (
        <Typography as="span" className="tw:text-quaternary" size="text-xs">
          {formattedDuration}
        </Typography>
      )}
    </Box>
  );
};

const ResourceHeaderTitleRow: FC<ResourceHeaderProps> = ({
  resource,
  isFullScreen,
  onFullScreenToggle,
  onClose,
}) => {
  const { t } = useTranslation();
  const categoryTags = resource.categories ?? [];

  return (
    <Box align="start" className="tw:justify-between" gap={2}>
      <Box className="tw:flex-1 tw:min-w-0" direction="col">
        <Box align="center" className="tw:flex-wrap tw:gap-1.5">
          <Typography
            className="tw:text-primary tw:break-words"
            size="text-md"
            weight="semibold">
            {resource.displayName || resource.name}
          </Typography>
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

        {resource.description && (
          <Typography
            aria-label={resource.description}
            className="tw:pt-1 tw:text-[13px] tw:text-tertiary"
            size="text-sm">
            {resource.description}
          </Typography>
        )}
      </Box>

      <Box align="center" className="tw:shrink-0" gap={1}>
        <ResourceDateDuration resource={resource} />
        <ButtonUtility
          aria-label={
            isFullScreen ? t('label.exit-full-screen') : t('label.fullscreen')
          }
          data-testid={isFullScreen ? 'minimize-button' : 'maximize-button'}
          icon={isFullScreen ? Minimize01 : Maximize01}
          size="lg"
          tooltip={
            isFullScreen ? t('label.exit-full-screen') : t('label.fullscreen')
          }
          onClick={onFullScreenToggle}
        />
        {onClose && (
          <ButtonUtility
            aria-label={t('label.close')}
            data-testid="close-resource-player"
            icon={XClose}
            size="lg"
            onClick={onClose}
          />
        )}
      </Box>
    </Box>
  );
};

const ResourceHeaderMetaRow: FC<{ resource: LearningResource }> = ({
  resource,
}) => {
  const contextItems = resource.contexts ?? [];

  if (contextItems.length === 0) {
    return null;
  }

  return (
    <Box className="tw:flex-wrap tw:gap-2 tw:pt-3">
      {contextItems.map((ctx) => (
        <Badge color="gray" key={ctx.pageId} size="sm" type="color">
          {getContextLabel(ctx.pageId)}
        </Badge>
      ))}
    </Box>
  );
};

const ResourceHeader: FC<ResourceHeaderProps> = ({
  resource,
  isFullScreen,
  onFullScreenToggle,
  onClose,
}) => (
  <Box
    className={classNames(
      'tw:border-b tw:border-secondary tw:px-6 tw:py-3',
      isFullScreen && 'tw:shrink-0'
    )}
    direction="col">
    <ResourceHeaderTitleRow
      isFullScreen={isFullScreen}
      resource={resource}
      onClose={onClose}
      onFullScreenToggle={onFullScreenToggle}
    />
    <ResourceHeaderMetaRow resource={resource} />
  </Box>
);

interface ResourcePlayerProps {
  /** Shown while the full resource loads, or alone when there is no id. */
  resource?: LearningResource;
  /** The stored resource to fetch; without one the player shows `resource`. */
  resourceId?: string;
  /** Renders a close button in the header when set. */
  onClose?: () => void;
  className?: string;
  /** Enters full screen as the player opens. */
  isFullScreenByDefault?: boolean;
}

/** Header (title, badges, meta) plus the player for one learning resource. */
export const ResourcePlayer: FC<ResourcePlayerProps> = ({
  resource,
  resourceId,
  onClose,
  className,
  isFullScreenByDefault = false,
}) => {
  const { t } = useTranslation();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fetchedResource, setFetchedResource] =
    useState<LearningResource | null>(null);

  const [hasFetchFailed, setHasFetchFailed] = useState(false);
  const hasFallback = Boolean(resource);

  // Only the current id's response may land, and a failure matters only when
  // there is no list row to fall back on (the settings sub-page).
  useEffect(() => {
    if (!resourceId) {
      return;
    }
    let isCurrent = true;
    setFetchedResource(null);
    setHasFetchFailed(false);
    getLearningResourceById(resourceId)
      .then((data) => {
        if (isCurrent) {
          setFetchedResource(data);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setHasFetchFailed(true);
          if (!hasFallback) {
            showErrorToast(error as AxiosError);
          }
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [resourceId, hasFallback]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };
  }, []);

  // Opened from a click, the browser grants full screen; when it does not,
  // the player stays at the dialog's size. Asked once: the click's
  // permission is spent on the first request, so a second (as StrictMode's
  // re-run of effects makes) is always refused.
  const hasRequestedFullScreen = useRef(false);
  useEffect(() => {
    if (!isFullScreenByDefault || hasRequestedFullScreen.current) {
      return;
    }
    hasRequestedFullScreen.current = true;
    document
      .getElementById(FULLSCREEN_CONTAINER_ID)
      ?.requestFullscreen?.()
      .catch(() => undefined);
  }, [isFullScreenByDefault]);

  const displayResource = fetchedResource ?? resource;

  if (!displayResource) {
    return hasFetchFailed ? (
      <Box className="tw:relative tw:min-h-90">
        <NoDataPlaceholder
          data-testid="resource-not-found"
          title={t('label.no-entity-found', {
            entity: t('label.learning-resource'),
          })}
        />
      </Box>
    ) : (
      <Skeleton height={400} variant="rounded" width="100%" />
    );
  }

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

  const renderPlayer = () => {
    switch (displayResource.resourceType) {
      case ResourceType.Video:
        return <VideoPlayer resource={displayResource} />;
      case ResourceType.Storylane:
        return <StorylaneTour resource={displayResource} />;
      case ResourceType.Article:
        return <ArticleViewer resource={displayResource} />;
      case ResourceType.PDF:
        return <PdfViewer resource={displayResource} />;
      default:
        return (
          <Typography as="span" className="tw:p-4" size="text-sm">
            {t('message.unsupported-resource-type')}
          </Typography>
        );
    }
  };

  return (
    <Box
      className={classNames(
        'tw:flex tw:flex-col tw:min-h-0',
        isFullScreen
          ? 'tw:h-screen tw:w-screen tw:overflow-hidden tw:bg-tertiary'
          : className
      )}
      direction="col"
      id={FULLSCREEN_CONTAINER_ID}>
      <ResourceHeader
        isFullScreen={isFullScreen}
        resource={displayResource}
        onClose={onClose}
        onFullScreenToggle={handleFullScreenToggle}
      />

      <Box
        className={classNames(
          'tw:w-full tw:bg-tertiary',
          isFullScreen && FULLSCREEN_PLAYER_CLASS
        )}
        direction="col">
        {renderPlayer()}
      </Box>
    </Box>
  );
};

export const ResourcePlayerModal: React.FC<ResourcePlayerModalProps> = ({
  open,
  resource,
  onClose,
  isFullScreenByDefault = false,
  isStored = true,
}) => (
  <ModalOverlay
    isDismissable
    isOpen={open}
    onOpenChange={(isOpenState) => {
      if (!isOpenState) {
        onClose();
      }
    }}>
    <Modal>
      <Dialog
        aria-label={resource.displayName || resource.name}
        data-testid="resource-player-dialog"
        width={1143}>
        <ResourcePlayer
          className="tw:max-h-[90vh] tw:overflow-auto"
          isFullScreenByDefault={isFullScreenByDefault}
          resource={resource}
          resourceId={isStored ? resource.id : undefined}
          onClose={onClose}
        />
      </Dialog>
    </Modal>
  </ModalOverlay>
);
