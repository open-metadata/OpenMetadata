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
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import ArticleCard from '../ArticleCard/ArticleCard.component';
import { ArticleCardItem } from '../ArticleCard/ArticleCard.interface';
import { ArticleListSectionProps } from './ArticleListSection.interface';

const ArticleCardSkeleton: FC = () => (
  <Card className="tw:flex tw:flex-col tw:gap-3 tw:p-4">
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
  </Card>
);

const ARTICLE_SKELETON_KEYS = Array.from(
  { length: 6 },
  (_, i) => `article-skeleton-${i}`
);

const ArticleLoading = () =>
  ARTICLE_SKELETON_KEYS.map((key) => <ArticleCardSkeleton key={key} />);

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
  const navigate = useNavigate();

  const handleArticleClick = useCallback(
    (article: ArticleCardItem) => {
      if (onArticleClick) {
        onArticleClick(article);

        return;
      }

      if (article.href) {
        if (article.href.startsWith('http')) {
          window.open(article.href, '_blank', 'noopener,noreferrer');

          return;
        }

        navigate(article.href);

        return;
      }

      const path = contextCenterClassBase.getArticlePath(article.id);

      navigate(path);
    },
    [onArticleClick, navigate]
  );

  return (
    <Card
      className="tw:p-6 tw:overflow-y-scroll tw:h-[calc(50vh-138px)]"
      data-testid="article-list-section">
      <div className="tw:flex tw:items-center tw:justify-between tw:pb-5">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:p-3 tw:rounded-lg tw:bg-gray-blue-50">
            <File06 className="tw:text-gray-600" height={20} width={20} />
          </div>
          <div className="tw:flex tw:flex-col">
            <Typography size="text-md" weight="bold">
              {title}
            </Typography>
            {subtitle && (
              <Typography className="tw:text-gray-500" size="text-xs">
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

      {articles.length > 0 || isLoading ? (
        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,320px)]  tw:gap-4">
          {isLoading ? (
            <ArticleLoading />
          ) : (
            articles.map((article: ArticleCardItem) => (
              <ArticleCard
                article={article}
                key={article.id}
                onClick={handleArticleClick}
              />
            ))
          )}
        </div>
      ) : (
        <ErrorPlaceHolder
          className="tw:border-0 tw:h-auto"
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      )}
    </Card>
  );
};

export default ArticleListSection;
