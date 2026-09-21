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

import {
  Box,
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FunnelIcon } from '../../../assets/svg/action-icons/funnel.svg';
import { ArticleSortOption } from '../../../constants/ContextCenter.constants';

const SORT_BUTTON_CLS =
  'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:px-3' +
  ' tw:py-2 tw:text-sm tw:font-medium tw:shadow-xs tw:outline-1 tw:-outline-offset-1' +
  ' tw:cursor-pointer tw:transition tw:duration-100 tw:ease-linear' +
  ' hover:tw:outline-brand tw:whitespace-nowrap tw:bg-primary tw:outline-primary';

export interface ArticlesListToolbarProps {
  quickFilters: ReactNode;
  sortOptions: ArticleSortOption[];
  selectedSortId: string;
  hasActiveFilters: boolean;
  onSortChange: (sortId: string) => void;
  onClearFilters: () => void;
}

const ArticlesListToolbar = ({
  quickFilters,
  sortOptions,
  selectedSortId,
  hasActiveFilters,
  onSortChange,
  onClearFilters,
}: ArticlesListToolbarProps) => {
  const { t } = useTranslation();
  const selectedSortLabel =
    sortOptions.find((option) => option.id === selectedSortId)?.label ?? '';

  return (
    <Box
      align="center"
      className="tw:mb-3"
      data-testid="articles-list-toolbar"
      gap={3}
      wrap="wrap">
      {quickFilters}

      <Box align="center" className="tw:ml-auto" gap={4}>
        {hasActiveFilters && (
          <Button
            color="link-color"
            data-testid="clear-articles-filters"
            size="sm"
            onClick={onClearFilters}>
            {t('label.clear-entity', { entity: t('label.all') })}
          </Button>
        )}
        <Dropdown.Root>
          <AriaButton
            className={SORT_BUTTON_CLS}
            data-testid="articles-sort-button">
            <FunnelIcon className="tw:text-quaternary" height={14} width={14} />
            <Typography className="tw:text-secondary" weight="medium">
              {t('label.sort')}:
            </Typography>
            <Typography className="tw:text-secondary" weight="medium">
              {t(selectedSortLabel)}
            </Typography>
            <ChevronDown
              className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
              size={16}
              strokeWidth={2.5}
            />
          </AriaButton>
          <Dropdown.Popover className="tw:w-56">
            <Dropdown.Menu
              selectedKeys={[selectedSortId]}
              selectionMode="single"
              onAction={(key) => onSortChange(String(key))}>
              {sortOptions.map((option) => (
                <Dropdown.Item
                  id={option.id}
                  key={option.id}
                  label={t(option.label)}
                />
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </Box>
    </Box>
  );
};

export default ArticlesListToolbar;
