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
import { ChevronDown, XClose } from '@untitledui/icons';
import type { ReactNode } from 'react';
import { useId, useRef } from 'react';
import {
  Button as AriaButton,
  ListBox as AriaListBox,
  Select as AriaSelect,
} from 'react-aria-components';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { Tag, TagGroup, TagList } from '@/components/base/tags/tags';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { Popover } from './popover';
import { SelectContext, sizes } from './select';
import { SelectItem } from './select-item';

export interface TagSelectOption {
  id: string;
  label: ReactNode;
  isDisabled?: boolean;
}

export interface TagSelectProps {
  options: TagSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  isDisabled?: boolean;
  /** Shows a button that clears every selected value. */
  allowClear?: boolean;
  label?: string;
  hint?: string;
  /** @default 'sm' */
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

export const TagSelect = ({
  options,
  value,
  onChange,
  placeholder,
  isDisabled,
  allowClear,
  label,
  hint,
  size = 'sm',
  'data-testid': dataTestId,
}: TagSelectProps) => {
  const { t } = useCoreTranslation();
  const labelId = useId();
  const hintId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const selected = options.filter((option) => value.includes(option.id));

  return (
    <SelectContext.Provider value={{ size, fontSize: 'sm' }}>
      <div className="tw:flex tw:flex-col tw:gap-1.5" data-testid={dataTestId}>
        {label && <Label id={labelId}>{label}</Label>}

        {/* Chips live outside the Select: a TagGroup nested in the Select's collection crashes
            react-aria's collection builder, and remove buttons inside the trigger would be
            invalid nested buttons. */}
        <div
          className={cx(
            'tw:relative tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:transition tw:duration-100 tw:ease-linear',
            'tw:focus-within:outline-2 tw:focus-within:-outline-offset-2 tw:focus-within:outline-brand',
            isDisabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle',
            sizes[size].root
          )}
          ref={fieldRef}>
          {selected.length > 0 && (
            <TagGroup
              label={label ?? placeholder ?? ''}
              onRemove={
                isDisabled
                  ? undefined
                  : (keys) => onChange(value.filter((id) => !keys.has(id)))
              }>
              <TagList className="tw:flex tw:flex-wrap tw:gap-1.5">
                {selected.map((option) => (
                  <Tag id={option.id} isDisabled={isDisabled} key={option.id}>
                    {option.label}
                  </Tag>
                ))}
              </TagList>
            </TagGroup>
          )}

          <AriaSelect
            aria-describedby={hint ? hintId : undefined}
            aria-label={label ? undefined : placeholder}
            aria-labelledby={label ? labelId : undefined}
            className="tw:flex tw:min-w-[20%] tw:flex-1"
            isDisabled={isDisabled}
            selectionMode="multiple"
            value={value}
            onChange={(keys) => onChange(keys.map(String))}>
            <AriaButton className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:text-left tw:outline-hidden tw:disabled:cursor-not-allowed">
              <span
                className={cx(
                  'tw:flex-1 tw:truncate tw:text-sm',
                  isDisabled ? 'tw:text-disabled' : 'tw:text-placeholder'
                )}>
                {selected.length === 0 && placeholder}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cx(
                  'tw:shrink-0 tw:text-fg-quaternary',
                  size === 'sm' ? 'tw:size-4 tw:stroke-[2.5px]' : 'tw:size-5'
                )}
              />
            </AriaButton>

            <Popover size={size} triggerRef={fieldRef}>
              <AriaListBox
                className="tw:size-full tw:outline-hidden"
                items={options}>
                {(option) => (
                  <SelectItem
                    id={option.id}
                    isDisabled={option.isDisabled}
                    textValue={
                      typeof option.label === 'string'
                        ? option.label
                        : option.id
                    }>
                    {option.label}
                  </SelectItem>
                )}
              </AriaListBox>
            </Popover>
          </AriaSelect>

          {allowClear && value.length > 0 && !isDisabled && (
            <AriaButton
              aria-label={t('label.clear-all')}
              className="tw:flex tw:cursor-pointer tw:rounded tw:p-0.5 tw:text-fg-quaternary tw:hover:text-fg-quaternary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-focus-ring"
              onPress={() => onChange([])}>
              <XClose aria-hidden="true" className="tw:size-4" />
            </AriaButton>
          )}
        </div>

        {hint && <HintText id={hintId}>{hint}</HintText>}
      </div>
    </SelectContext.Provider>
  );
};
