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

import { Autocomplete } from '@/components/base/autocomplete/autocomplete';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { NativeSelect } from '@/components/base/select/select-native';
import { Slider } from '@/components/base/slider/slider';
import { TextArea } from '@/components/base/textarea/textarea';
import { Toggle } from '@/components/base/toggle/toggle';
import type { ReactNode } from 'react';
import type { Key } from 'react-aria-components';
import type { UseControllerReturn } from 'react-hook-form';
import { ColorPickerField } from './fields/color-picker-field';
import {
  CoverImageUploadField,
  type CoverImageUploadValue,
} from './fields/cover-image-upload-field';
import { IconPickerField } from './fields/icon-picker-field';
import {
  FieldTypes,
  type FieldProp,
  type FieldPropsMap,
  type FormSelectItem,
} from './form-field.types';

const AUTOCOMPLETE_FIELD_TYPES = new Set<FieldTypes>([
  FieldTypes.AUTOCOMPLETE,
  FieldTypes.MULTI_SELECT,
  FieldTypes.ASYNC_SELECT,
  FieldTypes.TREE_ASYNC_SELECT,
  FieldTypes.TAG_SUGGESTION,
  FieldTypes.UT_TAG_SUGGESTION,
  FieldTypes.GLOSSARY_TAG_SUGGESTION,
  FieldTypes.USER_TEAM_SELECT,
  FieldTypes.USER_MULTI_SELECT,
  FieldTypes.USER_TEAM_SELECT_INPUT,
  FieldTypes.DOMAIN_SELECT,
]);

const isMultipleSelection = (
  value: string | string[],
  props: FieldPropsMap
) => {
  if (typeof props.multiple === 'boolean') {
    return props.multiple;
  }

  if (props.multiple !== undefined) {
    return true;
  }

  return Array.isArray(value);
};

const getItems = (props: FieldPropsMap): FormSelectItem[] =>
  props.items ?? props.options ?? [];

const getSelectedItems = (
  value: FormSelectItem | FormSelectItem[]
): FormSelectItem[] => {
  if (!Array.isArray(value)) {
    return value ? [value] : [];
  }

  return value;
};

const getDefaultAutocompleteItems = (items: FormSelectItem[]) =>
  items.map((item) => (
    <Autocomplete.Item
      avatarUrl={item.avatarUrl}
      icon={item.icon}
      id={item.id}
      isDisabled={item.isDisabled}
      key={item.id}
      label={item.label}
      supportingText={item.supportingText}
    />
  ));

