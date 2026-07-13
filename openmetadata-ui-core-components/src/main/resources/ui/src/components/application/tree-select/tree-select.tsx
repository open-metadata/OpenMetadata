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
import { ChevronDown, RefreshCw01, SearchLg, XClose } from '@untitledui/icons';
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FocusScope } from 'react-aria';
import type { Key, Selection } from 'react-aria-components';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { sizes } from '@/components/base/select/select';
import { cx } from '@/utils/cx';
import { Tree } from '../tree/tree';
import { TreeSelectTreeItemContent } from './tree-select-node';
import type { TreeSelectNode, TreeSelectProps } from './tree-select.types';
import { useTreeSelectData } from './use-tree-select-data';
import {
  getVisibleNodeIds,
  useTreeSelectSearch,
} from './use-tree-select-search';
import { useTreeSelectSelection } from './use-tree-select-selection';

const shouldLazyLoad = <T,>(
  node: TreeSelectNode<T> | undefined,
  componentLazyLoad: boolean
): boolean => {
  if (!node) {
    return componentLazyLoad;
  }

  return (
    node.lazyLoad !== false && (node.lazyLoad === true || componentLazyLoad)
  );
};

const findNode = <T,>(
  nodes: TreeSelectNode<T>[],
  id: string
): TreeSelectNode<T> | undefined => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = node.children && findNode(node.children, id);
    if (found) {
      return found;
    }
  }

  return undefined;
};

