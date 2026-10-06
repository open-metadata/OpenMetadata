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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { KnowledgePage } from '../../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../../rest/knowledgeCenterAPI';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';

export const CONTEXT_CENTER_QUERY_KEY = [
  'landingPage',
  'widgets',
  'contextCenter',
];
const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_WINDOW_DAYS = 7;
const TTL_MS = 5 * 60 * 1000;
const FETCH_LIMIT = 10;
// The card is a digest; the footer link opens the full Context Center.
const MAX_VISIBLE_ROWS = 6;

const TONE = {
  icon: Articles,
  tile: 'tw:bg-utility-gray-100 tw:text-utility-gray-700',
};

const fetchKnowledgePages = async (
  userId: string
): Promise<KnowledgePage[]> => {
  const response = await getListKnowledgePages({
    entityId: userId,
    entityType: EntityType.USER,
    limit: FETCH_LIMIT,
  });

  return response.data ?? [];
};

export type ContextCenterWidgetProps = WidgetCommonProps;

/** Articles, runbooks and glossary pages worth reading. */
const ContextCenterWidget: React.FC<ContextCenterWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const userId = currentUser?.id;

  const { data, isError, isPending } = useQuery<KnowledgePage[]>({
    enabled: Boolean(userId),
    queryFn: () => fetchKnowledgePages(userId ?? ''),
    queryKey: [...CONTEXT_CENTER_QUERY_KEY, userId],
    staleTime: TTL_MS,
  });

  const pages = useMemo(() => data ?? [], [data]);
  const newCount = useMemo(() => {
    const since = Date.now() - NEW_WINDOW_DAYS * DAY_MS;

    return pages.filter((page) => (page.updatedAt ?? 0) >= since).length;
  }, [pages]);

  const summary = isError
    ? t('message.something-went-wrong')
    : t('message.count-new-articles-this-week', { count: newCount });

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.context-center') }),
        onPress: () => navigate(ROUTES.CONTEXT_CENTER_ARTICLES),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isLoading={isPending}
      meta={t('message.count-new-articles-this-week', { count: newCount })}
      status={
        // Nothing new is worth saying out loud — it is the reassuring case.
        newCount === 0 && !isError
          ? { color: 'success', label: t('label.caught-up') }
          : undefined
      }
      summary={summary}
      title={t('label.context-center')}
      tone={TONE}
      topicKey={TopicKey.CONTEXT_CENTER}
      widgetKey={widgetKey}>
      {pages.length === 0 ? (
        // `!` on the colour: Typography renders `.prose`, whose unlayered
        // `color` rule is emitted after the Tailwind utilities.
        <Typography className="tw:text-text-secondary!" size="text-sm">
          {t('message.no-articles-published-recently')}
        </Typography>
      ) : (
        <ul
          className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="context-center-rows">
          {pages.slice(0, MAX_VISIBLE_ROWS).map((page) => (
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
                  {`${page.pageType} · ${t(
                    'label.updated-lowercase'
                  )} ${getRelativeTime(page.updatedAt)}`}
                </Typography>
              </div>
              <Button
                className="tw:shrink-0"
                color="link-color"
                size="sm"
                onPress={() =>
                  navigate(
                    `${ROUTES.CONTEXT_CENTER_ARTICLES}/${page.fullyQualifiedName}`
                  )
                }>
                {t('label.read')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </TopicCard>
  );
};

export default ContextCenterWidget;
