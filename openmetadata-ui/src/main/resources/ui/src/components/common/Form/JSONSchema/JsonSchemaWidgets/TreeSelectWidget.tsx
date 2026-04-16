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
import Icon from '@ant-design/icons/lib/components/Icon';
import { WidgetProps } from '@rjsf/utils';
import { TreeSelect } from 'antd';
import { startCase } from 'lodash';
import { FC, ReactNode, useCallback, useMemo } from 'react';
import { ReactComponent as ArrowIcon } from '../../../../../assets/svg/ic-arrow-down.svg';
import { TEXT_BODY_COLOR } from '../../../../../constants/constants';

const ALL_VALUE = 'all';

const TreeSelectWidget: FC<WidgetProps> = ({
  onFocus,
  onBlur,
  onChange,
  ...rest
}) => {
  const treeData = useMemo(
    () => [
      {
        title: 'All',
        value: ALL_VALUE,
        key: ALL_VALUE,
        children: rest.options.enumOptions?.map((node) => ({
          title: startCase(node.label),
          value: node.value,
          key: node.value,
        })),
      },
    ],
    [rest.options.enumOptions]
  );

  // When `expandAllValue` is set on the schema, the synthetic "all" parent
  // node is a UI-only convenience: the backend enum does not include "all",
  // so we expand it back into the full list of enum values before submit.
  // Without this, selecting "All" would persist a value that violates the
  // schema (e.g. MetadataExporterApp eventTypes).
  const shouldExpandAll = Boolean(rest.schema.expandAllValue);

  const handleChange = useCallback(
    (value: unknown) => {
      if (
        shouldExpandAll &&
        Array.isArray(value) &&
        value.includes(ALL_VALUE)
      ) {
        const expanded =
          rest.options.enumOptions?.map((option) => option.value) ?? [];
        onChange(expanded);

        return;
      }

      onChange(value);
    },
    [onChange, shouldExpandAll, rest.options.enumOptions]
  );

  return (
    <TreeSelect
      allowClear
      multiple
      showSearch
      treeCheckable
      treeDefaultExpandAll
      data-testid="tree-select-widget"
      disabled={rest.disabled}
      open={rest.readonly ? false : undefined}
      showCheckedStrategy={TreeSelect.SHOW_PARENT}
      style={{
        width: '100%',
      }}
      switcherIcon={
        <Icon
          component={ArrowIcon}
          data-testid="expand-icon"
          style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
        />
      }
      treeData={treeData}
      onBlur={() => onBlur(rest.id, rest.value)}
      onChange={handleChange}
      onFocus={() => onFocus(rest.id, rest.value)}
      {...rest}>
      {rest.children as ReactNode}
    </TreeSelect>
  );
};

export default TreeSelectWidget;
