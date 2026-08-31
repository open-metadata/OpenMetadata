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
import { Box, Button, Select } from '@openmetadata/ui-core-components';
import { XCircle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { TEST_DEFINITION_FILTERS } from '../../../constants/TestDefinition.constants';

/**
 * `label.all` is the Select's placeholder, which is only rendered while nothing
 * is picked — so once a filter has a value there is no way back to unfiltered.
 * A real "All" entry keeps that exit in the list; picking it clears the filter,
 * which restores the placeholder.
 */
const ALL_OPTION_ID = '__all__';

interface TestDefinitionFilterBarProps {
  filterValues: Record<string, string[]>;
  hasActiveFilters: boolean;
  onFilterChange: (key: string, value?: string) => void;
  onClearAll: () => void;
}

/**
 * App-mode filter bar for the Test Library — label-on-top untitled-ui selects
 * (Entity Type, Test Platform) per the 2.0 design. State lives in
 * useTestDefinitionListPage; this only renders the controls.
 */
const TestDefinitionFilterBar = ({
  filterValues,
  hasActiveFilters,
  onFilterChange,
  onClearAll,
}: TestDefinitionFilterBarProps) => {
  const { t } = useTranslation();

  return (
    <Box align="end" className="tw:w-full" gap={4}>
      {TEST_DEFINITION_FILTERS.map((filter) => {
        const items = [
          { id: ALL_OPTION_ID, label: t('label.all') },
          ...filter.options.map((option) => ({
            id: String(option.key),
            label: option.label,
          })),
        ];

        return (
          <div className="tw:w-44" key={filter.key}>
            <Select
              aria-label={t(filter.label)}
              items={items}
              label={t(filter.label)}
              placeholder={t('label.all')}
              size="sm"
              value={filterValues[filter.key]?.[0] ?? null}
              onChange={(value) =>
                onFilterChange(
                  filter.key,
                  value == null || value === ALL_OPTION_ID
                    ? undefined
                    : String(value)
                )
              }>
              {(item) => <Select.Item id={item.id} label={item.label} />}
            </Select>
          </div>
        );
      })}

      {hasActiveFilters && (
        <Button
          className="tw:ml-auto"
          color="secondary"
          data-testid="clear-all-filter-btn"
          iconLeading={XCircle}
          size="xs"
          onPress={onClearAll}>
          {t('label.clear-entity', { entity: t('label.all') })}
        </Button>
      )}
    </Box>
  );
};

export default TestDefinitionFilterBar;
