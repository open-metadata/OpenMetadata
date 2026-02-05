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
  Box,
  Dialog,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Maximize01, Minimize01, XClose } from '@untitledui/icons';
import { DateTime } from 'luxon';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_IDS, ResourceType } from '../../../constants/Learning.constants';
import type { LearningResource } from '../../../rest/learningResourceAPI';
import { getLearningResourceById } from '../../../rest/learningResourceAPI';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import { ArticleViewer } from './ArticleViewer.component';
import { ResourcePlayerModalProps } from './ResourcePlayerModal.interface';
import { StorylaneTour } from './StorylaneTour.component';
import { VideoPlayer } from './VideoPlayer.component';

export const ResourcePlayerModal: React.FC<ResourcePlayerModalProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullscreenRef = useRef<HTMLDivElement>(null);
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

  const categoryTags =
    !displayResource.categories || displayResource.categories.length === 0
      ? []
      : displayResource.categories;

  const contextItems =
    !displayResource.contexts || displayResource.contexts.length === 0
      ? []
      : displayResource.contexts;

  const getContextLabel = (pageId: string) =>
    PAGE_IDS.find((c) => c.value === pageId)?.label ?? pageId;

  const getCategoryColors = (category: string) => {
    const info =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return {
      bgColor: info?.bgColor ?? '#f8f9fc',
      borderColor: info?.borderColor ?? '#d5d9eb',
      color: info?.color ?? '#363f72',
    };
  };

  const handleFullScreenToggle = async () => {
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
        return <div>{t('message.unsupported-resource-type')}</div>;
    }
  };

  return (
    <Dialog
      PaperProps={{
        sx: {
          borderRadius: 1.5,
          maxWidth: 1143,
          overflow: 'hidden',
          padding: 0,
        },
      }}
      maxWidth={false}
      open={open}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.5)' } },
      }}
      onClose={onClose}>
      <Box
        ref={fullscreenRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          '&:fullscreen': {
            backgroundColor: theme.palette.allShades?.gray?.[100] ?? '#F8F9FC',
            borderRadius: 0,
            height: '100vh',
            width: '100vw',
          },
        }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            borderBottom: '1px solid',
            borderColor: theme.palette.allShades?.gray?.[200] ?? '#EBEEF2',
            display: 'flex',
            gap: 2,
            justifyContent: 'space-between',
            padding: '12px 24px',
            position: 'relative',
            ...(isFullScreen && { flexShrink: 0 }),
          }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              component="div"
              fontWeight={600}
              sx={{
                color: theme.palette.allShades?.gray?.[900],
                display: 'block',
                fontSize: 16,
                lineHeight: 1.5,
                marginBottom: 0.5,
              }}>
              {displayResource.displayName || displayResource.name}
            </Typography>

            {displayResource.description && (
              <Typography
                aria-label={displayResource.description}
                className="resource-description"
                component="div"
                sx={{
                  color: theme.palette.allShades?.gray?.[600],
                  fontSize: 13,
                  lineHeight: 1.54,
                  pt: '12px',
                }}>
                {displayResource.description}
              </Typography>
            )}

            <Box
              sx={{
                alignItems: 'center',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: 'space-between',
                pt: '12px',
              }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {categoryTags.map((category) => {
                  const colors = getCategoryColors(category);

                  return (
                    <Box
                      component="span"
                      key={category}
                      sx={{
                        backgroundColor: colors.bgColor,
                        border: '1px solid',
                        borderColor: colors.borderColor,
                        borderRadius: '6px',
                        color: colors.color,
                        fontSize: 12,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        padding: '2px 6px',
                      }}>
                      {LEARNING_CATEGORIES[
                        category as keyof typeof LEARNING_CATEGORIES
                      ]?.label ?? category}
                    </Box>
                  );
                })}
              </Box>

              {(formattedDate || formattedDuration) && (
                <Box
                  sx={{
                    alignItems: 'center',
                    display: 'flex',
                    flexShrink: 0,
                    gap: 0.5,
                  }}>
                  {formattedDate && (
                    <Typography
                      component="span"
                      sx={{
                        color: theme.palette.allShades?.gray?.[600],
                        fontSize: 12,
                      }}>
                      {formattedDate}
                    </Typography>
                  )}
                  {formattedDate && formattedDuration && (
                    <Typography
                      component="span"
                      sx={{
                        color: theme.palette.allShades?.gray?.[400],
                        fontSize: 12,
                        px: '7px',
                      }}>
                      |
                    </Typography>
                  )}
                  {formattedDuration && (
                    <Typography
                      component="span"
                      sx={{
                        color: theme.palette.allShades?.gray?.[500],
                        fontSize: 12,
                      }}>
                      {formattedDuration}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {contextItems.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  pt: '12px',
                }}>
                {contextItems.map((ctx, idx) => (
                  <Box
                    component="span"
                    key={`${ctx.pageId}-${idx}`}
                    sx={{
                      backgroundColor:
                        theme.palette.allShades?.blueGray?.[50] ?? '#F8F9FC',
                      border: '1px solid',
                      borderColor:
                        theme.palette.allShades?.blueGray?.[100] ?? '#EBEEF2',
                      borderRadius: '6px',
                      color: theme.palette.allShades?.gray?.[700] ?? '#363f72',
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: 1.5,
                      padding: '2px 6px',
                    }}>
                    {getContextLabel(ctx.pageId)}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              gap: 2,
              position: 'absolute',
              right: 15,
              top: 12,
            }}>
            <Tooltip
              title={
                isFullScreen
                  ? t('label.exit-full-screen')
                  : t('label.fullscreen')
              }>
              <IconButton
                color="inherit"
                data-testid={
                  isFullScreen ? 'minimize-button' : 'maximize-button'
                }
                sx={{
                  color: theme.palette.allShades?.gray?.[600],
                  height: 24,
                  width: 24,
                  '&:hover': {
                    color: theme.palette.allShades?.gray?.[700],
                  },
                  '& svg': {
                    height: 16,
                    width: 16,
                  },
                }}
                onClick={handleFullScreenToggle}>
                {isFullScreen ? (
                  <Minimize01 size={16} strokeWidth={2} />
                ) : (
                  <Maximize01 size={16} strokeWidth={2} />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              aria-label={t('label.close')}
              color="inherit"
              sx={{
                color: theme.palette.allShades?.gray?.[600],
                height: 24,
                width: 24,
                '&:hover': {
                  color: theme.palette.allShades?.gray?.[700],
                },
                '& svg': {
                  height: 16,
                  width: 16,
                },
              }}
              onClick={onClose}>
              <XClose size={16} />
            </IconButton>
          </Box>
        </Box>

        <Box
          className="resource-player-content"
          sx={{
            backgroundColor: theme.palette.allShades?.gray?.[100] ?? '#F8F9FC',
            flex: isFullScreen ? 1 : undefined,
            minHeight: isFullScreen ? 0 : undefined,
            width: '100%',
            '& .video-player-wrapper, & .storylane-tour-wrapper, & .article-viewer-wrapper':
              isFullScreen
                ? {
                    height: '100%',
                    padding: 2,
                    width: '100%',
                  }
                : {},
            '& .video-player-container, & .storylane-tour-container':
              isFullScreen
                ? {
                    aspectRatio: 'unset',
                    maxHeight: 'none',
                    maxWidth: 'none',
                    height: '100%',
                    width: '100%',
                  }
                : {},
            '& .article-viewer-container': isFullScreen
              ? {
                  maxHeight: 'none',
                  maxWidth: 'none',
                  height: '100%',
                }
              : {},
          }}>
          {renderPlayer()}
        </Box>
      </Box>
    </Dialog>
  );
};
