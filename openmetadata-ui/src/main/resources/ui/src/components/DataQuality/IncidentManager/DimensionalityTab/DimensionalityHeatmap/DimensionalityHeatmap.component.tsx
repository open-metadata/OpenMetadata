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

import { Typography } from '@openmetadata/ui-core-components';
import { Tooltip } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RightArrowIcon } from '../../../../../assets/svg/right-arrow.svg';
import Loader from '../../../../common/Loader/Loader';
import { DimensionalityHeatmapProps } from './DimensionalityHeatmap.interface';
import './DimensionalityHeatmap.less';
import {
  generateDateRange,
  getDateLabel,
  getStatusLabel,
  transformDimensionResultsToHeatmapData,
} from './DimensionalityHeatmap.utils';
import { HeatmapCellTooltip } from './HeatmapCellTooltip.component';
import { useScrollIndicator } from './useScrollIndicator.hook';

const DimensionalityHeatmap = ({
  data,
  startDate,
  endDate,
  isLoading = false,
}: DimensionalityHeatmapProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const dateRange = useMemo(
    () => generateDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const heatmapData = useMemo(
    () => transformDimensionResultsToHeatmapData(data, startDate, endDate),
    [data, startDate, endDate]
  );

  const {
    showLeftIndicator,
    showRightIndicator,
    handleScrollLeft,
    handleScrollRight,
  } = useScrollIndicator(containerRef, [heatmapData]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [startDate, endDate]);

  if (isLoading) {
    return <Loader size="small" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="dimensionality-heatmap__empty tw:py-8 tw:text-center">
        <Typography as="span" className="tw:text-body tw:text-tertiary">
          {t('message.no-data-available')}
        </Typography>
      </div>
    );
  }

  return (
    <div
      aria-label={t('label.dimensionality')}
      className="dimensionality-heatmap tw:w-full"
    >
      <div className="dimensionality-heatmap__layout tw:flex">
        <div className="dimensionality-heatmap__labels-column tw:shrink-0">
          <div className="dimensionality-heatmap__header-corner" />
          {heatmapData.map((row) => (
            <Tooltip key={row.dimensionValue} title={row.dimensionValue}>
              <div className="dimensionality-heatmap__dimension-label tw:cursor-default">
                {row.dimensionValue}
              </div>
            </Tooltip>
          ))}
        </div>

        <div className="dimensionality-heatmap__scroll-wrapper tw:relative tw:flex-1">
          {showLeftIndicator && (
            <button
              aria-label={`${t('label.scroll')} ${t('label.left')}`}
              className="dimensionality-heatmap__scroll-indicator dimensionality-heatmap__scroll-indicator--left tw:cursor-pointer tw:outline-focus-ring"
              type="button"
              onClick={handleScrollLeft}
            >
              <RightArrowIcon />
            </button>
          )}

          <div
            className="dimensionality-heatmap__scroll-container tw:overflow-auto"
            ref={containerRef}
          >
            <div className="dimensionality-heatmap__header-row tw:flex">
              {dateRange.map((date) => (
                <div
                  aria-label={getDateLabel(date)}
                  className="dimensionality-heatmap__header-cell"
                  key={date}
                >
                  {getDateLabel(date)}
                </div>
              ))}
            </div>

            {heatmapData.map((row) => (
              <div
                className="dimensionality-heatmap__data-row tw:flex"
                key={`row-${row.dimensionValue}`}
              >
                {row.cells.map((cell) => (
                  <Tooltip
                    key={`${cell.dimensionValue}-${cell.date}`}
                    overlayClassName="dimensionality-heatmap-cell-tooltip"
                    placement="top"
                    showArrow={false}
                    title={<HeatmapCellTooltip cell={cell} />}
                  >
                    <div
                      aria-label={`${cell.dimensionValue}, ${getDateLabel(
                        cell.date
                      )}: ${getStatusLabel(cell.status, t)}`}
                      className={`dimensionality-heatmap__cell dimensionality-heatmap__cell--${cell.status} tw:cursor-default`}
                    />
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>

          {showRightIndicator && (
            <button
              aria-label={`${t('label.view')} ${t('label.more')}`}
              className="dimensionality-heatmap__scroll-indicator dimensionality-heatmap__scroll-indicator--right tw:cursor-pointer tw:outline-focus-ring"
              type="button"
              onClick={handleScrollRight}
            >
              <RightArrowIcon />
            </button>
          )}
        </div>
      </div>

      <div className="dimensionality-heatmap__legend tw:mt-4 tw:flex tw:flex-wrap tw:gap-4">
        <div className="dimensionality-heatmap__legend-item tw:flex tw:items-center tw:gap-2">
          <div className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--success tw:shrink-0" />
          <Typography as="span" className="tw:text-body">
            {t('label.success')}
          </Typography>
        </div>
        <div className="dimensionality-heatmap__legend-item tw:flex tw:items-center tw:gap-2">
          <div className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--failed tw:shrink-0" />
          <Typography as="span" className="tw:text-body">
            {t('label.failed')}
          </Typography>
        </div>
        <div className="dimensionality-heatmap__legend-item tw:flex tw:items-center tw:gap-2">
          <div className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--aborted tw:shrink-0" />
          <Typography as="span" className="tw:text-body">
            {t('label.aborted')}
          </Typography>
        </div>
        <div className="dimensionality-heatmap__legend-item tw:flex tw:items-center tw:gap-2">
          <div className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--no-data tw:shrink-0" />
          <Typography as="span" className="tw:text-body">
            {t('label.no-data')}
          </Typography>
        </div>
      </div>
    </div>
  );
};

export default DimensionalityHeatmap;