const toArray = <T,>(
  value: TreeSelectNode<T> | TreeSelectNode<T>[] | null | undefined
): TreeSelectNode<T>[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

export const TreeSelect = <T = unknown,>({
  label,
  placeholder,
  hint,
  tooltip,
  required,
  disabled = false,
  isInvalid = false,
  size = 'sm',
  autoFocus,
  'data-testid': dataTestId,
  popoverClassName,
  fetchData,
  value,
  onChange,
  multiple = false,
  searchable = false,
  lazyLoad = false,
  showCheckbox = true,
  showIcon = true,
  cascadeSelection = false,
  debounceMs = 300,
  pageSize = 50,
  noDataMessage = 'No data found',
  loadingMessage = 'Loading...',
  searchPlaceholder,
  onNodeExpand,
  onNodeCollapse,
  onSearch,
  filterNode,
}: TreeSelectProps<T>): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef<typeof value>(undefined);

  const { inputValue, searchTerm, setInputValue, clearSearch } =
    useTreeSelectSearch({ debounceMs, onSearch });

  const { treeData, loading, loadingNodes, loadChildren } =
    useTreeSelectData<T>({ fetchData, searchTerm, pageSize });

  const visibleNodeIds = useMemo(
    () =>
      searchable ? getVisibleNodeIds(treeData, searchTerm, filterNode) : null,
    [searchable, treeData, searchTerm, filterNode]
  );
  const isNodeVisible = useCallback(
    (nodeId: string) => visibleNodeIds === null || visibleNodeIds.has(nodeId),
    [visibleNodeIds]
  );

  const { selectedData, isNodeSelected, toggleNodeSelection, setSelection } =
    useTreeSelectSelection<T>({
      multiple,
      cascadeSelection,
      treeData,
      onChange,
    });

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setSelection(toArray(value));
    }
  }, [value, setSelection]);

  const handleNodeAction = useCallback(
    (node: TreeSelectNode<T>, parentNode?: TreeSelectNode<T>) => {
      if (disabled || node.allowSelection === false) {
        return;
      }
      toggleNodeSelection(node, parentNode);
      if (!multiple) {
        clearSearch();
        setIsOpen(false);
      }
    },
    [disabled, toggleNodeSelection, multiple, clearSearch]
  );

  const handleExpandedChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        return;
      }
      const nextKeys = keys as Set<Key>;
      const expandedId = Array.from(nextKeys).find(
        (key) => !expandedKeys.has(key)
      );
      const collapsedId = Array.from(expandedKeys).find(
        (key) => !nextKeys.has(key)
      );

      setExpandedKeys(nextKeys);

      if (expandedId !== undefined) {
        const id = String(expandedId);
        onNodeExpand?.(id);
        const node = findNode(treeData, id);
        if (shouldLazyLoad(node, lazyLoad) && !loadingNodes.has(id)) {
          loadChildren(id);
        }
      }
      if (collapsedId !== undefined) {
        onNodeCollapse?.(String(collapsedId));
      }
    },
    [
      expandedKeys,
      treeData,
      lazyLoad,
      loadingNodes,
      loadChildren,
      onNodeExpand,
      onNodeCollapse,
    ]
  );

  const renderNodes = useCallback(
    (
      nodes: TreeSelectNode<T>[],
      parentNode?: TreeSelectNode<T>
    ): ReactElement[] =>
      nodes
        .filter((node) => isNodeVisible(node.id))
        .map((node) => (
          <Tree.Item id={node.id} key={node.id} textValue={node.label}>
            <TreeSelectTreeItemContent
              disabled={disabled}
              hasChildItems={
                Boolean(node.children?.length) || node.isLeaf === false
              }
              isLoading={loadingNodes.has(node.id)}
              isSelected={isNodeSelected(node.id)}
              multiple={multiple}
              node={node}
              showCheckbox={showCheckbox}
              showIcon={showIcon}
              onNodeClick={() => handleNodeAction(node, parentNode)}
            />
            {node.children && renderNodes(node.children, node)}
          </Tree.Item>
        )),
    [
      isNodeVisible,
      isNodeSelected,
      loadingNodes,
      disabled,
      multiple,
      showCheckbox,
      showIcon,
      handleNodeAction,
    ]
  );

  const removeSelection = useCallback(
    (id: string) => {
      const node = selectedData.find((n) => n.id === id);
      if (node) {
        toggleNodeSelection(node);
      }
    },
    [selectedData, toggleNodeSelection]
  );

  const displayValue = isOpen
    ? inputValue
    : !multiple
    ? selectedData[0]?.label ?? ''
    : '';

  const openTrigger = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      {label && (
        <Label isRequired={required} tooltip={tooltip}>
          {label}
        </Label>
      )}

      <div className="tw:relative">
        <div
          className={cx(
            'tw:relative tw:flex tw:w-full tw:cursor-text tw:flex-wrap tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset tw:transition tw:duration-100 tw:ease-linear',
            sizes[size].root,
            isOpen && 'tw:ring-2 tw:ring-brand',
            isInvalid && 'tw:ring-error_subtle',
            isInvalid && isOpen && 'tw:ring-2 tw:ring-error',
            disabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle'
          )}
          data-testid={dataTestId}
          ref={triggerRef}
          onClick={() => {
            openTrigger();
            inputRef.current?.focus();
          }}>
          <SearchLg className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary" />

          {multiple &&
            selectedData.map((node) => (
              <span
                className="tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:bg-primary tw:py-0.5 tw:pr-1 tw:pl-1.5 tw:ring-1 tw:ring-primary tw:ring-inset"
                key={node.id}>
                <p className="tw:max-w-40 tw:truncate tw:text-sm tw:font-medium tw:text-secondary">
                  {node.label}
                </p>
                <button
                  aria-label={`Remove ${node.label}`}
                  className="tw:flex tw:cursor-pointer tw:rounded-[3px] tw:p-0.5 tw:text-fg-quaternary tw:outline-transparent tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:disabled:cursor-not-allowed"
                  disabled={disabled}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSelection(node.id);
                  }}>
                  <XClose className="tw:size-2.5" strokeWidth={3} />
                </button>
              </span>
            ))}

          <FocusScope autoFocus={false} contain={false} restoreFocus={false}>
            <input
              aria-label={label ?? placeholder}
              autoFocus={autoFocus}
              className="tw:min-w-[6rem] tw:flex-1 tw:appearance-none tw:bg-transparent tw:text-sm tw:text-primary tw:outline-hidden tw:placeholder:text-placeholder tw:disabled:cursor-not-allowed"
              disabled={disabled}
              placeholder={
                selectedData.length > 0
                  ? undefined
                  : searchPlaceholder ?? placeholder
              }
              readOnly={!searchable}
              ref={inputRef}
              value={displayValue}
              onChange={(event) =>
                searchable && setInputValue(event.target.value)
              }
              onFocus={openTrigger}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsOpen(false);

                  return;
                }
                if (
                  event.key === 'Backspace' &&
                  multiple &&
                  !inputValue &&
                  selectedData.length > 0
                ) {
                  removeSelection(selectedData[selectedData.length - 1].id);
                }
              }}
            />
          </FocusScope>

          <ChevronDown
            aria-hidden="true"
            className={cx(
              'tw:size-4 tw:shrink-0 tw:text-fg-quaternary tw:transition-transform',
              isOpen && 'tw:rotate-180'
            )}
          />
        </div>

        {isOpen && (
          <div
            className={cx(
              'tw:absolute tw:top-full tw:left-0 tw:z-50 tw:mt-1 tw:w-full tw:min-w-full tw:rounded-lg tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt',
              popoverClassName
            )}
            data-testid={dataTestId ? `${dataTestId}-popover` : undefined}
            ref={popoverRef}>
            <div
              className="tw:max-h-80 tw:overflow-y-auto tw:p-1"
              onMouseDown={(event) => event.preventDefault()}>
              {loading ? (
                <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:p-4 tw:text-sm tw:text-tertiary">
                  <RefreshCw01
                    aria-hidden="true"
                    className="tw:size-4 tw:animate-spin"
                  />
                  {loadingMessage}
                </div>
              ) : treeData.length === 0 ? (
                <div className="tw:p-4 tw:text-center tw:text-sm tw:text-tertiary">
                  {noDataMessage}
                </div>
              ) : (
                <Tree
                  aria-label={label ?? placeholder ?? 'Tree select'}
                  expandedKeys={expandedKeys}
                  selectionMode="none"
                  onAction={(key) => {
                    const node = findNode(treeData, String(key));
                    if (node) {
                      handleNodeAction(node);
                    }
                  }}
                  onExpandedChange={handleExpandedChange}>
                  {renderNodes(treeData)}
                </Tree>
              )}
            </div>
          </div>
        )}
      </div>

      {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
    </div>
  );
};
