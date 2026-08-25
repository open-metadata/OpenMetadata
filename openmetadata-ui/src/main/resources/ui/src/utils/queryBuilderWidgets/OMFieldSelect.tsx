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
import { Select, SelectItemType } from '@openmetadata/ui-core-components';
import type { FieldProps } from '@react-awesome-query-builder/ui';
import type { FC } from 'react';
import { useMemo, useRef, useState } from 'react';

type FieldNode = {
  key?: string;
  path?: string;
  label?: string;
  items?: FieldNode[];
};

const flattenFieldLeaves = (nodes: FieldNode[]): SelectItemType[] => {
  const leaves: SelectItemType[] = [];
  const walk = (list: FieldNode[]) => {
    list.forEach((node) => {
      if (node.items && node.items.length > 0) {
        walk(node.items);

        return;
      }
      const id = node.path ?? node.key;
      if (id) {
        leaves.push({ id, label: node.label ?? id });
      }
    });
  };
  walk(nodes);

  return leaves;
};

const buildItemsKey = (nodes: FieldNode[]): string => {
  const parts: string[] = [];
  const walk = (list: FieldNode[]) => {
    list.forEach((node) => {
      parts.push(`${node.path ?? node.key ?? ''} ${node.label ?? ''}`);
      if (node.items) {
        walk(node.items);
      }
    });
  };
  walk(nodes);

  return parts.join('|');
};

// RAQB's FieldProps carries no test hook. Callers (see QueryBuilderOMConfig
// renderField) pass an optional data-testid so the field select stays
// addressable in Playwright — the operator renderer reuses this component
// without the hook, so the testid must not be emitted unconditionally.
type OMFieldSelectProps = FieldProps & { dataTestId?: string };

const OMFieldSelect: FC<OMFieldSelectProps> = ({
  items,
  selectedKey,
  setField,
  readonly,
  placeholder,
  dataTestId,
}) => {
  // RAQB recreates `items` on every render. Keep the mapped array's identity
  // stable across content-equal renders: react-aria rebuilds the ComboBox
  // collection when the items identity changes, which resets an uncontrolled
  // input back to the selected item's label and closes the open popup.
  const itemsKey = buildItemsKey(items as FieldNode[]);
  const selectItems: SelectItemType[] = useMemo(
    () => flattenFieldLeaves(items as FieldNode[]),

    [itemsKey]
  );

  // Control inputValue explicitly: RAQB re-renders (triggered by parent forms
  // and query actions) race the open popup, and react-aria's uncontrolled
  // input resets to the selected label on every collection rebuild — wiping
  // the user's in-progress filter text. A controlled value can't be clobbered.
  const selectedLabel = useMemo(
    () => selectItems.find((item) => item.id === selectedKey)?.label ?? '',
    [selectItems, selectedKey]
  );
  const [inputValue, setInputValue] = useState(selectedLabel);
  const lastSelectedKeyRef = useRef(selectedKey);
  if (lastSelectedKeyRef.current !== selectedKey) {
    lastSelectedKeyRef.current = selectedKey;
    setInputValue(selectedLabel);
  }

  // ComboBox now uses controlled `items` (not defaultItems) so React Aria no
  // longer applies a built-in contains-filter. Filter client-side so the user
  // still sees only items that match their typed text.
  const filteredItems = useMemo(() => {
    if (!inputValue || inputValue === selectedLabel) {
      return selectItems;
    }
    const lower = inputValue.toLowerCase();

    return selectItems.filter((item) =>
      item.label.toLowerCase().includes(lower)
    );
  }, [selectItems, inputValue, selectedLabel]);

  return (
    <Select.ComboBox
      // Keep the popup open on transiently-empty filter results — React Aria
      // otherwise closes it and the interaction dead-ends.
      allowsEmptyCollection
      data-testid={dataTestId}
      inputValue={inputValue}
      isDisabled={readonly}
      items={filteredItems}
      placeholder={placeholder ?? 'Select field'}
      selectedKey={selectedKey ?? undefined}
      shortcut={false}
      showSearchIcon={false}
      size="sm"
      onInputChange={setInputValue}
      onSelectionChange={(key) => {
        if (key == null) {
          return;
        }
        const id = String(key);
        // Reflect the choice immediately: update the label and the sync ref so
        // the render-time sync doesn't clobber it before RAQB propagates the
        // new selectedKey back through props.
        lastSelectedKeyRef.current = id;
        setInputValue(selectItems.find((item) => item.id === id)?.label ?? id);
        setField(id);
      }}>
      {(item) => (
        <Select.Item id={item.id} key={item.id}>
          {item.label}
        </Select.Item>
      )}
    </Select.ComboBox>
  );
};

export default OMFieldSelect;
