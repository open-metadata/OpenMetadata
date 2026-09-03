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

import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { QUICK_FILTERS } from './ExploreQuickFilters.constants';
import type { QuickFilter } from './ExploreQuickFilters.interface';

const QUICK_FILTER_BUTTON_CLASS = classNames(
  'tw:flex tw:h-[30px] tw:shrink-0 tw:cursor-pointer tw:items-center',
  'tw:gap-1.5 tw:whitespace-nowrap tw:rounded-full tw:border',
  'tw:border-brand-100 tw:bg-white/60 tw:px-3',
  'tw:text-[12.5px] tw:font-medium tw:text-brand-700',
  'tw:transition-all tw:duration-150',
  'tw:hover:border-brand-200 tw:hover:bg-white tw:hover:text-brand-800'
);

export interface ExploreQuickFiltersProps {
  onFilterClick: (filter: QuickFilter) => void;
}

export const ExploreQuickFilters = ({
  onFilterClick,
}: ExploreQuickFiltersProps) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <span
        className="tw:mr-0.5 tw:text-xs tw:font-medium tw:text-tertiary"
        data-testid="explore-quick-filter-label">
        {t('label.quick-filter-plural')}
      </span>
      {QUICK_FILTERS.map((filter) => (
        <button
          className={QUICK_FILTER_BUTTON_CLASS}
          data-testid={`explore-quick-filter-${filter.testId}`}
          key={filter.labelKey}
          type="button"
          onClick={() => onFilterClick(filter)}>
          <span
            className={`tw:inline-block tw:size-2 tw:shrink-0 tw:rounded-full ${filter.dotClassName}`}
            style={filter.dotStyle}
          />
          {t(filter.labelKey)}
        </button>
      ))}
    </Box>
  );
};
