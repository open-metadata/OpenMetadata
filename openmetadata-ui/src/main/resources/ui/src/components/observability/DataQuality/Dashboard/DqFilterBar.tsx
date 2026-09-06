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
import { Box, Button } from '@openmetadata/ui-core-components';
import { XCircle } from '@untitledui/icons';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DqDateRangeFilter from './DqDateRangeFilter';
import { DqFilterBarProps } from './DqFilterBar.types';
import DqFilterChip from './DqFilterChip';

export const DqFilterBar = ({
  filters,
  dateRange,
  onDateRangeChange,
  showFilterBar,
  hasVisibleFilters,
  hasActiveFilters,
  clearAll,
}: DqFilterBarProps) => {
  const { t } = useTranslation();

  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  const handleFilterOpenChange = useCallback(
    (key: string, open: boolean) =>
      setOpenFilterKey((prev) => {
        if (open) {
          return key;
        }

        return prev === key ? null : prev;
      }),
    []
  );

  // Close any open filter before clearing so a picker can't linger showing
  // stale locally-staged selections after the filters reset.
  const handleClearAll = useCallback(() => {
    setOpenFilterKey(null);
    clearAll();
  }, [clearAll]);

  return (
    <Box align="center" data-testid="dq-filter-bar" gap={3} wrap="wrap">
      <DqDateRangeFilter
        endTs={dateRange.endTs}
        startTs={dateRange.startTs}
        onApply={onDateRangeChange}
      />
      {showFilterBar &&
        hasVisibleFilters &&
        filters.map((filter) => (
          <DqFilterChip
            filter={filter}
            isOpen={openFilterKey === filter.key}
            key={filter.key}
            onOpenChange={(open) => handleFilterOpenChange(filter.key, open)}
          />
        ))}
      {hasActiveFilters && (
        <Button
          className="tw:ml-auto"
          color="secondary"
          data-testid="clear-all-filter-btn"
          iconLeading={XCircle}
          size="xs"
          onPress={handleClearAll}>
          {t('label.clear-entity', { entity: t('label.all') })}
        </Button>
      )}
    </Box>
  );
};

export default DqFilterBar;
