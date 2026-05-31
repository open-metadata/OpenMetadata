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

import { HintText, Label, Tooltip } from '@openmetadata/ui-core-components';
import { FieldProps } from '@rjsf/utils';
import { Copy01, XClose } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { Input as AriaInput } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { splitCSV } from '../../../../utils/CSV/CSV.utils';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';

const CoreArrayField = (props: FieldProps) => {
  const {
    idSchema,
    formData,
    onChange,
    disabled,
    readonly,
    schema,
    formContext,
    onBlur,
    rawErrors,
    label,
    required,
  } = props;

  const { t } = useTranslation();
  const id = idSchema.$id;
  const fieldName = id.split('/').pop() ?? '';
  const isFilterPattern = /FilterPattern/.test(id);
  const value: string[] = formData ?? [];
  const [inputValue, setInputValue] = useState('');

  const { onCopyToClipBoard, onPasteFromClipBoard, hasCopied } = useClipboard(
    JSON.stringify(value)
  );

  const isDisabled = disabled || readonly;
  const isInvalid = !!rawErrors?.length;

  const handleFocus = useCallback(() => {
    let focusId = id;
    if (isFilterPattern) {
      focusId = id.split('/').slice(0, 2).join('/');
    }
    formContext?.handleFocus?.(focusId);
  }, [id, isFilterPattern, formContext]);

  const addValues = useCallback(
    (newValues: string[]) => {
      const filtered = newValues.map((v) => v.trim()).filter(Boolean);
      if (isEmpty(filtered)) {
        return;
      }
      onChange(Array.from(new Set([...value, ...filtered])));
    },
    [value, onChange]
  );

  const commitInput = useCallback(() => {
    if (inputValue.trim()) {
      addValues(splitCSV(inputValue));
      setInputValue('');
    }
  }, [inputValue, addValues]);

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitInput();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const text = await onPasteFromClipBoard();
        if (!text) {
          return;
        }
        let values: string[] = [];
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            values = parsed.map(String);
          }
        } catch {
          values = splitCSV(text);
        }
        if (!isEmpty(values)) {
          addValues(values);
        }
      }
    },
    [commitInput, onPasteFromClipBoard, addValues]
  );

  const placeholder = isFilterPattern
    ? t('message.filter-pattern-placeholder')
    : '';

  const fieldLabel = label || schema.title || getFormDisplayLabel(fieldName);

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      {fieldLabel && <Label isRequired={required}>{fieldLabel}</Label>}
      <div
        className={[
          'tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:min-h-[38px] tw:rounded-lg tw:bg-primary tw:px-2 tw:py-1.5 tw:ring-1 tw:ring-inset tw:transition-shadow tw:duration-100 tw:ease-linear',
          isInvalid ? 'tw:ring-error_subtle' : 'tw:ring-primary',
          isDisabled
            ? 'tw:cursor-not-allowed tw:bg-disabled_subtle tw:ring-disabled'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}>
        {value.map((v, idx) => (
          <span
            className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-md
          tw:bg-utility-brand-50 tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:text-brand-700 tw:ring-1 tw:ring-inset tw:ring-brand-200"
            key={`${v}-${idx}`}>
            {v}
            {!isDisabled && (
              <button
                aria-label={t('label.remove-entity', { entity: v })}
                className="tw:flex tw:cursor-pointer tw:items-center tw:text-brand-400 hover:tw:text-brand-700"
                type="button"
                onClick={() => onChange(value.filter((val) => val !== v))}>
                <XClose size={10} strokeWidth={2.5} />
              </button>
            )}
          </span>
        ))}
        {!isDisabled && (
          <AriaInput
            className="tw:min-w-[80px] tw:flex-1 tw:bg-transparent tw:text-sm tw:text-primary tw:outline-hidden tw:placeholder:text-placeholder"
            id={id}
            placeholder={value.length ? '' : placeholder}
            value={inputValue}
            onBlur={() => {
              commitInput();
              onBlur(id, value);
            }}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
          />
        )}
        <Tooltip
          title={
            hasCopied ? t('message.copied-to-clipboard') : t('label.copy')
          }>
          <button
            className="tw:ml-auto tw:flex tw:cursor-pointer tw:items-center tw:p-1 tw:text-fg-quaternary tw:transition-colors tw:duration-200 hover:tw:text-fg-quaternary_hover"
            tabIndex={-1}
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              await onCopyToClipBoard();
            }}>
            <Copy01 size={14} />
          </button>
        </Tooltip>
      </div>
      {isInvalid && rawErrors && <HintText isInvalid>{rawErrors[0]}</HintText>}
    </div>
  );
};

export default CoreArrayField;
