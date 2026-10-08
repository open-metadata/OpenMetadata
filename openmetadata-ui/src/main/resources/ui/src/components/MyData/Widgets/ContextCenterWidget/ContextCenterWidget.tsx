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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { File06 as Articles } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from '../../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../../utils/ContextCenterClassBase';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEncodedFqn, getSafeHttpUrl } from '../../../../utils/StringUtils';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';

export const CONTEXT_CENTER_QUERY_KEY = [
  'landingPage',
  'widgets',
  'contextCenter',
];
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 7;
const TTL_MS = 5 * 60 * 1000;

export const CONTEXT_CENTER_FETCH_LIMIT = 10;
// The card is a digest; the footer link opens the full Context Center.
const MAX_VISIBLE_ROWS = 6;

const TONE = {
  icon: Articles,
  tile: 'tw:bg-utility-gray-100 tw:text-utility-gray-700',
};

const PAGE_TYPE_LABEL_KEYS: Partial<Record<PageType, string>> = {
  [PageType.ARTICLE]: 'label.article',
  [PageType.QUICK_LINK]: 'label.quick-link',
};

interface RecentPages {
  pages: KnowledgePage[];
  total: number;
}

/**
 * The most recently updated pages first. `sortBy` is what makes the slice
 * meaningful: unsorted, the endpoint pages in storage order and the card would
 * show ten arbitrary pages.
 */
const fetchRecentPages = async (): Promise<RecentPages> => {
  const response = await getListKnowledgePages({
    limit: CONTEXT_CENTER_FETCH_LIMIT,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });
  const pages = response.data ?? [];

  return { pages, total: response.paging?.total ?? pages.length };
};

/**
 * Pages updated inside the window. The list is newest-first, so the recent
 * ones are a prefix of it and the count is exact — unless every fetched page
 * is recent and more exist, in which case it is a floor and says so ("10+").
 */
const getRecentLabel = ({ pages, total }: RecentPages, t: TFunction) => {
  const since = Date.now() - RECENT_WINDOW_DAYS * DAY_MS;
  const recent = pages.filter((page) => (page.updatedAt ?? 0) >= since).length;
  const isFloor = recent === pages.length && total > pages.length;

  return {
    label: t(
      isFloor
        ? 'message.count-plus-pages-updated-this-week'
        : 'message.count-pages-updated-this-week',
      { count: recent }
    ),
    recent,
  };
};

/** A quick link opens its own URL; anything else opens the article page. */
const getQuickLinkUrl = (page: KnowledgePage): string | undefined =>
  page.pageType === PageType.QUICK_LINK
    ? getSafeHttpUrl((page.page as QuickLink | undefined)?.url)
    : undefined;

export type ContextCenterWidgetProps = WidgetCommonProps;

/** The Context Center pages most recently written or revised. */
const ContextCenterWidget: React.FC<ContextCenterWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isError, isPending, refetch } = useQuery<RecentPages>({
    queryFn: fetchRecentPages,
    queryKey: CONTEXT_CENTER_QUERY_KEY,
    staleTime: TTL_MS,
  });

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const { label: recentLabel, recent } = getRecentLabel(
    { pages, total: data?.total ?? 0 },
    t
  );

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.context-center') }),
        onPress: () => navigate(ROUTES.CONTEXT_CENTER_ARTICLES),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isLoading={isPending}
      status={
        // Nothing new is worth saying out loud — it is the reassuring case.
        recent === 0 && !isError
          ? { color: 'success', label: t('label.caught-up') }
          : undefined
      }
      summary={isError ? t('message.something-went-wrong') : recentLabel}
      title={t('label.context-center')}
      tone={TONE}
      topicKey={TopicKey.CONTEXT_CENTER}
      widgetKey={widgetKey}
      onRetry={() => void refetch()}>
      {!isError && pages.length === 0 && (
        // `!` on the colour: Typography renders `.prose`, whose unlayered
        // `color` rule is emitted after the Tailwind utilities.
        <Typography
          className="tw:text-text-secondary!"
          data-testid="context-center-empty"
          size="text-sm">
          {t('message.no-articles-published-recently')}
        </Typography>
      )}
      {!isError && pages.length > 0 && (
        <ul
          className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="context-center-rows">
          {pages.slice(0, MAX_VISIBLE_ROWS).map((page) => {
            const quickLinkUrl = getQuickLinkUrl(page);
            const openLabel = t('label.read');
            const openTestId = `context-page-open-${page.id}`;

            return (
              <li
                className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-3"
                data-testid={`context-page-${page.id}`}
                key={page.id}>
                <div
                  aria-hidden
                  className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-blue-50 tw:text-utility-blue-600">
                  <Articles size={16} />
                </div>
                <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                  <Typography
                    className="tw:min-w-0 tw:text-text-primary!"
                    ellipsis={{ rows: 1 }}
                    size="text-sm"
                    weight="medium">
                    {getEntityName(page)}
                  </Typography>
                  <Typography
                    className="tw:min-w-0 tw:text-text-tertiary!"
                    ellipsis={{ rows: 1 }}
                    size="text-sm">
                    {t('message.page-type-updated-time', {
                      pageType: t(
                        PAGE_TYPE_LABEL_KEYS[page.pageType] ?? 'label.page'
                      ),
                      time: getRelativeTime(page.updatedAt),
                    })}
                  </Typography>
                </div>
                {quickLinkUrl ? (
                  <Button
                    className="tw:shrink-0"
                    color="link-color"
                    data-testid={openTestId}
                    href={quickLinkUrl}
                    rel="noopener noreferrer"
                    size="sm"
                    target="_blank">
                    {openLabel}
                  </Button>
                ) : (
                  <Button
                    className="tw:shrink-0"
                    color="link-color"
                    data-testid={openTestId}
                    size="sm"
                    onPress={() =>
                      navigate(
                        contextCenterClassBase.getArticlePath(
                          getEncodedFqn(page.fullyQualifiedName)
                        )
                      )
                    }>
                    {openLabel}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </TopicCard>
  );
};

export default ContextCenterWidget;
