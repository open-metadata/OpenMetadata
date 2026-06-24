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
import { Box, Input, Typography } from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { EntityType } from '../../../enums/entity.enum';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';

export interface TestCaseListTableHeaderProps {
  searchValue: string;
  onSearch: (value: string) => void;
  extraDropdownContent: ItemType[];
}

/**
 * Shared "Test Case Insights" table header (title + search + manage menu) used
 * by both the OSS and AI Test Cases renderers — kept identical per the design
 * ("only the filter bar changes"). Built with core (untitled-ui) components.
 */
export const TestCaseListTableHeader = ({
  searchValue,
  onSearch,
  extraDropdownContent,
}: TestCaseListTableHeaderProps) => {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(searchValue);

  // Keep a stable debounced search that always calls the latest handler.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const debouncedSearch = useMemo(
    () => debounce((value: string) => onSearchRef.current(value), 500),
    []
  );

  useEffect(() => {
    setLocalValue(searchValue);
  }, [searchValue]);

  const handleSearchChange = (value: string) => {
    setLocalValue(value);
    debouncedSearch(value);
  };

  return (
    <Box
      align="center"
      className="tw:w-full"
      data-testid="page-header"
      gap={4}
      justify="between">
      <Box direction="col" gap={1}>
        <Typography data-testid="header-title" size="text-md" weight="semibold">
          {t('label.test-case-insight-plural')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.test-case-insight-description')}
        </Typography>
      </Box>
      <Box align="center" className="tw:shrink-0" gap={3}>
        <div className="tw:w-75" data-testid="searchbar-component">
          <Input
            icon={SearchLg}
            placeholder={t('label.search-entity', {
              entity: t('label.test-case-lowercase'),
            })}
            size="md"
            value={localValue}
            onChange={handleSearchChange}
          />
        </div>
        <ManageButton
          entityFQN={WILD_CARD_CHAR}
          entityId=""
          entityName={WILD_CARD_CHAR}
          entityType={EntityType.TEST_CASE}
          extraDropdownContent={extraDropdownContent}
          isRecursiveDelete={false}
        />
      </Box>
    </Box>
  );
};

export default TestCaseListTableHeader;
