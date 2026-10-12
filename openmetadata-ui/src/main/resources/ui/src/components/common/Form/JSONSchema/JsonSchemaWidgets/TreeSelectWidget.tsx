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
import { TreeSelect } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { startCase } from 'lodash';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getTreeSelectValue,
  getTreeSelectValues,
  toTreeSelectNodes,
} from '../../../../../utils/TreeSelect.utils';

const ALL_VALUE = 'all';

const TreeSelectWidget: FC<WidgetProps> = ({
  onFocus,
  onBlur,
  onChange,
  ...rest
}) => {
  const { t } = useTranslation();
  const treeData = useMemo(
    () =>
      toTreeSelectNodes([
        {
          label: t('label.all'),
          value: ALL_VALUE,
          children: rest.options.enumOptions
            ?.filter((node) => node.value !== ALL_VALUE)
            .map((node) => ({
              label: startCase(node.label),
              value: node.value,
            })),
        },
      ]),
    [rest.options.enumOptions, t]
  );
  const fetchData = useCallback(async () => ({ nodes: treeData }), [treeData]);

  return (
    <TreeSelect
      cascadeSelection
      multiple
      searchable
      aria-label={rest.label || rest.name || rest.id}
      data-testid="tree-select-widget"
      defaultExpandedKeys={['all']}
      disabled={rest.disabled || rest.readonly}
      fetchData={fetchData}
      placeholder={rest.placeholder}
      selectedDisplayStrategy="parent"
      value={getTreeSelectValue(treeData, rest.value)}
      onBlur={() => onBlur(rest.id, rest.value)}
      onChange={(selection) => {
        const values = getTreeSelectValues(selection);
        // Some schemas expose All only as a UI convenience; never persist it
        // when the backend enum requires the individual values instead.
        onChange(
          rest.schema.expandAllValue && values.includes(ALL_VALUE)
            ? rest.options.enumOptions
                ?.filter((option) => option.value !== ALL_VALUE)
                .map((option) => option.value) ?? []
            : values
        );
      }}
      onFocus={() => onFocus(rest.id, rest.value)}
    />
  );
};

export default TreeSelectWidget;
