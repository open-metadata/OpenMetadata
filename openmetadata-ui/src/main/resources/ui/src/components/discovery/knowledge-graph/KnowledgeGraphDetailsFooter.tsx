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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface KnowledgeGraphDetailsFooterProps {
  /** Rows matching the current search and filter. */
  total: number;
  /** Rows currently rendered. */
  limit: number;
  pageSize: number;
  /** Columns still to fetch from the server; 0 when all are loaded. */
  unloadedColumns: number;
  isLoadingColumns: boolean;
  onShowMore: () => void;
  onLoadColumns: () => void;
}

/** Paging row under the details table; hidden when there is nothing more to show. */
const KnowledgeGraphDetailsFooter = ({
  total,
  limit,
  pageSize,
  unloadedColumns,
  isLoadingColumns,
  onShowMore,
  onLoadColumns,
}: KnowledgeGraphDetailsFooterProps) => {
  const { t } = useTranslation();
  const hasMoreRows = total > limit;
  if (!hasMoreRows && unloadedColumns === 0) {
    return null;
  }

  return (
    <Box
      align="center"
      className="tw:min-h-8 tw:shrink-0 tw:border-t tw:border-secondary tw:px-3.5 tw:py-1"
      gap={3}
      justify="between"
      wrap="wrap">
      <Typography aria-live="polite" color="secondary" size="text-xs">
        {t('label.kg-list-count', { count: total })}
      </Typography>
      <Box align="center" gap={3}>
        {unloadedColumns > 0 && (
          <Button
            color="link-color"
            isLoading={isLoadingColumns}
            size="xs"
            onPress={onLoadColumns}>
            {t('label.kg-load-columns', { count: unloadedColumns })}
          </Button>
        )}
        {hasMoreRows && (
          <Button color="link-color" size="xs" onPress={onShowMore}>
            {t('label.kg-show-more', {
              count: Math.min(pageSize, total - limit),
              total,
            })}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default KnowledgeGraphDetailsFooter;
