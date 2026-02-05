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

import { Box, Link, Popover, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArticleIcon } from '../../../assets/svg/ic_article.svg';
import { ReactComponent as StoryLaneIcon } from '../../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../../assets/svg/ic_video.svg';
import { DEFAULT_THEME } from '../../../constants/Appearance.constants';
import {
  MAX_VISIBLE_TAGS,
  ResourceType,
} from '../../../constants/Learning.constants';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import { LearningResourceCardProps } from './LearningResourceCard.interface';

const DESCRIPTION_VIEW_MORE_THRESHOLD = 150;

export const LearningResourceCard: React.FC<LearningResourceCardProps> = ({
  resource,
  onClick,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const iconColors = {
    video: theme.palette.allShades?.blue?.[600],
    storylane: theme.palette.allShades?.purple?.[600],
    article: theme.palette.allShades?.success?.[500],
  };
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const showViewMore =
    resource.description &&
    (isDescriptionExpanded ||
      resource.description.length > DESCRIPTION_VIEW_MORE_THRESHOLD);

  const type = resource.resourceType.toLowerCase();
  const iconColor =
    iconColors[type as keyof typeof iconColors] ?? iconColors.article;
  const iconProps = { height: 24, width: 24, style: { color: iconColor } };
  const resourceTypeIcon =
    resource.resourceType === ResourceType.Video ? (
      <VideoIcon {...iconProps} />
    ) : resource.resourceType === ResourceType.Storylane ? (
      <StoryLaneIcon {...iconProps} />
    ) : (
      <ArticleIcon {...iconProps} />
    );

  const formattedDuration = resource.estimatedDuration
    ? `${Math.floor(resource.estimatedDuration / 60)} ${
        resource.resourceType === 'Article'
          ? t('label.min-read')
          : t('label.min-watch')
      }`
    : null;

  const formattedDate = resource.updatedAt
    ? DateTime.fromMillis(resource.updatedAt).toFormat('LLL dd, yyyy')
    : null;

  const categoryTags =
    !resource.categories || resource.categories.length === 0
      ? { visible: [] as string[], hidden: [] as string[], remaining: 0 }
      : {
          visible: resource.categories.slice(0, MAX_VISIBLE_TAGS),
          hidden: resource.categories.slice(MAX_VISIBLE_TAGS),
          remaining: resource.categories.length - MAX_VISIBLE_TAGS,
        };

  const getCategoryColor = (category: string) => {
    const categoryInfo =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return categoryInfo?.color ?? DEFAULT_THEME.primaryColor;
  };

  const handleViewMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };

  const handleMoreTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget as HTMLElement);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box
      bgcolor={theme.palette.allShades?.white}
      border="1px solid"
      borderColor={theme.palette.allShades?.blueGray?.[50]}
      borderRadius="12px"
      boxShadow="0 1px 2px 0 rgba(10, 13, 18, 0.05)"
      data-clickable={onClick ? 'true' : undefined}
      data-testid={`learning-resource-card-${resource.name}`}
      p={2}
      sx={{
        transition: 'all 0.2s ease',
        ...(onClick && {
          cursor: 'pointer',
          '&:hover': {
            boxShadow:
              '0 4px 6px -2px rgba(10, 13, 18, 0.05), 0 2px 4px -2px rgba(10, 13, 18, 0.05)',
          },
        }),
      }}
      onClick={() => onClick?.(resource)}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flexShrink: 0, mt: '2px' }}>{resourceTypeIcon}</Box>
          <Typography
            component="span"
            fontWeight={600}
            sx={{
              fontSize: 14,
              lineHeight: 1.43,
              color: theme.palette.allShades?.gray?.[900],
            }}>
            {resource.displayName || resource.name}
          </Typography>
        </Box>

        {resource.description && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
              alignItems: 'baseline',
            }}>
            <Typography
              aria-label={resource.description}
              component="span"
              data-testid="learning-resource-description"
              sx={{
                fontSize: 12,
                lineHeight: 1.5,
                color: theme.palette.allShades?.gray?.[600],
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: isDescriptionExpanded ? 'inline' : '-webkit-box',
                WebkitLineClamp: isDescriptionExpanded ? undefined : 2,
                WebkitBoxOrient: isDescriptionExpanded ? undefined : 'vertical',
              }}>
              {resource.description}
            </Typography>
            {showViewMore && (
              <Link
                component="button"
                sx={{
                  fontSize: 12,
                  color: theme.palette.allShades?.brand?.[600],
                  cursor: 'pointer',
                  flexShrink: 0,
                  '&:hover': { textDecoration: 'underline' },
                }}
                type="button"
                onClick={handleViewMoreClick}>
                {isDescriptionExpanded
                  ? t('label.view-less')
                  : t('label.view-more')}
              </Link>
            )}
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mt: 0.5,
          }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {categoryTags.visible.map((category) => {
              const color = getCategoryColor(category);

              return (
                <Box
                  component="span"
                  key={category}
                  sx={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    fontWeight: 500,
                    backgroundColor: `${color}15`,
                    border: '1px solid',
                    borderColor: color,
                    color,
                  }}>
                  {LEARNING_CATEGORIES[
                    category as keyof typeof LEARNING_CATEGORIES
                  ]?.label ?? category}
                </Box>
              );
            })}
            {categoryTags.remaining > 0 && (
              <>
                <Box
                  component="span"
                  sx={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    fontWeight: 500,
                    backgroundColor: theme.palette.allShades?.gray?.[100],
                    border: '1px solid',
                    borderColor: theme.palette.allShades?.gray?.[300],
                    color: theme.palette.allShades?.gray?.[600],
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: theme.palette.allShades?.gray?.[400],
                      backgroundColor: theme.palette.allShades?.gray?.[200],
                    },
                  }}
                  onClick={handleMoreTagClick}>
                  +{categoryTags.remaining}
                </Box>
                <Popover
                  anchorEl={anchorEl}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  open={Boolean(anchorEl)}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  onClose={handlePopoverClose}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      maxWidth: 250,
                      p: 1.5,
                    }}>
                    {categoryTags.hidden.map((category) => {
                      const color = getCategoryColor(category);

                      return (
                        <Box
                          component="span"
                          key={category}
                          sx={{
                            fontSize: 11,
                            lineHeight: 1.45,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                            fontWeight: 500,
                            backgroundColor: `${color}15`,
                            border: '1px solid',
                            borderColor: color,
                            color,
                          }}>
                          {LEARNING_CATEGORIES[
                            category as keyof typeof LEARNING_CATEGORIES
                          ]?.label ?? category}
                        </Box>
                      );
                    })}
                  </Box>
                </Popover>
              </>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexShrink: 0,
            }}>
            {formattedDate && (
              <Typography
                component="span"
                sx={{
                  fontSize: 12,
                  color: theme.palette.allShades?.gray?.[600],
                }}>
                {formattedDate}
              </Typography>
            )}
            {formattedDate && formattedDuration && (
              <Typography
                component="span"
                sx={{
                  fontSize: 12,
                  color: theme.palette.allShades?.blueGray?.[100],
                }}>
                |
              </Typography>
            )}
            {formattedDuration && (
              <Typography
                component="span"
                sx={{
                  fontSize: 12,
                  color: theme.palette.allShades?.gray?.[600],
                }}>
                {formattedDuration}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
