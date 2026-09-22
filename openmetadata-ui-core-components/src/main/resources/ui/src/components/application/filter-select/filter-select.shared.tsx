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

// Shared by FilterSelect and TreeSelect; not in filter-select.tsx, whose Tree compound would cycle.
import { SearchLg } from '@untitledui/icons';
import type { HTMLAttributes, Ref } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Typography } from '@/components/foundations/typography';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';

// Narrowed so the icon prop's type doesn't widen to the raw @untitledui/icons FC.
export const SearchInputIcon = (props: HTMLAttributes<HTMLOrSVGElement>) => (
  <SearchLg aria-hidden="true" {...props} />
);

export const TriggerCountBadge = ({ count }: { count: number }) => (
  <Typography
    className="not-prose tw:ml-1.5 tw:inline-flex tw:h-[18px] tw:min-w-[18px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-brand-50 tw:px-[5px] tw:tabular-nums tw:text-fg-brand-primary"
    data-testid="filter-count-badge"
    size="text-xs"
    weight="medium">
    {count}
  </Typography>
);

interface DropdownSearchFieldProps {
  value: string;
  placeholder: string;
  inputDataTestId?: string;
  isDisabled?: boolean;
  wrapperRef?: Ref<HTMLDivElement>;
  onChange: (value: string) => void;
}

export const DropdownSearchField = ({
  value,
  placeholder,
  inputDataTestId,
  isDisabled,
  wrapperRef,
  onChange,
}: DropdownSearchFieldProps) => (
  <div className="tw:px-3 tw:pt-3 tw:pb-2" ref={wrapperRef}>
    <Input
      icon={SearchInputIcon}
      inputDataTestId={inputDataTestId}
      isDisabled={isDisabled}
      placeholder={placeholder}
      size="sm"
      value={value}
      onChange={onChange}
    />
  </div>
);

interface DropdownStagedFooterProps {
  count: number;
  isClearDisabled?: boolean;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
}

export const DropdownStagedFooter = ({
  count,
  isClearDisabled,
  onClear,
  onCancel,
  onApply,
}: DropdownStagedFooterProps) => {
  const { t } = useCoreTranslation();

  return (
    <div className="tw:mt-2 tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:py-3 tw:pr-3 tw:pl-3">
      <Button
        className="tw:px-2 tw:py-1.5"
        color="tertiary"
        data-testid="clear-filter-btn"
        isDisabled={isClearDisabled ?? count === 0}
        size="sm"
        onPress={onClear}>
        {t('label.clear-all')}
      </Button>
      <div className="tw:flex tw:items-center tw:gap-2">
        <Button
          className="tw:py-1.5"
          color="secondary"
          data-testid="close-btn"
          size="sm"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          className="tw:py-1.5"
          color="primary"
          data-testid="update-btn"
          size="sm"
          onPress={onApply}>
          {count > 0 ? t('label.apply-count', { count }) : t('label.apply')}
        </Button>
      </div>
    </div>
  );
};

interface DropdownStatusFooterProps {
  count: number;
  isClearDisabled?: boolean;
  onClear: () => void;
}

export const DropdownStatusFooter = ({
  count,
  isClearDisabled,
  onClear,
}: DropdownStatusFooterProps) => {
  const { t } = useCoreTranslation();

  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:py-2 tw:pr-3 tw:pl-5">
      <Typography
        className="not-prose"
        color="secondary"
        data-testid="selected-count"
        size="text-xs"
        weight="regular">
        {count === 0
          ? t('label.none-selected')
          : t('label.count-selected', { count })}
      </Typography>
      <Button
        className="tw:px-2 tw:py-1.5"
        color="tertiary"
        data-testid="clear-filter-btn"
        isDisabled={isClearDisabled ?? count === 0}
        size="sm"
        onPress={onClear}>
        {t('label.clear-all')}
      </Button>
    </div>
  );
};
