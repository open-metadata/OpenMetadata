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

import {
  Box,
  ButtonUtility,
  Divider,
  Input,
  SelectPopover,
} from '@openmetadata/ui-core-components';
import { isAppleDevice } from '@react-aria/utils';
import { SearchMd } from '@untitledui/icons';
import classNames from 'classnames';
import type { FormEvent, RefObject } from 'react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconCloseCircleOutlined } from '../../../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as IconSuggestionsActive } from '../../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../../assets/svg/ic-suggestions-blue.svg';
import type { SearchIndex } from '../../../../enums/search.enum';
import { isFocusWithinSearchControl } from './ExploreSearchInput.utils';

const Suggestions = lazy(
  () => import('../../../../components/AppBar/Suggestions')
);

export interface ExploreSearchInputProps {
  searchValue: string;
  suggestionSearch: string;
  isSearchBoxOpen: boolean;
  isNLPActive: boolean;
  isNLPEnabled: boolean;
  searchCriteria?: SearchIndex;
  searchContainerRef: RefObject<HTMLFormElement>;
  onSearchChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchBoxOpenChange: (open: boolean) => void;
  onNLPToggle: () => void;
  onClearSearch: () => void;
  onSuggestionSelect: (value: string) => void;
}

const INPUT_WRAPPER_CLASS = classNames(
  'tw:relative tw:flex tw:w-full tw:flex-row tw:place-content-center',
  'tw:place-items-center tw:flex-1 tw:h-full tw:rounded-none tw:border-0',
  'tw:bg-transparent tw:pl-0 tw:[box-shadow:none]! tw:outline-0!',
  'tw:focus-within:outline-0!'
);

const INPUT_FIELD_CONTAINER_CLASS =
  'tw:group tw:flex tw:h-max tw:w-full tw:flex-col tw:items-start tw:justify-start tw:gap-1.5';

const INPUT_CLASS = classNames(
  'tw:m-0 tw:w-full tw:bg-transparent tw:outline-hidden',
  'tw:placeholder:text-sm tw:placeholder:text-tertiary',
  'tw:autofill:rounded-lg tw:autofill:text-primary',
  'tw:px-3 tw:py-2 tw:pl-10 tw:text-xs tw:font-normal tw:text-primary'
);

const INPUT_CONTAINER_CLASS = classNames(
  'tw:flex tw:h-10 tw:w-full tw:items-center tw:gap-2',
  'tw:rounded-lg tw:border tw:border-utility-gray-200 tw:bg-primary',
  'tw:py-[3px] tw:pr-1 tw:pl-2 tw:shadow-xs'
);

const NLP_TOGGLE_BASE_CLASS =
  'tw:flex tw:size-6 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-lg tw:text-brand-600 tw:transition-none';

const NLP_TOGGLE_INACTIVE_CLASS =
  'tw:border-[0.5px] tw:border-utility-blue-light-200 tw:bg-utility-brand-50 tw:p-1 tw:hover:bg-[rgba(21,112,239,0.06)] tw:hover:text-brand-600';

const NLP_TOGGLE_ACTIVE_CLASS = 'tw:border-0 tw:bg-transparent tw:p-0';

const SUGGESTIONS_CONTAINER_CLASS =
  'tw:max-h-[calc(24rem-2rem)] tw:w-full tw:overflow-y-auto tw:[&>.ant-typography]:px-6!';

const SEARCH_POPOVER_CLASS = classNames(
  'tw:max-h-96! tw:w-(--trigger-width) tw:origin-(--trigger-anchor-point)',
  'tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:bg-primary',
  'tw:px-0! tw:py-4! tw:shadow-lg tw:outline-1 tw:outline-secondary_alt',
  'tw:will-change-transform'
);

const NLP_SUGGESTION_ITEM_CLASS = classNames(
  "tw:[&_[data-testid='ai-query-suggestions']]:w-full!",
  "tw:[&_[data-testid='ai-query-suggestions']>span]:px-6!",
  "tw:[&_[data-testid='nlp-suggestions-button']]:w-full!",
  "tw:[&_[data-testid='nlp-suggestions-button']]:px-6!"
);

const CLEAR_BUTTON_CLASS = classNames(
  'tw:flex tw:size-6 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center',
  'tw:rounded-full tw:bg-transparent tw:text-fg-brand-primary',
  'tw:transition-colors tw:hover:text-fg-brand-primary'
);

const CLEAR_ICON_CLASS = classNames('tw:size-3.5 tw:overflow-visible');

const SEARCH_SHORTCUT_CLASS = classNames(
  'tw:mr-1 tw:flex tw:h-6 tw:min-w-8 tw:shrink-0 tw:items-center',
  'tw:justify-center tw:rounded-md tw:bg-secondary tw:px-1.5',
  'tw:text-xs tw:font-medium tw:leading-none tw:text-tertiary'
);

const SEARCH_PLACEHOLDER_KEY = 'message.explore-search-placeholder';

