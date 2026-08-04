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

import { Box, Skeleton } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';

export type EntityDetailWidgetSkeletonVariant = 'text' | 'list' | 'table';

interface EntityDetailWidgetSkeletonProps {
  variant?: EntityDetailWidgetSkeletonVariant;
  widgetKey?: string;
}

const TABLE_WIDGET_KEYS = new Set<string>([
  DetailPageWidgetKeys.DIRECTORY_CHILDREN,
  DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
  DetailPageWidgetKeys.PARTITIONED_KEYS,
  DetailPageWidgetKeys.PIPELINE_TASKS,
  DetailPageWidgetKeys.SEARCH_INDEX_FIELDS,
  DetailPageWidgetKeys.TABLE_CONSTRAINTS,
  DetailPageWidgetKeys.TABLE_SCHEMA,
  DetailPageWidgetKeys.TABLES,
  DetailPageWidgetKeys.TOPIC_SCHEMA,
  DetailPageWidgetKeys.WORKSHEET_COLUMNS,
]);

const TEXT_ROW_WIDTHS = [
  'tw:w-full',
  'tw:w-11/12',
  'tw:w-4/5',
  'tw:w-2/3',
] as const;

const LIST_ROW_WIDTHS = ['tw:w-3/4', 'tw:w-2/3', 'tw:w-1/2'] as const;

const TABLE_ROWS = Array.from({ length: 5 }, (_, index) => index);

const getSkeletonVariant = (
  widgetKey?: string
): EntityDetailWidgetSkeletonVariant => {
  if (widgetKey?.startsWith(DetailPageWidgetKeys.DESCRIPTION)) {
    return 'text';
  }

  if (
    widgetKey &&
    [...TABLE_WIDGET_KEYS].some((key) => widgetKey.startsWith(key))
  ) {
    return 'table';
  }

  return 'list';
};

export const EntityDetailWidgetSkeleton = ({
  variant,
  widgetKey,
}: EntityDetailWidgetSkeletonProps) => {
  const { t } = useTranslation();
  const resolvedVariant = variant ?? getSkeletonVariant(widgetKey);

  let rows;

  if (resolvedVariant === 'text') {
    rows = TEXT_ROW_WIDTHS.map((width) => (
      <Box data-testid="widget-skeleton-row" key={width}>
        <Skeleton animation={false} className={width} />
      </Box>
    ));
  } else if (resolvedVariant === 'table') {
    rows = TABLE_ROWS.map((row) => (
      <Box
        className="tw:w-full"
        data-testid="widget-skeleton-row"
        gap={3}
        key={row}>
        <Skeleton animation={false} className="tw:w-1/4" />
        <Skeleton animation={false} className="tw:w-2/3" />
      </Box>
    ));
  } else {
    rows = LIST_ROW_WIDTHS.map((width) => (
      <Box data-testid="widget-skeleton-row" key={width}>
        <Skeleton animation={false} className={width} variant="rounded" />
      </Box>
    ));
  }

  return (
    <Box
      aria-label={t('label.loading')}
      className="tw:h-full tw:w-full tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4"
      data-testid="entity-detail-widget-skeleton"
      data-variant={resolvedVariant}
      direction="col"
      gap={4}
      role="status">
      <Skeleton animation={false} className="tw:w-1/3" variant="rounded" />
      {rows}
    </Box>
  );
};
