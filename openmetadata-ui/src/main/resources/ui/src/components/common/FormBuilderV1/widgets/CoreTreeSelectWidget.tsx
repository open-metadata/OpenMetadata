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

import { TreeSelect, TreeSelectNode } from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { WidgetProps } from '@rjsf/utils';
import { startCase } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

const ALL_VALUE = 'all';

const matchesSearch = (node: TreeSelectNode, searchTerm: string) => {
  const term = searchTerm.toLowerCase();

  return (
    node.value.toLowerCase().includes(term) ||
    node.label.toLowerCase().includes(term)
  );
};

/**
 * Multi-select over a string enum, rendered as a synthetic "All" parent with
 * one child per enum value. A fully checked tree is stored as `["all"]`, the
 * sentinel the backend expands, unless the schema sets `expandAllValue`.
 */
const CoreTreeSelectWidget = ({
  id,
  value,
  disabled,
  readonly,
  required,
  label,
  hideLabel,
  placeholder,
  rawErrors,
  schema,
  options,
  onChange,
  onFocus,
}: WidgetProps) => {
  const { t } = useTranslation();
  const { allNode, childNodes } = useMemo(() => {
    const childNodes: TreeSelectNode[] = (options.enumOptions ?? [])
      .filter((option) => option.value !== ALL_VALUE)
      .map((option) => ({
        id: String(option.value),
        value: String(option.value),
        label: startCase(String(option.label ?? option.value)),
      }));

    return {
      allNode: {
        id: ALL_VALUE,
        value: ALL_VALUE,
        label: t('label.all'),
        children: childNodes,
      },
      childNodes,
    };
  }, [options.enumOptions, t]);

  const fetchData = useCallback(
    () => Promise.resolve({ nodes: [allNode] }),
    [allNode]
  );

  const selected: string[] = useMemo(
    () => (Array.isArray(value) ? value.map(String) : []),
    [value]
  );

  // `expandAllValue` schemas store every enum value rather than the sentinel.
  const isAllSelected =
    selected.includes(ALL_VALUE) ||
    (childNodes.length > 0 &&
      childNodes.every((node) => selected.includes(node.id)));

  const treeValue = useMemo(
    () =>
      isAllSelected
        ? [allNode, ...childNodes]
        : childNodes.filter((node) => selected.includes(node.id)),
    [isAllSelected, selected, allNode, childNodes]
  );

  // The backend enum may not contain "all" (e.g. MetadataExporterApp eventTypes), so such
  // schemas set `expandAllValue` to persist every enum value instead of the sentinel.
  const handleChange = useCallback(
    (next: TreeSelectNode | TreeSelectNode[] | null) => {
      const ids = (Array.isArray(next) ? next : [])
        .map((node) => node.id)
        .filter((nodeId) => nodeId !== ALL_VALUE);
      const allChildrenSelected =
        childNodes.length > 0 &&
        childNodes.every((node) => ids.includes(node.id));

      if (!allChildrenSelected) {
        onChange(ids);

        return;
      }

      onChange(
        schema.expandAllValue
          ? (options.enumOptions ?? []).map((option) => option.value)
          : [ALL_VALUE]
      );
    },
    [childNodes, onChange, options.enumOptions, schema.expandAllValue]
  );

  // A fully checked tree shows a single "All" chip, as the stored value is just the sentinel.
  const renderSelectedItem = useCallback(
    (node: TreeSelectNode) => {
      if (isAllSelected && node.id !== ALL_VALUE) {
        return null;
      }

      const remaining =
        node.id === ALL_VALUE
          ? []
          : treeValue
              .map((item) => item.id)
              .filter((id) => id !== ALL_VALUE && id !== node.id);

      return (
        <span
          className="tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:bg-primary tw:py-0.5 tw:pr-1 tw:pl-1.5 tw:outline-1 tw:-outline-offset-1 tw:outline-primary"
          data-testid={`tree-select-widget-chip-${node.id}`}>
          <p className="tw:max-w-40 tw:truncate tw:text-sm tw:font-medium tw:text-secondary">
            {node.label}
          </p>
          <button
            aria-label={t('label.remove-entity', { entity: node.label })}
            className="tw:flex tw:cursor-pointer tw:rounded-[3px] tw:p-0.5 tw:text-fg-quaternary tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:disabled:cursor-not-allowed"
            disabled={disabled || readonly}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(remaining);
            }}>
            <XClose className="tw:size-2.5" strokeWidth={3} />
          </button>
        </span>
      );
    },
    [isAllSelected, treeValue, onChange, disabled, readonly, t]
  );

  return (
    <TreeSelect
      cascadeSelection
      multiple
      searchable
      data-testid="tree-select-widget"
      defaultExpandedKeys={[ALL_VALUE]}
      disabled={disabled || readonly}
      fetchData={fetchData}
      filterNode={matchesSearch}
      hint={getWidgetHint({ rawErrors, schema, options })}
      isInvalid={Boolean(rawErrors?.length)}
      label={getWidgetLabel({ hideLabel, label })}
      placeholder={placeholder}
      renderSelectedItem={renderSelectedItem}
      required={required}
      value={treeValue}
      onChange={handleChange}
      onOpenChange={(isOpen) => isOpen && onFocus(id, value)}
    />
  );
};

export default CoreTreeSelectWidget;
