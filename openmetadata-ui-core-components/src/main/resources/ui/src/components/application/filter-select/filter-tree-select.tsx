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
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { HintText } from '@/components/base/input/hint-text';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { sizes } from '@/components/base/select/select';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { Tree } from '../tree/tree';
import { TreeSelectTreeItemContent } from './filter-tree-select-node';
import type {
  TreeSelectNode,
  TreeSelectProps,
} from './filter-tree-select.types';
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

const filterTreeToSelected = <T,>(
  nodes: TreeSelectNode<T>[],
  selectedIds: Set<string>
): TreeSelectNode<T>[] => {
  const result: TreeSelectNode<T>[] = [];
  for (const node of nodes) {
    const filteredChildren = node.children
      ? filterTreeToSelected(node.children, selectedIds)
      : [];
    if (selectedIds.has(node.id) || filteredChildren.length > 0) {
      result.push(
        filteredChildren.length > 0
          ? { ...node, children: filteredChildren }
          : node
      );
    }
  }

  return result;
};

const collectSelectableNodes = <T,>(
  nodes: TreeSelectNode<T>[]
): TreeSelectNode<T>[] => {
  const result: TreeSelectNode<T>[] = [];
  for (const node of nodes) {
    if (node.allowSelection !== false) {
      result.push(node);
    }
    if (node.children) {
      result.push(...collectSelectableNodes(node.children));
    }
  }

  return result;
};

const TriggerCountBadge = ({ count }: { count: number }) => (
  <span className="tw:ml-1.5 tw:inline-flex tw:h-[18px] tw:min-w-[18px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-brand-50 tw:px-[5px] tw:text-xs tw:font-medium tw:text-utility-brand-700 tw:tabular-nums">
    {count}
  </span>
);

