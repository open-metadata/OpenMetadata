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
import { ReactComponent as StoryLaneIcon } from '../../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../../assets/svg/ic_video.svg';
import { ResourceType } from '../../../constants/Learning.constants';
import { LEARNING_CATEGORIES } from '../Learning.interface';
import { LearningResourceCardProps } from './LearningResourceCard.interface';

const MAX_VISIBLE_CATEGORIES_IN_CARD = 2;
const DESCRIPTION_VIEW_MORE_THRESHOLD = 100;

export const LearningResourceCard: React.FC<LearningResourceCardProps> = ({
  resource,
  onClick,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const iconColors = {
    video: theme.palette.allShades?.blue?.[600],
    storylane: theme.palette.allShades?.purple?.[600],
  };
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const showViewMore =
    resource.description &&
    resource.description.length > DESCRIPTION_VIEW_MORE_THRESHOLD;

  const type = resource.resourceType.toLowerCase();
  const iconColor =
    iconColors[type as keyof typeof iconColors] ?? iconColors.video;
  const iconProps = { height: 24, width: 24, style: { color: iconColor } };
  const resourceTypeIcon =
    resource.resourceType === ResourceType.Storylane ? (
      <StoryLaneIcon {...iconProps} />
    ) : (
      <VideoIcon {...iconProps} />
    );

  const formattedDuration = resource.estimatedDuration
    ? `${Math.floor(resource.estimatedDuration / 60)} ${t('label.min-watch')}`
    : null;

  const formattedDate = resource.updatedAt
    ? DateTime.fromMillis(resource.updatedAt).toFormat('LLL dd, yyyy')
    : null;

  const categoryTags =
    !resource.categories || resource.categories.length === 0
      ? { visible: [] as string[], hidden: [] as string[], remaining: 0 }
      : {
          visible: resource.categories.slice(0, MAX_VISIBLE_CATEGORIES_IN_CARD),
          hidden: resource.categories.slice(MAX_VISIBLE_CATEGORIES_IN_CARD),
          remaining:
            resource.categories.length - MAX_VISIBLE_CATEGORIES_IN_CARD,
        };

  const getCategoryColors = (category: string) => {
    const info =
      LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

    return {
      bgColor: info?.bgColor ?? '#f8f9fc',
      borderColor: info?.borderColor ?? '#d5d9eb',
      color: info?.color ?? '#363f72',
    };
  };

  const handleViewMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(resource);
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
      borderRadius={theme.spacing(1.5)}
      boxShadow={theme.shadows[1]}
      data-clickable={onClick ? 'true' : undefined}
      data-testid={`learning-resource-card-${resource.name}`}
      sx={{
        width: '100%',
        minWidth: 0,
        padding: theme.spacing(2.5),
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            minWidth: 0,
            minHeight: 40,
          }}>
          <Box sx={{ flexShrink: 0, mt: '2px' }}>{resourceTypeIcon}</Box>
          <Typography
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: theme.typography.body2.fontSize,
              lineHeight: theme.typography.body2.lineHeight,
              color: theme.palette.allShades?.gray?.[900],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              fontWeight: 600,
            }}>
            {resource.displayName || resource.name}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 56,
          }}>
          {resource.description ? (
            <>
              <Typography
                aria-label={resource.description}
                component="span"
                data-testid="learning-resource-description"
                sx={{
                  fontSize: theme.typography.caption.fontSize,
                  lineHeight: theme.typography.body2.lineHeight,
                  color: theme.palette.allShades?.gray?.[600],
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: showViewMore ? 2 : 3,
                  WebkitBoxOrient: 'vertical',
                  flex: 1,
                  minHeight: 0,
                }}>
                {resource.description}
              </Typography>
              {showViewMore && (
                <Link
                  component="button"
                  sx={{
                    fontSize: theme.typography.caption.fontSize,
                    color: theme.palette.allShades?.brand?.[600],
                    cursor: 'pointer',
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                  type="button"
                  onClick={handleViewMoreClick}>
                  {t('label.view-more')}
                </Link>
              )}
            </>
          ) : (
            <Typography
              component="span"
              data-testid="learning-resource-description"
              sx={{
                color: theme.palette.allShades?.gray?.[500],
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.body2.fontSize,
                fontStyle: 'italic',
                fontWeight: theme.typography.fontWeightRegular,
                lineHeight: theme.typography.body2.lineHeight,
              }}>
              {t('label.no-entity-added', {
                entity: t('label.description-lowercase'),
              })}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing(0.75),
              minWidth: 0,
              overflow: 'hidden',
            }}>
            {categoryTags.visible.length > 0 ? (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: theme.spacing(0.75),
                    minWidth: 0,
                    overflow: 'hidden',
                  }}>
                  {categoryTags.visible.map((category) => {
                    const colors = getCategoryColors(category);

                    return (
                      <Box
                        component="span"
                        key={category}
                        sx={{
                          flexShrink: 0,
                          fontSize: theme.typography.caption.fontSize,
                          lineHeight: theme.typography.body2.lineHeight,
                          padding: theme.spacing(0.25, 0.75),
                          borderRadius: theme.spacing(0.75),
                          fontWeight: theme.typography.fontWeightMedium,
                          backgroundColor: colors.bgColor,
                          border: '1px solid',
                          borderColor: colors.borderColor,
                          color: colors.color,
                        }}>
                        {LEARNING_CATEGORIES[
                          category as keyof typeof LEARNING_CATEGORIES
                        ]?.label ?? category}
                      </Box>
                    );
                  })}
                </Box>
                {categoryTags.remaining > 0 && (
                  <>
                    <Box
                      component="span"
                      sx={{
                        flexShrink: 0,
                        fontSize: theme.typography.caption.fontSize,
                        lineHeight: theme.typography.body2.lineHeight,
                        padding: theme.spacing(0.25, 0.75),
                        borderRadius: theme.spacing(0.75),
                        fontWeight: theme.typography.fontWeightMedium,
                        backgroundColor: theme.palette.allShades?.brand?.[50],
                        border: 'none',
                        color: theme.palette.allShades?.brand?.[700],
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor:
                            theme.palette.allShades?.brand?.[100],
                        },
                      }}
                      onClick={handleMoreTagClick}>
                      +{categoryTags.remaining}
                    </Box>
                    <Popover
                      anchorEl={anchorEl}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      open={Boolean(anchorEl)}
                      slotProps={{
                        root: {
                          onClick: (e: React.MouseEvent) => e.stopPropagation(),
                        },
                      }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                      onClose={handlePopoverClose}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          maxWidth: 250,
                          p: 1.5,
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        {categoryTags.hidden.map((category) => {
                          const colors = getCategoryColors(category);

                          return (
                            <Box
                              component="span"
                              key={category}
                              sx={{
                                fontSize: theme.typography.caption.fontSize,
                                lineHeight: theme.typography.body2.lineHeight,
                                padding: theme.spacing(0.25, 0.75),
                                borderRadius: theme.spacing(0.75),
                                fontWeight: theme.typography.fontWeightMedium,
                                backgroundColor: colors.bgColor,
                                border: '1px solid',
                                borderColor: colors.borderColor,
                                color: colors.color,
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
              </>
            ) : (
              <Typography
                component="span"
                sx={{
                  color: theme.palette.allShades?.gray?.[500],
                  fontFamily: theme.typography.fontFamily,
                  fontSize: theme.typography.body2.fontSize,
                  fontStyle: 'italic',
                  fontWeight: theme.typography.fontWeightRegular,
                  lineHeight: theme.typography.body2.lineHeight,
                }}>
                {t('label.no-entity-added', {
                  entity: t('label.category-lowercase'),
                })}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexShrink: 0,
            }}>
            {formattedDate && (
              <Typography
                component="span"
                sx={{
                  fontSize: theme.typography.caption.fontSize,
                  color: theme.palette.allShades?.gray?.[600],
                }}>
                {formattedDate}
              </Typography>
            )}
            {formattedDate && formattedDuration && (
              <Typography
                component="span"
                sx={{
                  fontSize: theme.typography.caption.fontSize,
                  color: theme.palette.allShades?.blueGray?.[100],
                }}>
                |
              </Typography>
            )}
            {formattedDuration && (
              <Typography
                component="span"
                sx={{
                  fontSize: theme.typography.caption.fontSize,
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
