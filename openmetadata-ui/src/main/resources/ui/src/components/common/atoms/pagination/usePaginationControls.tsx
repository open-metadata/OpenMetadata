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
  Box,
  Button,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Typography,
  useTheme,
} from '@mui/material';
import { ArrowLeft, ArrowRight } from '@untitledui/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { formatNumberWithComma } from '../../../../utils/CommonUtils';

// Default rows per page options used across pagination components
const DEFAULT_ROWS_PER_PAGE_OPTIONS = [
  PAGE_SIZE,
  PAGE_SIZE_MEDIUM,
  PAGE_SIZE_LARGE,
] as const;

interface PaginationControlsConfig {
  currentPage: number;
  totalPages: number;
  totalEntities: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  rowsPerPageOptions?: number[];
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

  const rowsPerPageOptions = useMemo(
    () => config.rowsPerPageOptions ?? [...DEFAULT_ROWS_PER_PAGE_OPTIONS],
    [config.rowsPerPageOptions]
  );

  // Ensure the selected value is in the options, otherwise use the first option
  const selectedPageSize = useMemo(() => {
    return rowsPerPageOptions.includes(config.pageSize)
      ? config.pageSize
      : rowsPerPageOptions[0];
  }, [rowsPerPageOptions, config.pageSize]);

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    const newPageSize = event.target.value as number;
    if (config.onPageSizeChange) {
      config.onPageSizeChange(newPageSize);
    }
  };

  // Calculate displayed rows range
  const displayedRowsRange = useMemo(() => {
    const start = (config.currentPage - 1) * config.pageSize + 1;
    const end = Math.min(
      config.currentPage * config.pageSize,
      config.totalEntities
    );

    return { start, end };
  }, [config.currentPage, config.pageSize, config.totalEntities]);

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

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}>
          {config.onPageSizeChange && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
              <Typography
                sx={{
                  fontSize: theme.typography.pxToRem(14),
                  color: theme.palette.text.secondary,
                  whiteSpace: 'nowrap',
                  marginRight: theme.spacing(1),
                }}>
                {`${formatNumberWithComma(
                  displayedRowsRange.start
                )}-${formatNumberWithComma(displayedRowsRange.end)} ${t(
                  'label.of'
                )} ${formatNumberWithComma(config.totalEntities)}`}
              </Typography>
              <Select
                data-testid="rows-per-page-select"
                size="small"
                sx={{
                  '&.MuiOutlinedInput-root .MuiOutlinedInput-input': {
                    fontSize: `${theme.typography.pxToRem(14)}`,
                  },
                  '& .MuiOutlinedInput-input.MuiInputBase-inputSizeSmall': {
                    padding: '6px 32px 6px 12px !important',
                  },
                }}
                value={selectedPageSize}
                onChange={handlePageSizeChange}>
                {rowsPerPageOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}

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
      </Box>
    ),
    [
      config.currentPage,
      config.totalPages,
      config.pageSize,
      config.totalEntities,
      config.onPageChange,
      config.onPageSizeChange,
      rowsPerPageOptions,
      displayedRowsRange,
      selectedPageSize,
      theme,
      t,
    ]
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
