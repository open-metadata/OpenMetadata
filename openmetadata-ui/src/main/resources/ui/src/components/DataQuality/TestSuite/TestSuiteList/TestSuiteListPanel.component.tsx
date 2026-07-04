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
import { Box, Input, Tabs } from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataQualitySubTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  TestSuitesTable,
  TestSuitesTableProps,
} from './TestSuitesTable.component';

const SEARCH_DEBOUNCE_MS = 500;

// `button-border` gives the segmented box container; we recolor the active
// segment to brand (blue fill + blue text + brand ring), overriding its default
// white, and keep the inactive segment gray at weight 500.
const subTabItemClassName = ({ isSelected }: { isSelected: boolean }) =>
  isSelected
    ? 'tw:bg-brand-primary_alt tw:text-brand-secondary tw:font-semibold tw:ring-1 tw:ring-brand'
    : 'tw:font-medium';

export interface TestSuiteListPanelProps extends TestSuitesTableProps {
  searchValue?: string;
  onSearch: (value: string) => void;
  onSubTabChange: (keys: Set<string | number>) => void;
}

/**
 * The Test Suites list panel — a bordered card whose header holds the Table /
 * Bundle Suites toggle and the search box, with the shared {@link TestSuitesTable}
 * below. Shared verbatim by the OSS and AI renderers; each page only differs in
 * the owner filter and summary chrome rendered above it. Search debouncing lives
 * here so both modes get it for free.
 */
export const TestSuiteListPanel = ({
  searchValue,
  onSearch,
  onSubTabChange,
  ...tableProps
}: TestSuiteListPanelProps) => {
  const { t } = useTranslation();
  const { subTab } = tableProps;

  const [localSearch, setLocalSearch] = useState(searchValue ?? '');
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const debouncedSearch = useMemo(
    () =>
      debounce(
        (value: string) => onSearchRef.current(value),
        SEARCH_DEBOUNCE_MS
      ),
    []
  );

  useEffect(() => {
    setLocalSearch(searchValue ?? '');
  }, [searchValue]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    debouncedSearch(value);
  };

  return (
    <Box
      className="tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:ring-1 tw:ring-secondary"
      data-testid="test-suite-list-panel"
      direction="col">
      <Box align="center" className="tw:p-4" gap={4} justify="between">
        <Tabs
          className="tw:w-max"
          selectedKey={subTab}
          onSelectionChange={(key) => onSubTabChange(new Set([key]))}>
          <Tabs.List size="sm" type="button-border">
            <Tabs.Item
              className={subTabItemClassName}
              data-testid="table-suite-radio-btn"
              id={DataQualitySubTabs.TABLE_SUITES}>
              {t('label.table-suite-plural')}
            </Tabs.Item>
            <Tabs.Item
              className={subTabItemClassName}
              data-testid="bundle-suite-radio-btn"
              id={DataQualitySubTabs.BUNDLE_SUITES}>
              {t('label.bundle-suite-plural')}
            </Tabs.Item>
          </Tabs.List>
        </Tabs>
        <div className="tw:w-75" data-testid="searchbar-component">
          <Input
            icon={SearchLg}
            inputDataTestId="searchbar"
            placeholder={t('label.search-entity', {
              entity:
                subTab === DataQualitySubTabs.TABLE_SUITES
                  ? t('label.table-suite-plural')
                  : t('label.bundle-suite-plural'),
            })}
            size="md"
            value={localSearch}
            onChange={handleSearchChange}
          />
        </div>
      </Box>
      <TestSuitesTable {...tableProps} />
    </Box>
  );
};

export default TestSuiteListPanel;
