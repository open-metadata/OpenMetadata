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
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { stripMarkdown } from '../../../utils/StringUtils';
import { ArticleCardProps } from './ArticleCard.interface';

const ArticleCard: FC<ArticleCardProps> = ({ article, onClick }) => {
  const { t } = useTranslation();
  const { title, description, lastEditedAt, tags = [] } = article;

  const { tagsToShow, remainingTagCount } = useMemo(() => {
    const tagsToShow = tags.slice(0, 2);
    const remainingTagCount = tags.length > 2 ? tags.length - 2 : 0;

    return {
      tagsToShow,
      remainingTagCount,
    };
  }, [tags]);

  return (
    <Card
      isClickable
      className="tw:p-4 tw:flex tw:flex-col tw:bg-gray-50 tw:border-none tw:h-40 tw:justify-between tw:hover:shadow-xl tw:gap-2"
      data-testid="article-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(article)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(article);
        }
      }}>
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Typography ellipsis className="tw:text-gray-700" weight="semibold">
          {title}
        </Typography>
        {description ? (
          <Typography className="tw:text-gray-500 tw:line-clamp-2">
            {stripMarkdown(description)}
          </Typography>
        ) : (
          <Typography className="text-grey-muted">
            {t('label.no-description')}
          </Typography>
        )}

        {tagsToShow.length > 0 && (
          <div className="tw:flex tw:flex-wrap tw:gap-1">
            {tagsToShow.map((tag) => (
              <Badge
                className="tw:bg-gray-200 tw:ring-0 tw:max-w-30 tw:min-w-0"
                color="gray"
                key={tag.label}
                size="sm"
                type="color">
                <Typography
                  ellipsis
                  className="tw:text-gray-700"
                  size="text-xs">
                  {tag.label}
                </Typography>
              </Badge>
            ))}
            {remainingTagCount > 0 && (
              <Badge
                className="tw:bg-gray-200 tw:ring-0"
                color="gray"
                key="count"
                size="sm"
                type="color">
                <Typography
                  ellipsis
                  className="tw:text-gray-700"
                  size="text-xs">
                  +{remainingTagCount}
                </Typography>
              </Badge>
            )}
          </div>
        )}
      </div>
      {lastEditedAt !== undefined && (
        <Typography className="tw:text-gray-400" size="text-xs">
          {t('label.last-updated')} {getShortRelativeTime(lastEditedAt)}
        </Typography>
      )}
    </Card>
  );
};

export default ArticleCard;
