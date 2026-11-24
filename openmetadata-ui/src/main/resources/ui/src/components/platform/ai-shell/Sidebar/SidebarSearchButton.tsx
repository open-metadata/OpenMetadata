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
import { Input } from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalSearchStore } from '../GlobalSearch/useGlobalSearchStore';

const SHORTCUT = '⌘K';

/**
 * The search field at the top of the expanded sidebar. It is only a trigger:
 * focusing it opens the global search, and it gives focus straight back so
 * closing the search doesn't land on it and reopen it.
 */
const SidebarSearchButton = () => {
  const { t } = useTranslation();
  const openSearch = useGlobalSearchStore((state) => state.openSearch);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.target.blur();
    openSearch('all');
  };

  return (
    <Input
      isReadOnly
      aria-label={`${t('label.search')} (${SHORTCUT})`}
      icon={Search}
      inputDataTestId="ask-nav-item-search"
      placeholder={t('label.search')}
      shortcut={SHORTCUT}
      size="md"
      // The prototype's resting glow around the field.
      wrapperClassName="tw:shadow-xs tw:outline-4 tw:outline-utility-brand-50"
      onFocus={handleFocus}
    />
  );
};

export default SidebarSearchButton;
