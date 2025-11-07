/*
 *  Copyright 2025 Collate.
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

import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DimensionalityHeatmapProps } from './DimensionalityHeatmap.interface';
import './DimensionalityHeatmap.less';
import {
  generateDateRange,
  getDateLabel,
  transformDimensionResultsToHeatmapData,
} from './DimensionalityHeatmap.utils';

const DimensionalityHeatmap = ({
  data,
  startDate,
  endDate,
  isLoading = false,
}: DimensionalityHeatmapProps) => {
  const { t } = useTranslation();

  const dateRange = useMemo(
    () => generateDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const heatmapData = useMemo(
    () => transformDimensionResultsToHeatmapData(data, startDate, endDate),
    [data, startDate, endDate]
  );

  if (isLoading) {
    return (
      <Box className="dimensionality-heatmap__loading">
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box className="dimensionality-heatmap__empty">
        <Typography>{t('message.no-data-available')}</Typography>
      </Box>
    );
  }

  return (
    <Box className="dimensionality-heatmap">
      <Box className="dimensionality-heatmap__container">
        <Box
          className="dimensionality-heatmap__grid"
          sx={{
            gridTemplateColumns: `200px repeat(${dateRange.length}, 60px)`,
          }}>
          <Box className="dimensionality-heatmap__header-corner">
            {t('label.dimension-value')}
          </Box>
          {dateRange.map((date) => (
            <Box className="dimensionality-heatmap__header-cell" key={date}>
              {getDateLabel(date)}
            </Box>
          ))}

          {heatmapData.map((row) => (
            <>
              <Tooltip
                key={`label-${row.dimensionValue}`}
                title={row.dimensionValue}>
                <Box className="dimensionality-heatmap__dimension-label">
                  {row.dimensionValue}
                </Box>
              </Tooltip>

              {row.cells.map((cell) => (
                <Tooltip
                  key={`${cell.dimensionValue}-${cell.date}`}
                  title={
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                        {cell.date}
                      </Typography>
                      <Typography sx={{ fontSize: 11 }}>
                        {`${t('label.dimension-value')}: ${
                          cell.dimensionValue
                        }`}
                      </Typography>
                      <Typography sx={{ fontSize: 11 }}>
                        {t('label.status')}:{' '}
                        {cell.status === 'success'
                          ? t('label.passed')
                          : cell.status === 'failed'
                          ? t('label.failed')
                          : t('label.no-data')}
                      </Typography>
                      {cell.result && (
                        <>
                          {cell.result.passedRows !== undefined && (
                            <Typography sx={{ fontSize: 11 }}>
                              {`${t('label.passed-rows')}: ${
                                cell.result.passedRows
                              }`}
                            </Typography>
                          )}
                          {cell.result.failedRows !== undefined && (
                            <Typography sx={{ fontSize: 11 }}>
                              {`${t('label.failed-rows')}: ${
                                cell.result.failedRows
                              }`}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  }>
                  <Box
                    className={`dimensionality-heatmap__cell dimensionality-heatmap__cell--${cell.status}`}
                  />
                </Tooltip>
              ))}
            </>
          ))}
        </Box>
      </Box>

      <Box className="dimensionality-heatmap__legend">
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--failed" />
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {t('label.failed')}
          </Typography>
        </Box>
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--success" />
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {t('label.passed')}
          </Typography>
        </Box>
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--no-data" />
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {t('label.no-data')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default DimensionalityHeatmap;
