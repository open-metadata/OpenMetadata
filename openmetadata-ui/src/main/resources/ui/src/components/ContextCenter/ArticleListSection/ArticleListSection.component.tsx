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

import {
  Button,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUpRight, File06 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import ArticleCard from '../ArticleCard/ArticleCard.component';
import { ArticleCardItem } from '../ArticleCard/ArticleCard.interface';
import { ArticleListSectionProps } from './ArticleListSection.interface';

const ArticleCardSkeleton: FC = () => (
  <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4 tw:rounded-xl tw:border tw:border-[var(--color-border-primary)]">
    <div className="tw:flex tw:justify-between tw:gap-4">
      <Skeleton height="20px" variant="rounded" width="64px" />
      <Skeleton height="16px" variant="rounded" width="96px" />
    </div>
    <Skeleton height="16px" variant="rounded" width="75%" />
    <Skeleton height="12px" variant="rounded" width="100%" />
    <Skeleton height="12px" variant="rounded" width="83%" />
    <div className="tw:flex tw:gap-1">
      <Skeleton height="20px" variant="rounded" width="56px" />
      <Skeleton height="20px" variant="rounded" width="40px" />
    </div>
  </div>
);

const ArticleListSection: FC<ArticleListSectionProps> = ({
  title,
  subtitle,
  articles,
  viewAllHref,
  onViewAll,
  onArticleClick,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      className="tw:p-6 tw:overflow-y-scroll tw:h-[calc(50vh-80px)]"
      data-testid="article-list-section">
      <div className="tw:flex tw:items-center tw:justify-between tw:pb-5">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:p-3 tw:rounded-lg tw:bg-gray-blue-50">
            <File06 className="tw:text-grey-600" height={20} width={20} />
          </div>
          <div className="tw:flex tw:flex-col">
            <Typography size="text-md" weight="bold">
              {title}
            </Typography>
            {subtitle && (
              <Typography className="tw:text-grey-500" size="text-xs">
                {subtitle}
              </Typography>
            )}
          </div>
        </div>

        {(viewAllHref || onViewAll) && (
          <Button
            color="link-color"
            iconTrailing={<ArrowUpRight className="tw:w-4 tw:h-4" />}
            onClick={onViewAll}>
            {t('label.view-all')} {t('label.article-plural')}
          </Button>
        )}
      </div>

      <div className="tw:grid tw:grid-cols-3 tw:gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <ArticleCardSkeleton key={idx} />
            ))
          : articles.map((article: ArticleCardItem) => (
              <ArticleCard
                article={article}
                key={article.id}
                onClick={onArticleClick}
              />
            ))}
      </div>
    </Card>
  );
};

export default ArticleListSection;