const SearchInputIcon = (props: React.HTMLAttributes<HTMLOrSVGElement>) => (
  <SearchLg aria-hidden="true" {...props} />
);

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
  className,
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
  noDataMessage,
  loadingMessage,
  searchPlaceholder,
  triggerVariant = 'input',
  bordered = false,
  showConnectorLines = false,
  showSelectAll = false,
  onNodeExpand,
  onNodeCollapse,
  onSearch,
  filterNode,
}: TreeSelectProps<T>): ReactElement => {
  const { t } = useCoreTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef<typeof value>(undefined);
  // Stable root IDs captured before any search replaces treeData, so
  // displayedSelectedCount is not zeroed out while the user is searching.
  const [stableRootIds, setStableRootIds] = useState<Set<string>>(new Set());

  const isButtonVariant = triggerVariant === 'button';

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

  useEffect(() => {
    if (!searchTerm && treeData.length > 0) {
      setStableRootIds(new Set(treeData.map((n) => n.id)));
    }
  }, [treeData, searchTerm]);

  const loadAllDescendants = useCallback(
    async (node: TreeSelectNode<T>): Promise<TreeSelectNode<T>> => {
      if (node.children?.length) {
        const deepChildren = await Promise.all(
          node.children.map((child) => loadAllDescendants(child))
        );

        return { ...node, children: deepChildren };
      }

      if (node.isLeaf === true || !shouldLazyLoad(node, lazyLoad)) {
        return node;
      }

      // Fetch directly — do NOT call loadChildren here to avoid a duplicate
      // API request (loadChildren would re-fetch the same parentId).
      const response = await fetchData({ parentId: node.id });

      if (response.nodes.length > 0) {
        const deepChildren = await Promise.all(
          response.nodes.map((child) => loadAllDescendants(child))
        );

        return { ...node, children: deepChildren };
      }

      return node;
    },
    [fetchData, lazyLoad]
  );

  const handleNodeAction = useCallback(
    async (node: TreeSelectNode<T>, parentNode?: TreeSelectNode<T>) => {
      if (disabled || node.allowSelection === false) {
        return;
      }

      let nodeForSelection = node;

      if (
        cascadeSelection &&
        multiple &&
        !isNodeSelected(node.id) &&
        node.isLeaf !== true
      ) {
        try {
          nodeForSelection = await loadAllDescendants(node);
        } catch {
          // Fetch failed — skip selection rather than selecting a partial tree
          return;
        }
      }

      toggleNodeSelection(nodeForSelection, parentNode);
      if (!multiple) {
        clearSearch();
        setIsOpen(false);
      }
    },
    [
      disabled,
      toggleNodeSelection,
      multiple,
      clearSearch,
      cascadeSelection,
      isNodeSelected,
      loadAllDescendants,
    ]
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
    ): ReactElement[] => {
      const visibleNodes = nodes.filter((node) => isNodeVisible(node.id));

      return visibleNodes.map((node) => {
        const hasExclusiveChildren =
          node.hasExclusiveChildren ??
          node.children?.some((c) => c.isParentMutuallyExclusive) ??
          false;

        return (
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
              showCheckbox={showCheckbox && !hasExclusiveChildren}
              showConnectorLines={showConnectorLines}
              showIcon={showIcon}
              onNodeClick={() => {
                if (!hasExclusiveChildren) {
                  handleNodeAction(node, parentNode);
                }
              }}
            />
            {node.children && renderNodes(node.children, node)}
          </Tree.Item>
        );
      });
    },
    [
      isNodeVisible,
      isNodeSelected,
      loadingNodes,
      disabled,
      multiple,
      showCheckbox,
      showIcon,
      showConnectorLines,
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
      setShowSelectedOnly(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const resolvedNoDataMessage = noDataMessage ?? t('label.no-data-found');
  const resolvedLoadingMessage = loadingMessage ?? t('label.loading');

  const displayedSelectedCount = useMemo(
    () => selectedData.filter((n) => !stableRootIds.has(n.id)).length,
    [selectedData, stableRootIds]
  );

  const selectableNodes = useMemo(
    () => collectSelectableNodes(treeData),
    [treeData]
  );
  const allSelectedCount = useMemo(
    () => selectableNodes.filter((n) => isNodeSelected(n.id)).length,
    [selectableNodes, isNodeSelected]
  );
  const allSelected =
    selectableNodes.length > 0 && allSelectedCount === selectableNodes.length;

  const handleSelectAll = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        onChange?.(multiple ? [] : null);

        return;
      }
      if (cascadeSelection && lazyLoad) {
        const deep = await Promise.all(treeData.map(loadAllDescendants));
        onChange?.(multiple ? collectSelectableNodes(deep) : null);
      } else {
        onChange?.(multiple ? selectableNodes : null);
      }
    },
    [
      selectableNodes,
      multiple,
      onChange,
      cascadeSelection,
      lazyLoad,
      treeData,
      loadAllDescendants,
    ]
  );

  const showSelectAllRow =
    showSelectAll && multiple && selectableNodes.length > 0;

  const selectedIdsSet = useMemo(
    () => new Set(selectedData.map((n) => n.id)),
    [selectedData]
  );
  const filteredTreeData = useMemo(
    () =>
      showSelectedOnly
        ? filterTreeToSelected(treeData, selectedIdsSet)
        : treeData,
    [showSelectedOnly, treeData, selectedIdsSet]
  );
  const filteredExpandedKeys = useMemo(() => {
    if (!showSelectedOnly) {
      return expandedKeys;
    }
    const keys = new Set(expandedKeys);
    const addParentKeys = (nodes: TreeSelectNode<T>[]) => {
      for (const node of nodes) {
        if (node.children?.length) {
          keys.add(node.id);
          addParentKeys(node.children);
        }
      }
    };
    addParentKeys(filteredTreeData);

    return keys;
  }, [showSelectedOnly, expandedKeys, filteredTreeData]);
  const showStatusFooter = isButtonVariant && multiple;

  const handleClearAll = useCallback(() => {
    onChange?.(multiple ? [] : null);
  }, [multiple, onChange]);

  const treeDropdown = (
    <div
      className={cx(
        'tw:absolute tw:top-full tw:left-0 tw:z-50 tw:mt-1 tw:rounded-lg tw:bg-primary tw:shadow-lg tw:outline-1 tw:outline-secondary_alt',
        isButtonVariant ? 'tw:w-80' : 'tw:w-full tw:min-w-full',
        popoverClassName
      )}
      data-testid={dataTestId ? `${dataTestId}-popover` : undefined}
      ref={popoverRef}>
      {isButtonVariant && searchable && (
        <div className="tw:p-2">
          <Input
            icon={SearchInputIcon}
            placeholder={searchPlaceholder ?? t('label.search')}
            size="sm"
            value={inputValue}
            onChange={(val) => searchable && setInputValue(val)}
          />
        </div>
      )}
      {showSelectAllRow && (
        <div
          className="tw:px-4 tw:py-2"
          onMouseDown={(event) => event.preventDefault()}>
          <Checkbox
            isIndeterminate={allSelectedCount > 0 && !allSelected}
            isSelected={allSelected}
            label={t('label.select-all')}
            size="xs"
            onChange={handleSelectAll}
          />
        </div>
      )}
      <div
        className="tw:max-h-64 tw:overflow-y-auto tw:px-3 tw:py-1"
        onMouseDown={(event) => event.preventDefault()}>
        {loading ? (
          <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:p-4 tw:text-sm tw:text-tertiary">
            <RefreshCw01
              aria-hidden="true"
              className="tw:size-4 tw:animate-spin"
            />
            {resolvedLoadingMessage}
          </div>
        ) : filteredTreeData.length === 0 ? (
          <div className="tw:p-4 tw:text-center tw:text-sm tw:text-tertiary">
            {resolvedNoDataMessage}
          </div>
        ) : (
          <Tree
            aria-label={label ?? placeholder ?? 'Tree select'}
            expandedKeys={filteredExpandedKeys}
            selectionMode="none"
            onAction={(key) => {
              const node = findNode(treeData, String(key));
              if (!node) {
                return;
              }
              const isExclusiveParent =
                node.hasExclusiveChildren ??
                node.children?.some((c) => c.isParentMutuallyExclusive) ??
                false;
              if (!isExclusiveParent) {
                handleNodeAction(node);
              }
            }}
            onExpandedChange={handleExpandedChange}>
            {renderNodes(filteredTreeData)}
          </Tree>
        )}
      </div>
      {showStatusFooter && (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:py-1.5 tw:pr-1.5 tw:pl-3">
          <span
            className="tw:text-xs tw:font-normal tw:text-tertiary"
            data-testid="selected-count">
            {displayedSelectedCount === 0
              ? t('label.none-selected')
              : t('label.count-selected', { count: displayedSelectedCount })}
          </span>
          <Button
            color="tertiary"
            data-testid="clear-filter-btn"
            isDisabled={selectedData.length === 0}
            size="sm"
            onPress={() => {
              handleClearAll();
              setShowSelectedOnly(false);
            }}>
            {t('label.clear-all')}
          </Button>
        </div>
      )}
    </div>
  );

  if (isButtonVariant) {
    const hasSelection = selectedData.length > 0;
    const triggerText = label ?? placeholder ?? '';

    return (
      <div className={cx('tw:relative tw:inline-block', className)}>
        <div ref={triggerRef}>
          <Button
            className={cx(
              'tw:whitespace-nowrap',
              !bordered && 'tw:p-1 tw:*:data-icon:size-3.5',
              hasSelection &&
                'tw:text-fg-brand-primary tw:hover:text-fg-brand-primary',
              hasSelection && bordered && 'tw:after:outline-brand'
            )}
            color={bordered ? 'secondary' : 'tertiary'}
            data-testid={dataTestId}
            iconTrailing={ChevronDown}
            isDisabled={disabled}
            size={bordered ? 'md' : 'sm'}
            onPress={() => setIsOpen((prev) => !prev)}>
            {triggerText}
            {multiple && hasSelection && (
              <TriggerCountBadge count={displayedSelectedCount} />
            )}
          </Button>
        </div>
        {isOpen && treeDropdown}
      </div>
    );
  }

  return (
    <div className={cx('tw:flex tw:flex-col tw:gap-1.5', className)}>
      {label && (
        <Label isRequired={required} tooltip={tooltip}>
          {label}
        </Label>
      )}

      <div className="tw:relative">
        <div
          className={cx(
            'tw:relative tw:flex tw:w-full tw:cursor-text tw:flex-wrap tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:transition tw:duration-100 tw:ease-linear',
            sizes[size].root,
            isOpen && 'tw:outline-2 tw:-outline-offset-2 tw:outline-brand',
            isInvalid && 'tw:outline-error_subtle',
            isInvalid &&
              isOpen &&
              'tw:outline-2 tw:-outline-offset-2 tw:outline-error',
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
                className="tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:bg-primary tw:py-0.5 tw:pr-1 tw:pl-1.5 tw:outline-1 tw:-outline-offset-1 tw:outline-primary"
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

        {isOpen && treeDropdown}
      </div>

      {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
    </div>
  );
};
