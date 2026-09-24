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
  DropdownSearchField,
  DropdownStagedFooter,
  DropdownStatusFooter,
  TriggerCountBadge,
} from '../filter-select/filter-select.shared';
import {
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FocusScope } from 'react-aria';
import type { Key, Selection } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { sizes } from '@/components/base/select/select';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { Tree } from '../tree/tree';
import {
  TreeSelectEmptyItemContent,
  TreeSelectTreeItemContent,
} from './tree-select-node';
import type { TreeSelectNode, TreeSelectProps } from './tree-select.types';
import { useTreeSelectData } from './use-tree-select-data';
import {
  getVisibleNodeIds,
  useTreeSelectSearch,
} from './use-tree-select-search';
import {
  getNodeSelectionState,
  hasExclusiveChildren,
  useTreeSelectSelection,
} from './use-tree-select-selection';

/** `tw:w-80` on the chrome dropdown, needed before it renders to pick a side. */
const DROPDOWN_CHROME_WIDTH = 320;
/** Matches react-aria's default overlay `containerPadding`. */
const VIEWPORT_PADDING = 12;

type DropdownPlacement = 'bottom left' | 'bottom right';

// Left edge of the trigger, mirrored right when there is no room on screen.
// Width is measured: `--trigger-width` is unset for a bare Popover + triggerRef.
const useDropdownPlacement = (
  triggerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  width?: number
): { placement: DropdownPlacement; triggerWidth?: number } => {
  const [placement, setPlacement] = useState<DropdownPlacement>('bottom left');
  const [triggerWidth, setTriggerWidth] = useState<number>();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setTriggerWidth(rect.width);
      const needed = (width ?? rect.width) + VIEWPORT_PADDING;
      const fitsRight = window.innerWidth - rect.left >= needed;
      const fitsLeft = rect.right >= needed;
      setPlacement(!fitsRight && fitsLeft ? 'bottom right' : 'bottom left');
    };

    measure();
    window.addEventListener('resize', measure);

    // The trigger can reflow while open, e.g. a grid cell editor mounting its
    // buttons beside it, and a width measured once would then be stale.
    const observer = new ResizeObserver(measure);
    if (triggerRef.current) {
      observer.observe(triggerRef.current);
    }

    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [isOpen, width, triggerRef]);

  return { placement, triggerWidth };
};

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

