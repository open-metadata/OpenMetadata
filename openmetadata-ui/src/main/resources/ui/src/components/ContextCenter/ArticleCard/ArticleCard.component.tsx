/*
 *  Copyright 2026 Collate.
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

import { Badge, Card, Typography } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { ArticleCardItem, ArticleCardProps } from './ArticleCard.interface';

const badgeColorMap: Record<
  NonNullable<ArticleCardItem['badge']>,
  'error' | 'brand'
> = {
  sensitive: 'error',
  new: 'brand',
};

const ArticleCard: FC<ArticleCardProps> = ({ article, onClick }) => {
  const { t } = useTranslation();
  const { title, description, badge, lastEditedAt, tags = [] } = article;

  return (
    <Card
      isClickable
      className="tw:p-4 tw:flex tw:flex-col tw:gap-2 tw:bg-gray-50 tw:border-none tw:max-w-86"
      data-testid="article-card"
      onClick={() => onClick?.(article)}>
      <div className="tw:flex tw:items-center tw:justify-between tw:w-full tw:mb-3">
        {badge && (
          <Badge
            className="tw:ring-0"
            color={badgeColorMap[badge]}
            size="md"
            type="color">
            {badge}
          </Badge>
        )}
        {!badge && <span />}
        {lastEditedAt !== undefined && (
          <Typography className="tw:text-gray-400" size="text-xs">
            {t('label.last-updated')} {getShortRelativeTime(lastEditedAt)}
          </Typography>
        )}
      </div>

      <Typography ellipsis weight="bold">
        {title}
      </Typography>

      <Typography
        className="tw:text-gray-500 tw:line-clamp-2 tw:m-0"
        size="text-xs">
        {description}
      </Typography>

      {tags.length > 0 && (
        <div className="tw:flex tw:flex-wrap tw:gap-1 tw:mt-3">
          {tags.map((tag) => (
            <Badge
              className="tw:bg-gray-200 tw:ring-0"
              color="gray"
              key={tag.label}
              size="md"
              type="color">
              {tag.label}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
};

export default ArticleCard;
