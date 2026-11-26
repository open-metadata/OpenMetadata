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
  ButtonLoadingIcon,
  ButtonUtility,
  Divider,
  Input,
} from '@openmetadata/ui-core-components';
import { Search, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { KeyboardEvent, RefObject, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface GlobalSearchInputProps {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  placeholder: string;
  /** A search is in flight: spinner in place of the icon, a line under the field. */
  isLoading: boolean;
  onChange: (value: string) => void;
  /** Clears the text and everything that narrows the results. */
  onClear: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  /** Ids of the listboxes this combobox controls. */
  listboxIds: string[];
  /** Id of the highlighted option, if any. */
  activeOptionId?: string;
}

/**
 * Core's button spinner in the brand colour. The input's icon slot sizes and
 * colours the outer element; the spinner sets its own colour inside it.
 */
const LoadingIcon = ({ className }: { className?: string }) => (
  <Box className={className}>
    <ButtonLoadingIcon className="tw:size-full tw:text-fg-brand-primary" />
  </Box>
);

const GlobalSearchInput = ({
  inputRef,
  value,
  placeholder,
  isLoading,
  onChange,
  onClear,
  onKeyDown,
  onClose,
  listboxIds,
  activeOptionId,
}: GlobalSearchInputProps) => {
  const { t } = useTranslation();

  // Core Input forwards the aria props react-aria's TextField accepts, but not
  // `role` or `aria-expanded`, which make it a combobox over the result list.
  useEffect(() => {
    inputRef.current?.setAttribute('role', 'combobox');
    inputRef.current?.setAttribute('aria-expanded', 'true');
  }, [inputRef]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <>
      <Box align="center" className="tw:px-4 tw:py-2" gap={2}>
        <Input
          borderless
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-controls={listboxIds.join(' ') || undefined}
          aria-label={t('label.search')}
          className="tw:flex-1"
          fontSize="md"
          icon={isLoading ? LoadingIcon : Search}
          inputDataTestId="global-search-input"
          placeholder={placeholder}
          ref={inputRef}
          size="md"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <Button color="tertiary" size="xs" onClick={onClear}>
            {t('label.clear')}
          </Button>
        ) : null}
        <ButtonUtility
          color="tertiary"
          data-testid="global-search-close"
          icon={XClose}
          size="lg"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      {isLoading ? (
        // The header's bottom edge turns into a sweeping line while loading,
        // reusing core's skeleton-wave keyframes.
        <Box
          aria-label={t('label.loading')}
          className={classNames(
            'tw:h-0.5 tw:w-full tw:flex-none tw:bg-size-[200%_100%]',
            'tw:bg-linear-to-r tw:from-transparent tw:via-bg-brand-solid tw:to-transparent',
            'tw:motion-safe:animate-[skeleton-wave_1.5s_ease-in-out_infinite]'
          )}
          data-testid="global-search-progress"
          role="progressbar"
        />
      ) : (
        <Divider />
      )}
    </>
  );
};

export default GlobalSearchInput;
