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
import { Button, ButtonUtility } from '@openmetadata/ui-core-components';
import {
  Loading01,
  Search,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { KeyboardEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RESULTS_LIST_ID } from './GlobalSearch.constants';

export interface GlobalSearchInputProps {
  value: string;
  placeholder: string;
  isLoading: boolean;
  activeOptionId?: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

/**
 * The search field with its progress affordances: a spinner in place of the
 * search icon and a line under the field while results are refreshing.
 */
const GlobalSearchInput = ({
  value,
  placeholder,
  isLoading,
  activeOptionId,
  onChange,
  onKeyDown,
  onClose,
}: GlobalSearchInputProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = isLoading ? Loading01 : Search;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <>
      <div className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-3">
        <span className="tw:flex tw:text-fg-quaternary">
          <Icon
            className={isLoading ? 'tw:motion-safe:animate-spin' : undefined}
            size={20}
          />
        </span>
        <input
          aria-expanded
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-controls={RESULTS_LIST_ID}
          aria-label={t('label.search')}
          autoComplete="off"
          className="tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-md tw:text-primary tw:outline-hidden tw:placeholder:text-placeholder"
          data-testid="global-search-input"
          placeholder={placeholder}
          ref={inputRef}
          role="combobox"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <Button
            color="link-gray"
            size="sm"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}>
            {t('label.clear')}
          </Button>
        ) : null}
        <ButtonUtility
          color="tertiary"
          data-testid="global-search-close"
          icon={XClose}
          size="sm"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </div>
      <div className="tw:h-0.5 tw:w-full tw:overflow-hidden">
        <div
          className={
            isLoading
              ? 'tw:h-full tw:w-full tw:bg-brand-solid tw:motion-safe:animate-pulse'
              : 'tw:w-full tw:border-t tw:border-secondary'
          }
          data-testid="global-search-progress"
        />
      </div>
    </>
  );
};

export default GlobalSearchInput;