export const renderFieldElement = (
  controller: UseControllerReturn,
  fieldConfig: FieldProp
): ReactNode => {
  const { field, fieldState } = controller;
  const { type, id, label, placeholder, props = {} } = fieldConfig;
  const {
    children,
    renderItem,
    onChange,
    onBlur,
    onFocus,
    onSelectionChange,
    onItemInserted,
    onItemCleared,
    onSearchChange,
    onSelect: _onSelect,
    size: _size,
    selectedItems: _selectedItems,
    options: _options,
    items: _items,
    multiple: _multiple,
    ...rest
  } = props;
  const isInvalid = fieldState.invalid;
  const ariaLabel = typeof label === 'string' ? label : undefined;
  const selectItems = getItems(props);

  if (AUTOCOMPLETE_FIELD_TYPES.has(type)) {
    const multiple = isMultipleSelection(field.value, props);
    const selectedAutocompleteItems = getSelectedItems(field.value);

    const handleInsert = (key: Key) => {
      const keyStr = String(key);
      const selectedItem =
        selectItems.find((item) => item.id === keyStr) ??
        (rest.allowsCreation ? { id: keyStr, label: keyStr } : undefined);

      if (!selectedItem) {
        return;
      }

      if (multiple) {
        const nextItems = [...selectedAutocompleteItems, selectedItem];

        field.onChange(nextItems);
      } else {
        field.onChange(selectedItem);
      }
      onItemInserted?.(key);
    };

    const handleClear = (key: Key) => {
      const nextItems = selectedAutocompleteItems.filter(
        (item) => item.id !== String(key)
      );

      field.onChange(multiple ? nextItems : null);
      onItemCleared?.(key);
    };

    return (
      <Autocomplete
        aria-label={ariaLabel}
        id={id}
        isInvalid={isInvalid}
        items={selectItems}
        multiple={multiple}
        placeholder={placeholder}
        selectedItems={selectedAutocompleteItems}
        {...rest}
        onBlur={() => {
          field.onBlur();
          onBlur?.();
        }}
        onFocus={onFocus}
        onItemCleared={handleClear}
        onItemInserted={handleInsert}
        onSearchChange={onSearchChange}>
        {typeof renderItem === 'function'
          ? selectItems.map((item) => renderItem(item))
          : getDefaultAutocompleteItems(selectItems)}
      </Autocomplete>
    );
  }

  switch (type) {
    case FieldTypes.TEXT:
      return (
        <Input
          aria-label={ariaLabel}
          id={id}
          isInvalid={isInvalid}
          name={field.name}
          placeholder={placeholder}
          value={field.value ?? ''}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          onFocus={onFocus}
        />
      );

    case FieldTypes.PASSWORD:
      return (
        <Input
          aria-label={ariaLabel}
          autoComplete="off"
          id={id}
          isInvalid={isInvalid}
          name={field.name}
          placeholder={placeholder}
          type="password"
          value={field.value ?? ''}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          onFocus={onFocus}
        />
      );

    case FieldTypes.NUMBER:
      return (
        <Input
          aria-label={ariaLabel}
          id={id}
          isInvalid={isInvalid}
          name={field.name}
          placeholder={placeholder}
          type="number"
          value={field.value ?? ''}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          onFocus={onFocus}
        />
      );

    case FieldTypes.TEXTAREA:
    case FieldTypes.DESCRIPTION:
      return (
        <TextArea
          aria-label={ariaLabel}
          id={id}
          isInvalid={isInvalid}
          name={field.name}
          placeholder={placeholder}
          rows={4}
          value={field.value ?? props.initialValue ?? ''}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          onFocus={onFocus}
        />
      );

    case FieldTypes.FILTER_PATTERN:
    case FieldTypes.CRON_EDITOR:
      return (
        <TextArea
          aria-label={ariaLabel}
          id={id}
          isInvalid={isInvalid}
          name={field.name}
          placeholder={placeholder}
          rows={4}
          textAreaClassName="tw:font-mono"
          value={field.value ?? props.initialValue ?? ''}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          onFocus={onFocus}
        />
      );

    case FieldTypes.SWITCH:
      return (
        <Toggle
          aria-label={ariaLabel}
          id={id}
          isSelected={field.value ?? false}
          name={field.name}
          onFocus={onFocus}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(String(value));
          }}
        />
      );

    case FieldTypes.CHECKBOX:
      return (
        <Checkbox
          aria-label={ariaLabel}
          id={id}
          isInvalid={isInvalid}
          isSelected={field.value ?? false}
          name={field.name}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(String(value));
          }}
        />
      );

    case FieldTypes.SLIDER:
      return (
        <Slider
          id={id}
          value={field.value ?? 0}
          {...rest}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(String(value));
          }}
        />
      );

    case FieldTypes.COLOR_PICKER:
      return (
        <ColorPickerField
          ariaLabel={ariaLabel}
          colors={props.colors}
          data-testid={props['data-testid']}
          disabled={props.disabled}
          emptyStateLabel={props.emptyStateLabel}
          id={id}
          value={field.value ?? ''}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
        />
      );

    case FieldTypes.SELECT_NATIVE: {
      const nativeSelectedItem = field.value as FormSelectItem | null;

      return (
        <NativeSelect
          aria-label={ariaLabel}
          id={id}
          name={field.name}
          options={selectItems.map((item) => ({
            label: item.label ?? item.id,
            value: item.id,
            disabled: item.isDisabled,
          }))}
          value={nativeSelectedItem?.id ?? ''}
          {...rest}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(event) => {
            const nextItem = selectItems.find(
              (item) => item.id === event.target.value
            );

            field.onChange(nextItem ?? null);
            onChange?.(nextItem?.id ?? '');
          }}
        />
      );
    }

    case FieldTypes.SELECT: {
      const selectedItem = field.value as FormSelectItem | null;

      return (
        <Select
          aria-label={ariaLabel}
          id={id}
          isInvalid={isInvalid}
          items={selectItems}
          name={field.name}
          placeholder={placeholder}
          selectedKey={selectedItem?.id ?? null}
          {...rest}
          onFocus={onFocus}
          onSelectionChange={(key) => {
            const nextItem = selectItems.find(
              (item) => item.id === String(key)
            );

            field.onChange(nextItem ?? null);
            onSelectionChange?.(key);
          }}>
          {(item) => (
            <Select.Item
              avatarUrl={item.avatarUrl}
              icon={item.icon}
              id={item.id}
              isDisabled={item.isDisabled}
              supportingText={item.supportingText}>
              {item.label}
            </Select.Item>
          )}
        </Select>
      );
    }

    case FieldTypes.ICON_PICKER:
      return (
        <IconPickerField
          allowUrl={props.allowUrl}
          ariaLabel={ariaLabel}
          backgroundColor={props.backgroundColor}
          data-testid={props['data-testid']}
          defaultIcon={props.defaultIcon}
          disabled={props.disabled}
          id={id}
          items={selectItems}
          labels={props.labels}
          name={field.name}
          placeholder={placeholder}
          value={field.value ?? ''}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          onSelectionChange={onSelectionChange}
        />
      );

    case FieldTypes.COVER_IMAGE_UPLOAD:
      return (
        <CoverImageUploadField
          acceptedFileTypes={props.acceptedFileTypes}
          ariaLabel={ariaLabel}
          data-testid={props['data-testid']}
          isInvalid={isInvalid}
          labels={props.coverImageLabels}
          maxDimensions={props.maxDimensions}
          maxSizeMB={props.maxSizeMB}
          placeholder={placeholder}
          previewClassName={props.previewClassName}
          previewHeight={props.previewHeight}
          renderPreview={props.renderPreview}
          repositionable={props.repositionable}
          validationMessages={props.validationMessages}
          value={field.value as CoverImageUploadValue}
          onBlur={() => {
            field.onBlur();
            onBlur?.();
          }}
          onChange={(next) => {
            field.onChange(next);
          }}
          onValidationError={props.onValidationError}
        />
      );

    case FieldTypes.COMPONENT:
      return children;

    default:
      return children;
  }
};
