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
import { Typography } from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { OPEN_SEARCH_SHORTCUT } from '../GlobalSearch/GlobalSearch.constants';
import { useGlobalSearchStore } from '../GlobalSearch/useGlobalSearchStore';

// The prototype's search field: a button that only opens the global search.
// Core Input is a text field (its border, radius and shortcut key differ), and
// core Button has no field shape, so the trigger is a react-aria button.
const TRIGGER_CLASS = classNames(
  'tw:flex tw:h-9.5 tw:w-full tw:flex-none tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:pr-1.5 tw:pl-3',
  'tw:bg-primary tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-secondary',
  'tw:transition-[outline-color,box-shadow] tw:duration-150',
  'tw:hover:shadow-sm tw:hover:outline-primary',
  'tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-brand'
);

const SidebarSearchButton = () => {
  const { t } = useTranslation();
  const openSearch = useGlobalSearchStore((state) => state.openSearch);

  return (
    <AriaButton
      aria-label={t('label.name-with-shortcut', {
        name: t('label.search'),
        shortcut: OPEN_SEARCH_SHORTCUT,
      })}
      className={TRIGGER_CLASS}
      data-testid="ask-nav-item-search"
      onPress={() => openSearch('all')}>
      <Search aria-hidden className="tw:size-4 tw:text-fg-quaternary" />
      <Typography
        className="tw:min-w-0 tw:flex-1 tw:text-left"
        color="quaternary"
        size="text-sm">
        {t('label.search')}
      </Typography>
      {/* Browsers render <kbd> in a monospace font, where ⌘ is a tiny glyph;
          the app font draws it at the same size as the tooltip's. */}
      <Typography
        as="kbd"
        className="tw:rounded-md tw:bg-tertiary tw:px-1.5 tw:py-0.5 tw:font-body"
        color="quaternary"
        size="text-xs"
        weight="medium">
        {OPEN_SEARCH_SHORTCUT}
      </Typography>
    </AriaButton>
  );
};

export default SidebarSearchButton;
