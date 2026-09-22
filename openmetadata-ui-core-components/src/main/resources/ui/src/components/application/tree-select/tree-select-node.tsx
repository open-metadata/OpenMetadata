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
import { CheckboxBase } from '@/components/base/checkbox/checkbox';
import { RadioButtonBase } from '@/components/base/radio-buttons/radio-buttons';
import { Typography } from '@/components/foundations/typography';
import { cx } from '@/utils/cx';
import { RefreshCw01 } from '@untitledui/icons';
import { Tree } from '../tree/tree';
import type { TreeSelectNode } from './tree-select.types';

export interface TreeSelectTreeItemContentProps<T> {
  node: TreeSelectNode<T>;
  isSelected: boolean;
  isIndeterminate: boolean;
  isLoading: boolean;
  showCheckbox: boolean;
  showIcon: boolean;
  multiple: boolean;
  disabled: boolean;
  hasChildItems: boolean;
  onNodeClick: () => void;
}

export const TreeSelectEmptyItemContent = ({
  message,
  parentId,
}: {
  message: string;
  parentId: string;
}) => (
  <Tree.ItemContent indentPerLevel={28} maxIndentLevel={2}>
    {() => (
      <div
        className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:py-0.5 tw:text-xs tw:text-tertiary"
        data-testid={`tree-node-empty-${parentId}`}
        role="presentation">
        {message}
      </div>
    )}
  </Tree.ItemContent>
);

export const TreeSelectTreeItemContent = <T,>({
  node,
  isSelected,
  isIndeterminate,
  isLoading,
  showCheckbox,
  showIcon,
  multiple,
  disabled,
  hasChildItems,
  onNodeClick,
}: TreeSelectTreeItemContentProps<T>) => {
  const isSelectable = node.allowSelection !== false;
  const isRowDisabled = disabled || node.disabled || !isSelectable;

  return (
    <Tree.ItemContent
      className="tw:text-sm tw:font-normal tw:text-primary"
      hasChildItems={hasChildItems}
      indentPerLevel={28}
      maxIndentLevel={2}>
      {() => (
        <div
          className={cx(
            'tw:relative tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:py-0.5',
            isRowDisabled ? 'tw:cursor-not-allowed' : 'tw:cursor-pointer'
          )}
          data-testid={`tree-node-${node.id}`}
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            if (!isRowDisabled) {
              onNodeClick();
            }
          }}>
          {showCheckbox && multiple && isSelectable && (
            <span
              data-selected={isSelected}
              data-testid={`${
                node.isParentMutuallyExclusive ? 'radio' : 'checkbox'
              }-${node.id}`}>
              {node.isParentMutuallyExclusive ? (
                <RadioButtonBase
                  isDisabled={isRowDisabled}
                  isSelected={isSelected}
                />
              ) : (
                <CheckboxBase
                  isDisabled={isRowDisabled}
                  isIndeterminate={isIndeterminate}
                  isSelected={isSelected}
                  size="xs"
                />
              )}
            </span>
          )}

          {showIcon && node.icon && (
            <span
              aria-hidden="true"
              className={cx('tw:flex tw:shrink-0', node.iconClassName)}>
              {node.icon}
            </span>
          )}

          <Typography
            className={cx(
              'not-prose tw:grow tw:truncate',
              node.disabled && 'tw:text-disabled'
            )}
            title={node.label}>
            {node.label}
          </Typography>

          {node.count !== undefined && node.count > 0 && (
            <Typography
              className={cx(
                'not-prose tw:shrink-0 tw:rounded-md tw:border tw:border-secondary tw:px-1.5 tw:tabular-nums',
                isSelected ? 'tw:text-tertiary' : 'tw:text-placeholder'
              )}
              data-testid="filter-count"
              size="text-xs"
              weight="regular">
              {node.count.toLocaleString()}
            </Typography>
          )}

          {isLoading && (
            <RefreshCw01
              aria-hidden="true"
              className="tw:size-3.5 tw:shrink-0 tw:animate-spin tw:text-fg-quaternary"
            />
          )}
        </div>
      )}
    </Tree.ItemContent>
  );
};
