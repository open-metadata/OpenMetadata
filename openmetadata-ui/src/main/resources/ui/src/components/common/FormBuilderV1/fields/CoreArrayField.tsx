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

import { Button, HintText, Label } from '@openmetadata/ui-core-components';
import { FieldProps } from '@rjsf/utils';
import { Copy01, XClose } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { Input as AriaInput } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';

import { splitCSV } from '../../../../utils/CSV/CSVPureUtils';
// Clipboard text may be a JSON array (copied from this field) or a CSV-ish
// string typed by hand; both shapes collapse to a list of strings here so the
// key handler stays a plain dispatch.
const parsePastedValues = (text: string): string[] => {
  try {
    const parsed = JSON.parse(text);

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return splitCSV(text);
  }
};

const getArrayFieldContainerClass = (isInvalid: boolean, isDisabled: boolean) =>
  [
    // Border drawn with outline, not a ring: WebKit does not pixel-snap box-shadow,
    // so rings thin/vanish in Safari when zoomed out. `transition-shadow` animated
    // only box-shadow, so it must name the outline properties now.
    'tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:min-h-10 tw:rounded-lg tw:bg-primary tw:px-2 tw:py-1.5',
    'tw:outline-1 tw:-outline-offset-1 tw:transition-[outline-color,outline-width] tw:duration-100 tw:ease-linear',
    isInvalid ? 'tw:outline-error_subtle' : 'tw:outline-primary',
    isDisabled
      ? 'tw:cursor-not-allowed tw:bg-disabled_subtle tw:outline-disabled'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

// Each chip owns its own remove affordance so the field body stays a flat list.
// Plain derivations of the RJSF props; pulled out so the component body stays a
// render function rather than a chain of defaulting expressions.
const getCoreArrayFieldState = (
  id: string,
  formData: string[] | undefined,
  disabled?: boolean,
  readonly?: boolean
) => ({
  fieldName: id.split('/').pop() ?? '',
  value: formData ?? [],
  isDisabled: Boolean(disabled || readonly),
});

const ArrayFieldError = ({
  isInvalid,
  rawErrors,
}: {
  isInvalid: boolean;
  rawErrors?: string[];
}) => {
  if (!isInvalid || !rawErrors) {
    return null;
  }

  return <HintText isInvalid>{rawErrors[0]}</HintText>;
};

const ArrayValueChip = ({
  value,
  isDisabled,
  onRemove,
}: {
  value: string;
  isDisabled: boolean;
  onRemove: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <span
      className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-md
          tw:bg-utility-brand-50 tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:text-brand-700 tw:outline-1 tw:-outline-offset-1 tw:outline-brand-200">
      {value}
      {!isDisabled && (
        <button
          aria-label={t('label.remove-entity', { entity: value })}
          className="tw:flex tw:cursor-pointer tw:items-center tw:text-brand-400 hover:tw:text-brand-700"
          type="button"
          onClick={onRemove}>
          <XClose size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
};

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
  const isFilterPattern = /FilterPattern/.test(id);
  const { fieldName, value, isDisabled } = getCoreArrayFieldState(
    id,
    formData,
    disabled,
    readonly
  );
  const [inputValue, setInputValue] = useState('');

  const { onCopyToClipBoard, onPasteFromClipBoard, hasCopied } = useClipboard(
    JSON.stringify(value)
  );

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

  const pasteFromClipboard = useCallback(async () => {
    const text = await onPasteFromClipBoard();
    if (!text) {
      return;
    }
    const values = parsePastedValues(text);
    if (!isEmpty(values)) {
      addValues(values);
    }
  }, [onPasteFromClipBoard, addValues]);

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitInput();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        await pasteFromClipboard();
      }
    },
    [commitInput, pasteFromClipboard]
  );

  const placeholder = isFilterPattern
    ? t('message.filter-pattern-placeholder')
    : '';

  const fieldLabel = label || schema.title || getFormDisplayLabel(fieldName);

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      {fieldLabel && <Label isRequired={required}>{fieldLabel}</Label>}
      <div className={getArrayFieldContainerClass(isInvalid, isDisabled)}>
        {value.map((v) => (
          <ArrayValueChip
            isDisabled={isDisabled}
            key={v}
            value={v}
            onRemove={() => onChange(value.filter((val) => val !== v))}
          />
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
        <Button
          className="tw:ml-auto tw:rounded tw:p-0 tw:hover:bg-transparent"
          color="tertiary"
          iconLeading={Copy01}
          tooltip={
            hasCopied ? t('message.copied-to-clipboard') : t('label.copy')
          }
          onPress={async (e) => {
            e.stopPropagation();
            await onCopyToClipBoard();
          }}
        />
      </div>
      <ArrayFieldError isInvalid={isInvalid} rawErrors={rawErrors} />
    </div>
  );
};

export default CoreArrayField;
