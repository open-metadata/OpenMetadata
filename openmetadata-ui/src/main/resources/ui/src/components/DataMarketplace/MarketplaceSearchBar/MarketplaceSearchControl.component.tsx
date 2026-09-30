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
  Input,
  SelectPopover,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconSuggestionsActive } from '../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../assets/svg/ic-suggestions-blue.svg';
import './marketplace-search-bar.less';

interface MarketplaceSearchControlProps {
  searchValue: string;
  placeholder: string;
  isNLPEnabled: boolean;
  isNLPActive: boolean;
  isDisabled?: boolean;
  isPopoverOpen: boolean;
  /** Popover body — normally the matching domains and data products. */
  results: ReactNode;
  containerRef: RefObject<HTMLDivElement>;
  onSearchChange: (value: string) => void;
  onSubmit: () => void;
  onNLPToggle: () => void;
  onPopoverOpenChange: (open: boolean) => void;
}

/**
 * The marketplace search field: NLQ toggle, input, and results popover. Shared
 * by the overview's own search bar and by the list pages, so both keep the same
 * chrome while differing in what a query does.
 */
const MarketplaceSearchControl = ({
  searchValue,
  placeholder,
  isNLPEnabled,
  isNLPActive,
  isDisabled,
  isPopoverOpen,
  results,
  containerRef,
  onSearchChange,
  onSubmit,
  onNLPToggle,
  onPopoverOpenChange,
}: MarketplaceSearchControlProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="marketplace-search-bar"
      data-testid="marketplace-search-bar"
      ref={containerRef}>
      <div className="tw:relative">
        <div className="tw:absolute tw:left-3 tw:top-1/2 tw:-translate-y-1/2 tw:z-10 tw:flex tw:items-center">
          {isNLPEnabled ? (
            <Tooltip
              title={
                isNLPActive
                  ? t('message.natural-language-search-active')
                  : t('label.use-natural-language-search')
              }>
              <button
                className={`marketplace-nlq-button${
                  isNLPActive ? ' active' : ''
                }`}
                data-testid="marketplace-nlq-toggle"
                type="button"
                onClick={onNLPToggle}>
                {isNLPActive ? (
                  <IconSuggestionsActive />
                ) : (
                  <IconSuggestionsBlue />
                )}
              </button>
            </Tooltip>
          ) : (
            <SearchLg className="tw:size-4 tw:text-text-tertiary" />
          )}
        </div>
        <Input
          autoComplete="off"
          data-testid="marketplace-search-input"
          fontSize="sm"
          inputClassName="tw:!pl-11"
          isDisabled={isDisabled}
          placeholder={placeholder}
          value={searchValue}
          wrapperClassName="marketplace-search-input tw:!rounded-xl tw:!items-center tw:!py-1"
          onChange={onSearchChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSubmit();
            }
          }}
        />
      </div>
      <SelectPopover
        isNonModal
        className="!tw:max-h-[400px]"
        isOpen={isPopoverOpen}
        offset={4}
        placement="bottom"
        size="md"
        style={{ width: containerRef?.current?.offsetWidth }}
        triggerRef={containerRef}
        onOpenChange={onPopoverOpenChange}>
        {results}
      </SelectPopover>
    </div>
  );
};

export default MarketplaceSearchControl;
