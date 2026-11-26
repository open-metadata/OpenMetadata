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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { Key } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSearchCategory, GlobalSearchFilter } from './GlobalSearch.types';

export interface GlobalSearchMoreTabsProps {
  more: GlobalSearchCategory[];
  /** The overflow type shown as a tab in place of "+N more", if any. */
  slot?: GlobalSearchCategory;
  filter: GlobalSearchFilter;
  labelFor: (key: GlobalSearchCategory) => string;
  countOf: (key: GlobalSearchCategory) => number;
  onPick: (key: GlobalSearchCategory) => void;
}

/**
 * The overflow menu at the end of the tab bar: "+N more" until a type is
 * picked from it, then just a chevron beside that type's tab to switch it.
 */
const GlobalSearchMoreTabs = ({
  more,
  slot,
  filter,
  labelFor,
  countOf,
  onPick,
}: GlobalSearchMoreTabsProps) => {
  const { t } = useTranslation();

  if (more.length === 0) {
    return null;
  }

  return (
    <Dropdown.Root>
      {slot ? (
        <ButtonUtility
          color="tertiary"
          data-testid="global-search-more-tabs"
          icon={ChevronDown}
          size="xs"
          tooltip={t('label.more')}
        />
      ) : (
        <Button
          color="tertiary"
          data-testid="global-search-more-tabs"
          iconTrailing={ChevronDown}
          size="sm">
          {t('label.plus-count-more', { count: more.length })}
        </Button>
      )}
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={t('label.more')}
          selectedKeys={slot === filter ? [filter] : []}
          selectionMode="single"
          onAction={(key: Key) => onPick(String(key))}>
          {more.map((key) => (
            <Dropdown.Item id={key} key={key} textValue={labelFor(key)}>
              <Box align="center" gap={2} justify="between">
                <Typography size="text-sm">{labelFor(key)}</Typography>
                <Badge color="gray" size="sm" type="pill-color">
                  {countOf(key)}
                </Badge>
              </Box>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default GlobalSearchMoreTabs;