// Ids of every node that has children, so a branch can be opened wholesale.
const collectParentKeys = <T,>(
  nodes: TreeSelectNode<T>[],
  keys: Set<Key>
): Set<Key> => {
  for (const node of nodes) {
    if (node.children?.length) {
      keys.add(node.id);
      collectParentKeys(node.children, keys);
    }
  }

  return keys;
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
  emptyBranchMessage,
  loadingMessage,
  searchPlaceholder,
  triggerVariant = 'input',
  bordered = false,
  showSelectAll = false,
  commitMode = 'immediate',
  isOpen: controlledIsOpen,
  onOpenChange,
  renderTrigger,
  onNodeExpand,
  onNodeCollapse,
  onSearch,
  filterNode,
}: TreeSelectProps<T>): ReactElement => {
  const { t } = useCoreTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalOpen;
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef<typeof value>(undefined);
  // What was expanded before a search took over, restored when it clears.
  const preSearchExpandedRef = useRef<Set<Key> | null>(null);
  // Parents already opened for this search, so a later result never reopens one.
  const autoExpandedRef = useRef<Set<Key>>(new Set());
  const lastSearchRef = useRef('');
  // Stable root IDs captured before any search replaces treeData, so
  // displayedSelectedCount is not zeroed out while the user is searching.
  const [stableRootIds, setStableRootIds] = useState<Set<string>>(new Set());

  const isCustomTrigger = Boolean(renderTrigger);
  const isButtonVariant = !isCustomTrigger && triggerVariant === 'button';
  // Button and custom triggers put search, width and footer in the dropdown.
  const usesDropdownChrome = isButtonVariant || isCustomTrigger;
  const isStaged = commitMode === 'staged';
  const { placement, triggerWidth } = useDropdownPlacement(
    triggerRef,
    isOpen,
    usesDropdownChrome ? DROPDOWN_CHROME_WIDTH : undefined
  );

  const setOpen = useCallback(
    (open: boolean) => {
      setInternalOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

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

  // Staged mode reports once on Apply, not per toggle.
  const commit = isStaged ? undefined : onChange;

  const {
    selectedData,
    isNodeSelected,
    getDescendantSelection,
    toggleNodeSelection,
    setSelection,
  } = useTreeSelectSelection<T>({
    multiple,
    cascadeSelection,
    treeData,
    onChange: commit,
  });

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setSelection(toArray(value));
    }
  }, [value, setSelection]);

  // Resync the draft on open, including a programmatic one via `isOpen`.
  useEffect(() => {
    if (isOpen && isStaged) {
      setSelection(toArray(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm && treeData.length > 0) {
      setStableRootIds(new Set(treeData.map((n) => n.id)));
    }
  }, [treeData, searchTerm]);

  // Each parent opens once as it appears; clearing the search restores the old set.
  useEffect(() => {
    if (!searchTerm) {
      if (preSearchExpandedRef.current !== null) {
        setExpandedKeys(preSearchExpandedRef.current);
        preSearchExpandedRef.current = null;
        autoExpandedRef.current = new Set();
        lastSearchRef.current = '';
      }

      return;
    }

    if (preSearchExpandedRef.current === null) {
      preSearchExpandedRef.current = expandedKeys;
    }
    // A different term is a fresh result set, so its branches open again.
    if (lastSearchRef.current !== searchTerm) {
      lastSearchRef.current = searchTerm;
      autoExpandedRef.current = new Set();
    }

    const unopened = Array.from(collectParentKeys(treeData, new Set())).filter(
      (id) => !autoExpandedRef.current.has(id)
    );

    if (unopened.length === 0) {
      return;
    }

    unopened.forEach((id) => autoExpandedRef.current.add(id));
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      unopened.forEach((id) => next.add(id));

      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, treeData]);

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
      // Staged single-select waits for Apply, so the dropdown stays open.
      if (!multiple && !isStaged) {
        clearSearch();
        setOpen(false);
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
      isStaged,
      setOpen,
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

  const resolvedEmptyBranchMessage =
    emptyBranchMessage ?? noDataMessage ?? t('label.no-data-found');

  const renderNodes = useCallback(
    (
      nodes: TreeSelectNode<T>[],
      parentNode?: TreeSelectNode<T>
    ): ReactElement[] => {
      const visibleNodes = nodes.filter((node) => isNodeVisible(node.id));

      return visibleNodes.map((node) => {
        const isExclusiveGroup = hasExclusiveChildren(node);
        const { isFullySelected, isPartiallySelected } = getNodeSelectionState(
          getDescendantSelection(node),
          isNodeSelected(node.id)
        );

        return (
          <Tree.Item id={node.id} key={node.id} textValue={node.label}>
            <TreeSelectTreeItemContent
              disabled={disabled}
              hasChildItems={
                Boolean(node.children?.length) || node.isLeaf === false
              }
              isIndeterminate={isPartiallySelected}
              isLoading={loadingNodes.has(node.id)}
              isSelected={isFullySelected}
              multiple={multiple}
              node={node}
              showCheckbox={showCheckbox && !isExclusiveGroup}
              showIcon={showIcon}
              onNodeClick={() => {
                if (!isExclusiveGroup) {
                  handleNodeAction(node, parentNode);
                }
              }}
            />
            {node.children?.length
              ? renderNodes(node.children, node)
              : node.children &&
                node.isLeaf === false &&
                !loadingNodes.has(node.id) && (
                  <Tree.Item
                    id={`${node.id}__empty`}
                    key={`${node.id}__empty`}
                    textValue={resolvedEmptyBranchMessage}>
                    <TreeSelectEmptyItemContent
                      message={resolvedEmptyBranchMessage}
                      parentId={node.id}
                    />
                  </Tree.Item>
                )}
          </Tree.Item>
        );
      });
    },
    [
      resolvedEmptyBranchMessage,
      isNodeVisible,
      isNodeSelected,
      getDescendantSelection,
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
      setOpen(true);
    }
  };

  // Dismissing hands focus back to the trigger, whose onFocus would reopen it.
  // The restore arrives a frame or more later, so the flag has to stay armed
  // until a focus event consumes it — a timed reset loses the race and reopens.
  const skipNextFocusOpen = useRef(false);

  const openOnFocus = () => {
    if (skipNextFocusOpen.current) {
      skipNextFocusOpen.current = false;

      return;
    }
    openTrigger();
  };

  // Every close but Apply drops the draft, else the trigger shows stale state.
  const dismiss = useCallback(() => {
    skipNextFocusOpen.current = true;
    if (isStaged) {
      setSelection(toArray(value));
    }
    setOpen(false);
    setShowSelectedOnly(false);
  }, [isStaged, setSelection, value, setOpen]);

  // Closing through the trigger is a non-Apply close, so it discards the draft.
  const toggleOpen = useCallback(() => {
    if (disabled) {
      return;
    }
    if (isOpen) {
      dismiss();
    } else {
      setOpen(true);
    }
  }, [disabled, isOpen, dismiss, setOpen]);

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
      dismiss();
    };
    // On the document so Escape works from the search box, tree or trigger.
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss();
      }
    };
    // Capture: an overlay stopping propagation would otherwise hide the click.
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [isOpen, dismiss]);

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

  // Write local state: an uncontrolled or staged parent never echoes `value`.
  const replaceSelection = useCallback(
    (nodes: TreeSelectNode<T>[]) => {
      setSelection(nodes);
      commit?.(multiple ? nodes : nodes[0] ?? null);
    },
    [setSelection, commit, multiple]
  );

  const handleSelectAll = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        replaceSelection([]);

        return;
      }
      if (cascadeSelection && lazyLoad) {
        const deep = await Promise.all(treeData.map(loadAllDescendants));
        replaceSelection(collectSelectableNodes(deep));
      } else {
        replaceSelection(selectableNodes);
      }
    },
    [
      selectableNodes,
      replaceSelection,
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

    return collectParentKeys(filteredTreeData, new Set(expandedKeys));
  }, [showSelectedOnly, expandedKeys, filteredTreeData]);
  const showFooter = isStaged;
  // Immediate mode has nothing to apply, so it shows a quiet footer instead.
  const showStatusFooter = usesDropdownChrome && multiple && !isStaged;

  const handleClearAll = useCallback(() => {
    replaceSelection([]);
  }, [replaceSelection]);

  const handleApply = useCallback(() => {
    onChange?.(multiple ? selectedData : selectedData[0] ?? null);
    setOpen(false);
    setShowSelectedOnly(false);
  }, [onChange, multiple, selectedData, setOpen]);

  const treeDropdownContent = (
    <div
      className="tw:contents"
      data-testid={dataTestId ? `${dataTestId}-popover` : undefined}
      ref={popoverRef}>
      {usesDropdownChrome && searchable && (
        <DropdownSearchField
          inputDataTestId={dataTestId ? `${dataTestId}-search` : undefined}
          placeholder={searchPlaceholder ?? t('label.search')}
          value={inputValue}
          onChange={(val) => searchable && setInputValue(val)}
        />
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
        className="tw:max-h-64 tw:overflow-y-auto tw:pl-[14px] tw:pr-1.5"
        onMouseDown={(event) => event.preventDefault()}>
        {loading ? (
          <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:px-4 tw:py-2 tw:text-xs tw:text-tertiary">
            <RefreshCw01
              aria-hidden="true"
              className="tw:size-4 tw:animate-spin"
            />
            {resolvedLoadingMessage}
          </div>
        ) : filteredTreeData.length === 0 ? (
          <div className="tw:px-4 tw:py-2 tw:text-center tw:text-xs tw:text-tertiary">
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
              if (!hasExclusiveChildren(node)) {
                handleNodeAction(node);
              }
            }}
            onExpandedChange={handleExpandedChange}>
            {renderNodes(filteredTreeData)}
          </Tree>
        )}
      </div>
      {showFooter && (
        <DropdownStagedFooter
          count={displayedSelectedCount}
          isClearDisabled={selectedData.length === 0}
          onApply={handleApply}
          onCancel={dismiss}
          onClear={handleClearAll}
        />
      )}

      {showStatusFooter && (
        <DropdownStatusFooter
          count={displayedSelectedCount}
          isClearDisabled={selectedData.length === 0}
          onClear={() => {
            handleClearAll();
            setShowSelectedOnly(false);
          }}
        />
      )}
    </div>
  );

  // Portaled: an absolute dropdown gets clipped by a card or drawer.
  const treeDropdown = (
    <Dropdown.Popover
      isNonModal
      className={cx(
        // `w-full` would size against the portal root.
        usesDropdownChrome && 'tw:w-80',
        popoverClassName
      )}
      // Stops a dismissable ancestor reading clicks here as outside ones.
      data-react-aria-top-layer="true"
      isOpen={isOpen}
      placement={placement}
      // No DialogTrigger, so the pointerdown effect above owns dismissal.
      shouldCloseOnInteractOutside={() => false}
      // The input variant matches its trigger; measured, not `--trigger-width`.
      style={
        usesDropdownChrome || triggerWidth === undefined
          ? undefined
          : { width: triggerWidth }
      }
      triggerRef={triggerRef}
      onOpenChange={setOpen}>
      {treeDropdownContent}
    </Dropdown.Popover>
  );

  if (renderTrigger) {
    return (
      <div className={cx('tw:relative tw:inline-block', className)}>
        <div ref={triggerRef}>
          {renderTrigger({
            isOpen,
            toggle: toggleOpen,
            open: openTrigger,
            close: dismiss,
            selectedCount: displayedSelectedCount,
          })}
        </div>
        {isOpen && treeDropdown}
      </div>
    );
  }

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
                'tw:text-fg-brand-primary tw:hover:text-fg-brand-primary tw:*:data-icon:text-fg-brand-primary',
              hasSelection && bordered && 'tw:after:outline-brand'
            )}
            color={bordered ? 'secondary' : 'tertiary'}
            data-testid={dataTestId}
            iconTrailing={ChevronDown}
            isDisabled={disabled}
            size={bordered ? 'md' : 'sm'}
            onPress={toggleOpen}>
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
              onFocus={openOnFocus}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  dismiss();

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
              'tw:size-4 tw:shrink-0 tw:transition-transform',
              selectedData.length > 0
                ? 'tw:text-fg-brand-primary'
                : 'tw:text-fg-quaternary',
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
