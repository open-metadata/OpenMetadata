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
  BadgeColors,
  Box,
  Button,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StoryLaneIcon } from '../../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../../assets/svg/ic_video.svg';
import {
  CATEGORY_BADGE_COLORS,
  DESCRIPTION_VIEW_MORE_THRESHOLD,
  ICON_COLOR_CLASS,
  MAX_VISIBLE_CATEGORIES_IN_CARD,
  ResourceType,
} from '../../../constants/Learning.constants';
import { LEARNING_CATEGORIES, ResourceCategory } from '../Learning.interface';
import { LearningResourceCardProps } from './LearningResourceCard.interface';

export const LearningResourceCard: React.FC<LearningResourceCardProps> = ({
  resource,
  onClick,
}) => {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const showViewMore =
    resource.description &&
    resource.description.length > DESCRIPTION_VIEW_MORE_THRESHOLD;

  const iconColorClass =
    ICON_COLOR_CLASS[resource.resourceType.toLowerCase()] ??
    ICON_COLOR_CLASS.video;
  const resourceTypeIcon =
    resource.resourceType === ResourceType.Storylane ? (
      <StoryLaneIcon className={iconColorClass} height={24} width={24} />
    ) : (
      <VideoIcon className={iconColorClass} height={24} width={24} />
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

  const getCategoryLabel = (category: string) =>
    LEARNING_CATEGORIES[category as ResourceCategory]?.label ?? category;

  const getCategoryColor = (category: string): BadgeColors =>
    CATEGORY_BADGE_COLORS[category as ResourceCategory] ?? 'gray';

  const handleViewMoreClick = () => {
    onClick?.(resource);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Box
      className={classNames(
        'tw:w-full tw:min-w-0 tw:p-5 tw:rounded-xl tw:bg-primary tw:border tw:border-secondary tw:shadow-xs tw:transition-all',
        onClick && 'tw:cursor-pointer tw:hover:shadow-md'
      )}
      data-clickable={onClick ? 'true' : undefined}
      data-testid={`learning-resource-card-${resource.name}`}
      direction="col"
      gap={3}
      onClick={() => onClick?.(resource)}>
      <Box align="start" className="tw:min-w-0 tw:min-h-10" gap={3}>
        <Box className="tw:shrink-0 tw:mt-0.5">{resourceTypeIcon}</Box>
        <Typography
          as="span"
          className="tw:flex-1 tw:min-w-0 tw:text-primary"
          ellipsis={{ rows: 2 }}
          size="text-sm"
          weight="semibold">
          {resource.displayName || resource.name}
        </Typography>
      </Box>

      <Box className="tw:min-h-14" direction="col" gap={1}>
        {resource.description ? (
          <>
            <Typography
              aria-label={resource.description}
              as="span"
              className="tw:text-tertiary"
              data-testid="learning-resource-description"
              ellipsis={{ rows: showViewMore ? 2 : 3 }}
              size="text-xs">
              {resource.description}
            </Typography>
            {showViewMore && (
              <Box inline className="tw:shrink-0" onClick={stopPropagation}>
                <Button
                  color="link-color"
                  size="sm"
                  onPress={handleViewMoreClick}>
                  {t('label.view-more')}
                </Button>
              </Box>
            )}
          </>
        ) : (
          <Typography
            as="span"
            className="tw:italic tw:text-quaternary"
            data-testid="learning-resource-description"
            size="text-sm">
            {t('label.no-entity-added', {
              entity: t('label.description-lowercase'),
            })}
          </Typography>
        )}
      </Box>

      <Box direction="col" gap={3}>
        <Box
          align="center"
          className="tw:min-w-0 tw:gap-1.5 tw:overflow-hidden">
          {categoryTags.visible.length > 0 ? (
            <>
              <Box className="tw:min-w-0 tw:flex-nowrap tw:gap-1.5 tw:overflow-hidden">
                {categoryTags.visible.map((category) => (
                  <Badge
                    color={getCategoryColor(category)}
                    key={category}
                    size="sm"
                    type="color">
                    {getCategoryLabel(category)}
                  </Badge>
                ))}
              </Box>
              {categoryTags.remaining > 0 && (
                <Box inline className="tw:shrink-0" onClick={stopPropagation}>
                  <PopoverTrigger
                    isOpen={popoverOpen}
                    onOpenChange={setPopoverOpen}>
                    <Button
                      color="secondary"
                      data-testid="more-categories"
                      size="sm">
                      +{categoryTags.remaining}
                    </Button>
                    <Popover
                      containerClassName="tw:p-3"
                      placement="bottom left">
                      <Box className="tw:max-w-[250px] tw:flex-wrap tw:gap-1.5">
                        {categoryTags.hidden.map((category) => (
                          <Badge
                            color={getCategoryColor(category)}
                            key={category}
                            size="sm"
                            type="color">
                            {getCategoryLabel(category)}
                          </Badge>
                        ))}
                      </Box>
                    </Popover>
                  </PopoverTrigger>
                </Box>
              )}
            </>
          ) : (
            <Typography
              as="span"
              className="tw:italic tw:text-quaternary"
              size="text-sm">
              {t('label.no-entity-added', {
                entity: t('label.category-lowercase'),
              })}
            </Typography>
          )}
        </Box>

        <Box align="center" className="tw:shrink-0 tw:gap-1.5">
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
            <Typography as="span" className="tw:text-tertiary" size="text-xs">
              {formattedDuration}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
