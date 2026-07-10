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
import { RefreshCw01 } from '@untitledui/icons';
import { CheckboxBase } from '@/components/base/checkbox/checkbox';
import { RadioButtonBase } from '@/components/base/radio-buttons/radio-buttons';
import { cx } from '@/utils/cx';
import { Tree } from '../tree/tree';
import type { TreeSelectNode } from './tree-select.types';

export interface TreeSelectTreeItemContentProps<T> {
  node: TreeSelectNode<T>;
  isSelected: boolean;
  isLoading: boolean;
  showCheckbox: boolean;
  showIcon: boolean;
  multiple: boolean;
  disabled: boolean;
  hasChildItems: boolean;
  onNodeClick: () => void;
}

export const TreeSelectTreeItemContent = <T,>({
  node,
  isSelected,
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
    <Tree.ItemContent showGuideLines hasChildItems={hasChildItems}>
      {() => (
        <div
          className={cx(
            'tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:py-0.5',
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
                  isSelected={isSelected}
                />
              )}
            </span>
          )}

          {showIcon && node.icon && (
            <span className="tw:flex tw:shrink-0 tw:items-center">
              {node.icon}
            </span>
          )}

          <span
            className={cx(
              'tw:min-w-0 tw:truncate tw:text-sm tw:text-secondary',
              isSelected && 'tw:font-medium tw:text-primary',
              node.disabled && 'tw:text-disabled'
            )}>
            {node.label}
          </span>

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
