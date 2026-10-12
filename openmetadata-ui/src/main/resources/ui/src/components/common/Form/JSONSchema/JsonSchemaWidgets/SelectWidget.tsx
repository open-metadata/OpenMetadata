/*
 *  Copyright 2024 Collate.
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
  Autocomplete,
  Select,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { capitalize, isNil } from 'lodash';
import { FC, Key, useMemo, useState } from 'react';
import TreeSelectWidget from './TreeSelectWidget';

const getDisplayLabel = (
  label: string | number | boolean | null,
  shouldCapitalize: boolean
): string => {
  if (shouldCapitalize && typeof label === 'string') {
    return capitalize(label);
  }

  return String(label ?? '');
};

// react-aria keys are strings; enum values may also be numbers or booleans.
const useEnumItems = ({ options, capitalizeOptionLabel }: WidgetProps) =>
  useMemo(() => {
    const enumOptions = options.enumOptions ?? [];

    return {
      items: enumOptions.map((option) => ({
        id: String(option.value),
        label: getDisplayLabel(option.label, capitalizeOptionLabel),
      })),
      valueByKey: new Map(
        enumOptions.map((option) => [String(option.value), option.value])
      ),
      // Test ids keep the raw enum label, before any capitalization.
      testIdByKey: new Map(
        enumOptions.map((option) => [
          String(option.value),
          `select-option-${option.label}`,
        ])
      ),
    };
  }, [options.enumOptions, capitalizeOptionLabel]);

const MultipleSelectWidget: FC<WidgetProps> = (props) => {
  const { id, value, onBlur, onChange, onFocus } = props;
  const { items, valueByKey, testIdByKey } = useEnumItems(props);
  const selectedKeys = ((value as unknown[]) ?? []).map(String);
  const toValues = (keys: string[]) => keys.map((key) => valueByKey.get(key));

  return (
    <Autocomplete
      aria-label={props.label || props.name}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- autofocus is driven by the JSON schema widget config
      autoFocus={props.autofocus}
      data-testid={`select-widget-${id}`}
      id={id}
      isDisabled={props.disabled || props.readonly}
      items={items}
      placeholder={props.placeholder}
      selectedItems={items.filter((item) => selectedKeys.includes(item.id))}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      onItemCleared={(key: Key) =>
        onChange(toValues(selectedKeys.filter((selected) => selected !== key)))
      }
      onItemInserted={(key: Key) =>
        onChange(toValues([...selectedKeys, String(key)]))
      }>
      {(item) => (
        <Autocomplete.Item
          data-testid={testIdByKey.get(item.id)}
          id={item.id}
          label={item.label}
        />
      )}
    </Autocomplete>
  );
};

const SingleSelectWidget: FC<WidgetProps> = (props) => {
  const { id, value, options, onBlur, onChange, onFocus } = props;
  const { items, valueByKey, testIdByKey } = useEnumItems(props);
  const [inputValue, setInputValue] = useState<string>();

  const selectedKey = isNil(value) ? null : String(value);
  const selectedLabel = items.find((item) => item.id === selectedKey)?.label;
  // The input shows the selected label until the user types, so the list is
  // only narrowed by text the user entered.
  const filterText = inputValue === selectedLabel ? '' : inputValue ?? '';
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(filterText.toLowerCase())
  );

  // Clearing the text clears the selection, as antd's allowClear did.
  const handleSelectionChange = (key: Key | null) =>
    onChange(
      key === null
        ? options.emptyValue ?? undefined
        : valueByKey.get(String(key))
    );

  return (
    <Select.ComboBox
      allowsEmptyCollection
      aria-label={props.label || props.name}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- autofocus is driven by the JSON schema widget config
      autoFocus={props.autofocus}
      data-testid={`select-widget-${id}`}
      id={id}
      isDisabled={props.disabled || props.readonly}
      items={filteredItems}
      placeholder={props.placeholder}
      selectedKey={selectedKey}
      shortcut={false}
      showSearchIcon={false}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      onInputChange={setInputValue}
      onSelectionChange={handleSelectionChange}>
      {(item: SelectItemType) => (
        <Select.Item
          data-testid={testIdByKey.get(item.id)}
          id={item.id}
          key={item.id}
          label={item.label}
        />
      )}
    </Select.ComboBox>
  );
};

const SelectWidget: FC<WidgetProps> = (props) => {
  if (props.schema.uiFieldType === 'treeSelect') {
    return <TreeSelectWidget {...props} />;
  }

  return props.multiple ? (
    <MultipleSelectWidget {...props} />
  ) : (
    <SingleSelectWidget {...props} />
  );
};

function withSelectWidget(WrappedComponent: FC<WidgetProps>) {
  return function SelectWidget({
    capitalizeOptionLabel = false,
    ...props
  }: WidgetProps & { capitalizeOptionLabel?: boolean }) {
    return (
      <WrappedComponent
        {...props}
        capitalizeOptionLabel={capitalizeOptionLabel}
      />
    );
  };
}

export default withSelectWidget(SelectWidget);
