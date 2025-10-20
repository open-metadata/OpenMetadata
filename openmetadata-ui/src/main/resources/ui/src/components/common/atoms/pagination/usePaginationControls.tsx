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

import { Box, Button, Pagination, useTheme } from '@mui/material';
import { ArrowLeft, ArrowRight } from '@untitledui/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationControlsConfig {
  currentPage: number;
  totalPages: number;
  totalEntities: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export const usePaginationControls = (config: PaginationControlsConfig) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const goToFirstPage = () => config.onPageChange(1);
  const goToLastPage = () => config.onPageChange(config.totalPages);
  const goToNextPage = () =>
    config.onPageChange(Math.min(config.currentPage + 1, config.totalPages));
  const goToPreviousPage = () =>
    config.onPageChange(Math.max(config.currentPage - 1, 1));

  const showPagination = config.totalPages > 1;

  // Inline implementation copying exact EntityPagination styling
  const paginationControls = useMemo(
    () => (
      <Box
        data-testid="pagination"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${theme.palette.allShades?.gray?.[200]}`,
          pt: 3.5,
          px: 6,
          pb: 5,
        }}>
        <Button
          color="secondary"
          data-testid="previous"
          disabled={config.currentPage === 1}
          size="small"
          startIcon={
            <ArrowLeft
              style={{ color: theme.palette.allShades?.gray?.[400] }}
            />
          }
          variant="contained"
          onClick={() => config.onPageChange(config.currentPage - 1)}>
          {t('label.previous')}
        </Button>

        <Pagination
          hideNextButton
          hidePrevButton
          count={config.totalPages}
          page={config.currentPage}
          shape="rounded"
          variant="outlined"
          onChange={(_, page) => config.onPageChange(page)}
        />

        <Button
          color="secondary"
          data-testid="next"
          disabled={config.currentPage >= config.totalPages}
          endIcon={
            <ArrowRight
              style={{ color: theme.palette.allShades?.gray?.[400] }}
            />
          }
          size="small"
          variant="contained"
          onClick={() => config.onPageChange(config.currentPage + 1)}>
          {t('label.next')}
        </Button>
      </Box>
    ),
    [config.currentPage, config.totalPages, config.onPageChange, theme, t]
  );

  return {
    paginationControls,
    currentPage: config.currentPage,
    totalPages: config.totalPages,
    showPagination,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
  };
};