const getSearchShortcutLabel = () => (isAppleDevice() ? '⌘K' : 'Ctrl+K');

export const ExploreSearchInput = ({
  searchValue,
  suggestionSearch,
  isSearchBoxOpen,
  isNLPActive,
  isNLPEnabled,
  searchCriteria,
  searchContainerRef,
  onSearchChange,
  onSubmit,
  onSearchBoxOpenChange,
  onNLPToggle,
  onClearSearch,
  onSuggestionSelect,
}: ExploreSearchInputProps) => {
  const { t } = useTranslation();
  const isSearchPopoverOpen =
    isSearchBoxOpen && (Boolean(searchValue) || isNLPActive);
  const searchShortcutLabel = getSearchShortcutLabel();

  return (
    <Box className="tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:gap-3">
      {/*
        eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions --
        onBlur closes the suggestion popover when focus leaves the search
        landmark (relatedTarget check). It is focus management on the form
        itself, not synthetic interactivity added to a non-interactive element.
      */}
      <form
        aria-label={t(SEARCH_PLACEHOLDER_KEY)}
        className="tw:relative tw:w-full tw:min-w-0"
        data-testid="explore-search-form"
        ref={searchContainerRef}
        role="search"
        onBlur={(event) => {
          if (
            !isFocusWithinSearchControl(
              event.relatedTarget,
              searchContainerRef.current
            )
          ) {
            onSearchBoxOpenChange(false);
          }
        }}
        onSubmit={onSubmit}>
        <div className={INPUT_CONTAINER_CLASS}>
          {isNLPEnabled && (
            <>
              <button
                className={`${NLP_TOGGLE_BASE_CLASS} ${
                  isNLPActive
                    ? NLP_TOGGLE_ACTIVE_CLASS
                    : NLP_TOGGLE_INACTIVE_CLASS
                }`}
                data-testid="explore-nlp-toggle"
                title={
                  isNLPActive
                    ? t('message.natural-language-search-active')
                    : t('label.use-natural-language-search')
                }
                type="button"
                onClick={onNLPToggle}>
                {isNLPActive ? (
                  <IconSuggestionsActive className="tw:size-6" />
                ) : (
                  <IconSuggestionsBlue className="tw:size-3.5" />
                )}
              </button>
              <Divider
                className="tw:h-5 tw:self-center"
                orientation="vertical"
              />
            </>
          )}
          <Input
            data-input-wrapper
            className={INPUT_FIELD_CONTAINER_CLASS}
            data-testid="explore-search-input"
            fontSize="xs"
            icon={SearchMd}
            iconClassName="tw:size-4 tw:text-brand-600"
            inputClassName={INPUT_CLASS}
            placeholder={t(SEARCH_PLACEHOLDER_KEY)}
            value={searchValue}
            wrapperClassName={INPUT_WRAPPER_CLASS}
            onChange={onSearchChange}
            onFocus={() => onSearchBoxOpenChange(true)}
            onKeyDown={(event) => {
              // Enter submits the query instead of being consumed by popup keyboard handling.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                searchContainerRef.current?.requestSubmit();
              }
            }}
          />
          {searchValue && (
            <ButtonUtility
              aria-label={t('label.clear')}
              className={CLEAR_BUTTON_CLASS}
              color="tertiary"
              data-testid="explore-clear-search-button"
              icon={<IconCloseCircleOutlined className={CLEAR_ICON_CLASS} />}
              size="xs"
              tooltip={t('label.clear')}
              onClick={onClearSearch}
            />
          )}
          <kbd
            aria-label={`${t(SEARCH_PLACEHOLDER_KEY)} (${searchShortcutLabel})`}
            className={SEARCH_SHORTCUT_CLASS}
            data-testid="explore-search-shortcut">
            {searchShortcutLabel}
          </kbd>
        </div>
        {/* Non-modal suggestions keep the search input focused and editable. */}
        <SelectPopover
          isNonModal
          className={SEARCH_POPOVER_CLASS}
          containerPadding={0}
          data-testid="explore-search-popover"
          isOpen={isSearchPopoverOpen}
          offset={12}
          placement="bottom"
          size="sm"
          style={{
            overflow: 'hidden',
            width: searchContainerRef.current?.offsetWidth,
          }}
          triggerRef={searchContainerRef}
          onOpenChange={onSearchBoxOpenChange}>
          <div
            className={`${SUGGESTIONS_CONTAINER_CLASS} ${
              isNLPActive ? NLP_SUGGESTION_ITEM_CLASS : ''
            }`}
            data-testid="explore-search-results">
            <Suspense fallback={null}>
              <Suggestions
                isNLPActive={isNLPActive}
                isOpen={isSearchBoxOpen}
                searchCriteria={searchCriteria}
                searchText={suggestionSearch}
                setIsOpen={onSearchBoxOpenChange}
                onSearchTextUpdate={onSuggestionSelect}
              />
            </Suspense>
          </div>
        </SelectPopover>
      </form>
    </Box>
  );
};
