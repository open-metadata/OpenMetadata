/*
 *  Copyright 2022 Collate.
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
  Badge,
  BadgeWithButton,
  TreeSelect,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import profilerMetricsClassBase from '../../../../../utils/ProfilerMetricsClassBase';

interface ProfilerMetricSelectProps {
  value?: string[];
  onChange: (value: string[]) => void;
  testId: string;
  options?: string[];
  isDisabled?: boolean;
  maxVisible?: number;
  label?: string;
  placeholder?: string;
}

export const ProfilerMetricSelect = ({
  value = [],
  onChange,
  testId,
  options,
  isDisabled = false,
  maxVisible = 2,
  label,
  placeholder,
}: ProfilerMetricSelectProps) => {
  const { t } = useTranslation();
  const nodes = useMemo<TreeSelectNode[]>(
    () => [
      {
        id: 'all',
        value: 'all',
        label: t('label.all'),
        children: (
          options ?? profilerMetricsClassBase.getProfilerMetricOptions()
        ).map((metric) => ({
          id: metric,
          value: metric,
          label: startCase(metric),
          parentId: 'all',
          isLeaf: true,
        })),
      },
    ],
    [t, options]
  );
  const children = nodes[0].children ?? [];
  const allSelected =
    value.includes('all') ||
    (children.length > 0 &&
      children.every((child) => value.includes(child.id)));
  const selected = allSelected
    ? [nodes[0], ...children]
    : value.map(
        (id) =>
          children.find((node) => node.id === id) ?? {
            id,
            value: id,
            label: startCase(id),
          }
      );
  const fetchData = useCallback(async () => ({ nodes }), [nodes]);
  const handleChange = (
    selection: TreeSelectNode | TreeSelectNode[] | null
  ) => {
    let selectedNodes: TreeSelectNode[] = [];
    if (Array.isArray(selection)) {
      selectedNodes = selection;
    } else if (selection) {
      selectedNodes = [selection];
    }
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    onChange(
      children.length > 0 &&
        children.every((child) => selectedIds.has(child.id))
        ? ['all']
        : selectedNodes
            .filter((node) => node.id !== 'all')
            .map((node) => node.id)
    );
  };
  const visible = allSelected ? [nodes[0]] : selected;

  return (
    <TreeSelect
      cascadeSelection
      multiple
      searchable
      className="tw:w-full tw:[&>label]:sr-only"
      data-testid={testId}
      disabled={isDisabled}
      fetchData={fetchData}
      label={label ?? t('label.metric-plural')}
      placeholder={placeholder ?? t('label.please-select')}
      renderSelectedItem={(node) => {
        const index = visible.findIndex((item) => item.id === node.id);
        if (index < 0 || index > maxVisible) {
          return null;
        }
        if (index === maxVisible) {
          return (
            <Badge color="gray" size="sm">
              +{visible.length - maxVisible}
            </Badge>
          );
        }

        if (isDisabled) {
          return (
            <Badge color="gray" size="sm">
              {node.label}
            </Badge>
          );
        }

        return (
          <BadgeWithButton
            buttonLabel={t('label.remove-entity', { entity: node.label })}
            color="gray"
            size="sm"
            onButtonClick={() =>
              onChange(allSelected ? [] : value.filter((id) => id !== node.id))
            }>
            {node.label}
          </BadgeWithButton>
        );
      }}
      showIcon={false}
      value={selected}
      onChange={handleChange}
    />
  );
};
