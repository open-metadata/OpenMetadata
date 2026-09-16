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
import { cx } from '@/utils/cx';
import { RefreshCw01 } from '@untitledui/icons';
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
  showConnectorLines?: boolean;
  isLastChild?: boolean;
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
  showConnectorLines = false,
  isLastChild = false,
  onNodeClick,
}: TreeSelectTreeItemContentProps<T>) => {
  const isSelectable = node.allowSelection !== false;
  const isRowDisabled = disabled || node.disabled || !isSelectable;

  return (
    <Tree.ItemContent hasChildItems={hasChildItems}>
      {(renderProps) => (
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
          {showConnectorLines &&
            renderProps.level >= 2 &&
            Array.from({ length: renderProps.level - 1 }, (_, i) => {
              const left = -40 - i * 16;
              const isDirectParent = i === 0;

              if (isDirectParent) {
                return (
                  <span key={`line-${i}`} aria-hidden="true">
                    <span
                      className={cx(
                        'tw:pointer-events-none tw:absolute tw:w-3 tw:border-l tw:border-b tw:border-gray-300 tw:rounded-bl-md',
                        isLastChild
                          ? 'tw:-top-2.5 tw:h-[calc(50%+12px)]'
                          : 'tw:-top-2.5 tw:h-[calc(50%+12px)]'
                      )}
                      style={{ left: `${left}px` }}
                    />
                    {!isLastChild && (
                      <span
                        className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:-bottom-2.5 tw:w-px tw:border-l tw:border-gray-300"
                        style={{ left: `${left}px` }}
                      />
                    )}
                  </span>
                );
              }

              return (
                <span
                  key={`line-${i}`}
                  aria-hidden="true"
                  className="tw:pointer-events-none tw:absolute tw:-top-2.5 tw:-bottom-2.5 tw:w-px tw:border-l tw:border-gray-300"
                  style={{ left: `${left}px` }}
                />
              );
            })}
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

          {node.count !== undefined && node.count > 0 && (
            <span className="tw:ml-auto tw:shrink-0 tw:rounded-md tw:border tw:border-secondary tw:px-1.5 tw:text-xs tw:font-normal tw:tabular-nums tw:text-tertiary">
              {node.count}
            </span>
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
