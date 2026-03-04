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

import { Box, useAutocomplete, useTheme } from '@mui/material';
import { useTreeViewApiRef } from '@mui/x-tree-view/hooks';
import { debounce } from 'lodash';
import {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TreeNode } from '../atoms/asyncTreeSelect/types';
import { useAsyncTreeSelect } from '../atoms/asyncTreeSelect/useAsyncTreeSelect';
import { TreeContent } from './atoms/TreeContent';
import { TreeDropdown } from './atoms/TreeDropdown';
import { TreeNodeItem } from './atoms/TreeNodeItem';
import { TreeSearchInput } from './atoms/TreeSearchInput';
import {
  useTreeDropdown,
  useTreeFocusManagement,
  useTreeKeyboardNavigation,
} from './hooks';
import { MUIAsyncTreeSelectProps } from './MUIAsyncTreeSelect.interface';

const MUIAsyncTreeSelect: FC<MUIAsyncTreeSelectProps> = ({
  // Core props
  label,
  placeholder,
  helperText,
  required = false,
  disabled = false,
  error = false,
  fullWidth = true,
  size = 'small',
  autoFocus = false,
  'data-testid': dataTestId,

  // Tree select props
  multiple = false,
  cascadeSelection = false,
  searchable = false,
  searchPlaceholder,
  debounceMs = 300,
  lazyLoad = false,
  enableVirtualization = false,
  pageSize = 50,
  maxHeight = 300,
  minWidth,

  // Data props
  fetchData,
  value,
  defaultSelected,
  defaultExpanded,

  // Display props
  showCheckbox = true,
  showIcon = true,
  loadingMessage,
  noDataMessage,
  renderNode,
  filterNode,

  // Event handlers
  onChange,
  onNodeExpand,
  onNodeCollapse,
  onSearch,
}) => {
  const theme = useTheme();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const treeApiRef = useTreeViewApiRef();
  const prevSearchTermRef = useRef<string>('');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  // Custom hooks for tree functionality
  const {
    open,
    openDropdown,
    closeDropdown: closeDropdownBase,
  } = useTreeDropdown();

  const closeDropdown = useCallback(() => {
    closeDropdownBase();
    setFocusedItemId(null);
  }, [closeDropdownBase]);

  const { handleBlur, handleMouseDown, maintainFocus } = useTreeFocusManagement(
    {
      inputRef,
      anchorRef,
      disabled,
      onCloseDropdown: closeDropdown,
    }
  );

  // Tree state management
  const computedDefaultSelected = useMemo(() => {
    if (!value) {
      return defaultSelected;
    }

    return Array.isArray(value) ? value.map((v) => v.id) : [value.id];
  }, [value, defaultSelected]);

  const {
    treeData,
    loading,
    error: dataError,
    expandedNodes,
    selectedData,
    toggleNodeExpansion,
    isNodeSelected,
    toggleNodeSelection,
    clearSelection,
    removeLastSelectedOption,
    searchTerm,
    setSearchTerm,
    isNodeVisible,
    loadingNodes,
    loadChildren,
    collapseAll,
  } = useAsyncTreeSelect({
    multiple,
    cascadeSelection,
    searchable,
    debounceMs,
    pageSize,
    lazyLoad,
    enableVirtualization,
    defaultExpanded,
    defaultSelected: computedDefaultSelected,
    fetchData,
    onSelectionChange: onChange,
    onNodeExpand,
    onNodeCollapse,
    filterNode,
  });

  // Update ref to track search term changes
  useEffect(() => {
    prevSearchTermRef.current = searchTerm;
  }, [searchTerm]);

  // Create debounced search function with proper state transition handling
  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((query: string) => {
        // Handle search state transitions properly
        // When transitioning from search to empty (clearing search)
        if (!query && prevSearchTermRef.current) {
          // Collapse all nodes to reset the tree to initial state
          collapseAll();
        }
        setSearchTerm(query);
        onSearch?.(query);
      }, 300),
    [setSearchTerm, onSearch, collapseAll]
  );

  // Get visible nodes for keyboard navigation
  const getVisibleNodes = useCallback((): TreeNode[] => {
    const visibleNodes: TreeNode[] = [];

    const traverse = (nodes: TreeNode[], depth = 0) => {
      nodes.forEach((node) => {
        if (isNodeVisible(node.id)) {
          visibleNodes.push(node);
          if (expandedNodes.has(node.id) && node.children) {
            traverse(node.children, depth + 1);
          }
        }
      });
    };

    traverse(treeData);

    return visibleNodes;
  }, [treeData, expandedNodes, isNodeVisible]);

  // Utility function to find a node in the tree
  const findNodeInTree = useCallback(
    (nodes: TreeNode[], id: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return node;
        }
        if (node.children) {
          const found = findNodeInTree(node.children, id);
          if (found) {
            return found;
          }
        }
      }

      return null;
    },
    []
  );

  // Utility function to determine if a node should lazy load
  const shouldNodeLazyLoad = useCallback(
    (node: TreeNode | null, componentLazyLoad: boolean): boolean => {
      if (!node) {
        return componentLazyLoad;
      }

      return (
        node.lazyLoad !== false && (node.lazyLoad === true || componentLazyLoad)
      );
    },
    []
  );

  // Handle node selection needs to be defined before keyboard navigation
  const handleNodeClick = useCallback(
    (node: TreeNode, parentNode?: TreeNode) => {
      if (!disabled && node.allowSelection !== false) {
        toggleNodeSelection(node, parentNode);
        maintainFocus();
        // In single-select mode, clear search after selection to show all nodes again
        if (!multiple) {
          setInputValue('');
          debouncedSetSearchTerm('');
        }
      }
    },
    [
      disabled,
      toggleNodeSelection,
      maintainFocus,
      multiple,
      debouncedSetSearchTerm,
    ]
  );

  // Single source of truth for node expansion with lazy loading
  const handleNodeExpansion = useCallback(
    async (nodeId: string) => {
      if (!disabled) {
        const wasExpanded = expandedNodes.has(nodeId);
        toggleNodeExpansion(nodeId);
        const isExpanding = !wasExpanded;

        if (isExpanding && !loadingNodes.has(nodeId)) {
          const node = findNodeInTree(treeData, nodeId);
          if (shouldNodeLazyLoad(node, lazyLoad)) {
            await loadChildren(nodeId);
          }
        }

        maintainFocus();
      }
    },
    [
      disabled,
      expandedNodes,
      toggleNodeExpansion,
      loadingNodes,
      findNodeInTree,
      treeData,
      shouldNodeLazyLoad,
      lazyLoad,
      loadChildren,
      maintainFocus,
    ]
  );

  const { handleKeyDown } = useTreeKeyboardNavigation({
    treeApiRef,
    focusedItemId,
    setFocusedItemId,
    getVisibleNodes,
    expandedNodes,
    toggleNodeExpansion: handleNodeExpansion,
    treeData,
    inputRef,
    handleNodeClick,
    onOpenDropdown: openDropdown,
    onCloseDropdown: closeDropdown,
  });

  // Autocomplete integration
  const selectedOptions = useMemo(() => {
    return selectedData.map((node) => ({
      ...node,
      label: node.label,
    }));
  }, [selectedData]);

  const {
    getRootProps,
    getInputProps,
    getTagProps,
    setAnchorEl,
    getClearProps,
  } = useAutocomplete({
    id: 'async-tree-select',
    multiple,
    freeSolo: true,
    value: multiple ? selectedOptions : selectedOptions[0] || null,
    inputValue: inputValue,
    options: [],
    disableCloseOnSelect: multiple,
    clearOnEscape: true,
    disabled,
    onInputChange: (_event, newInputValue, reason) => {
      // Always update inputValue
      setInputValue(newInputValue);

      // Only trigger search when user is typing
      if (reason === 'input') {
        debouncedSetSearchTerm(newInputValue);
      } else if (reason === 'clear') {
        debouncedSetSearchTerm('');
      }
    },
    onChange: (_event, newValue) => {
      if (newValue === null) {
        clearSelection();
        setInputValue('');
        // Use the debounced function which handles collapse internally
        debouncedSetSearchTerm('');
      } else if (multiple && Array.isArray(newValue)) {
        // Handle removal of specific items when chips are deleted
        const currentIds = selectedData.map((n) => n.id);
        const newIds = new Set(
          newValue.map((v) => (typeof v === 'string' ? v : v.id))
        );

        // Find removed items
        const removedIds = currentIds.filter((id) => !newIds.has(id));
        removedIds.forEach((id) => {
          const node = selectedData.find((n) => n.id === id);
          if (node) {
            toggleNodeSelection(node);
          }
        });
      }
      // Note: freeSolo additions are typically handled through tree interactions
      // rather than autocomplete onChange, so we rely on handleNodeClick
    },
    isOptionEqualToValue: (option, value) => option.id === value.id,
  });

  // Set anchor element for autocomplete
  useEffect(() => {
    if (anchorRef.current && setAnchorEl) {
      (setAnchorEl as (el: HTMLElement | null) => void)(anchorRef.current);
    }
  }, [setAnchorEl]);

  // Initialize focus when dropdown opens
  useEffect(() => {
    if (open && treeData.length > 0) {
      const visibleNodes = getVisibleNodes();
      // Set focus on first item if no focus or current focus is not visible
      if (!focusedItemId || !visibleNodes.some((n) => n.id === focusedItemId)) {
        if (visibleNodes.length > 0) {
          setFocusedItemId(visibleNodes[0].id);
          // Keep focus on input
          inputRef.current?.focus();
        }
      }
    }
  }, [open, treeData, focusedItemId, getVisibleNodes, inputRef]);

  // Scroll focused item into view manually
  // IMPORTANT: Do NOT use treeApiRef.current.focusItem() here as it steals focus
  // from the autocomplete input and breaks keyboard navigation
  useEffect(() => {
    if (focusedItemId && open) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        // Find the focused tree item element by data attribute
        const focusedElement = document.querySelector(
          `[data-nodeid="${focusedItemId}"]`
        );

        if (focusedElement) {
          focusedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      });
    }
  }, [focusedItemId, open]);

  // Handle node expansion from TreeView component (mouse clicks)
  const handleNodeToggle = useCallback(
    async (_event: React.SyntheticEvent | null, newExpandedItems: string[]) => {
      if (!disabled) {
        const newExpandedSet = new Set(newExpandedItems);
        const toggledNodeId =
          [...expandedNodes].find((id) => !newExpandedSet.has(id)) ||
          newExpandedItems.find((id) => !expandedNodes.has(id));

        if (toggledNodeId) {
          await handleNodeExpansion(toggledNodeId);
        }
      }
    },
    [disabled, expandedNodes, handleNodeExpansion]
  );

  // Render tree nodes recursively
  const renderTreeNodes = useCallback(
    (nodes: TreeNode[], depth = 0, parentNode?: TreeNode): JSX.Element[] => {
      return nodes
        .filter((node) => isNodeVisible(node.id))
        .map((node) => {
          const isSelected = isNodeSelected(node.id);
          const isLoading = loadingNodes.has(node.id);
          const isFocused = focusedItemId === node.id;

          return (
            <TreeNodeItem
              depth={depth}
              disabled={disabled}
              isFocused={isFocused}
              isLoading={isLoading}
              isSelected={isSelected}
              key={node.id}
              multiple={multiple}
              node={node}
              parentNode={parentNode}
              renderChildren={() =>
                node.children
                  ? renderTreeNodes(node.children, depth + 1, node)
                  : null
              }
              showCheckbox={showCheckbox}
              showIcon={showIcon}
              onMouseDown={handleMouseDown}
              onNodeClick={handleNodeClick}
            />
          );
        });
    },
    [
      isNodeVisible,
      isNodeSelected,
      loadingNodes,
      focusedItemId,
      showCheckbox,
      showIcon,
      multiple,
      disabled,
      renderNode,
      handleNodeClick,
      handleMouseDown,
    ]
  );

  // Handle focused item change
  const handleTreeFocusedItemChange = useCallback(
    (_event: React.SyntheticEvent, itemId: string) => {
      setFocusedItemId(itemId);
    },
    []
  );

  // Combined key down handler
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle Backspace to remove last chip when input is empty
      if (
        e.key === 'Backspace' &&
        !inputValue &&
        multiple &&
        selectedData.length > 0
      ) {
        e.preventDefault();
        removeLastSelectedOption();

        return;
      }

      if (open) {
        handleKeyDown(e);
      }
    },
    [
      open,
      handleKeyDown,
      inputValue,
      multiple,
      selectedData,
      removeLastSelectedOption,
    ]
  );

  // Handle input blur to restore selected value if no new selection
  const handleInputBlur = useCallback(() => {
    // Restore selected value in single-select if no new selection
    if (!multiple && selectedOptions.length > 0) {
      const selectedLabel = selectedOptions[0].label;
      if (inputValue !== selectedLabel) {
        setInputValue(selectedLabel);
        debouncedSetSearchTerm(''); // Clear search to show all options
      }
    }

    // Call existing blur handler for dropdown management
    handleBlur();
  }, [
    multiple,
    selectedOptions,
    inputValue,
    handleBlur,
    debouncedSetSearchTerm,
  ]);

  // Calculate if has clearable value

  return (
    <Box ref={anchorRef} sx={{ width: fullWidth ? '100%' : 'auto' }}>
      <TreeSearchInput
        autoFocus={autoFocus}
        data-testid={dataTestId}
        disabled={disabled}
        error={error}
        fullWidth={fullWidth}
        getClearProps={getClearProps}
        getInputProps={getInputProps}
        getRootProps={getRootProps}
        getTagProps={getTagProps}
        hasClearableValue={selectedOptions.length > 0}
        helperText={helperText}
        inputRef={inputRef}
        label={label}
        loading={loading}
        multiple={multiple}
        open={open}
        placeholder={placeholder}
        required={required}
        searchPlaceholder={searchPlaceholder}
        searchable={searchable}
        selectedOptions={selectedOptions}
        size={size}
        onBlur={handleInputBlur}
        onClear={() => {
          clearSelection();
          setInputValue('');
          debouncedSetSearchTerm('');
          // Maintain focus on input after clearing
          inputRef.current?.focus();
        }}
        onFocus={() => openDropdown()}
        onKeyDown={handleInputKeyDown}
      />

      <TreeDropdown
        anchorEl={anchorRef.current}
        borderColor={theme.palette.divider}
        maxHeight={maxHeight}
        minWidth={minWidth}
        open={open}
        onClickAway={() => closeDropdown()}
        onMouseDown={handleMouseDown}>
        <TreeContent
          apiRef={treeApiRef}
          error={dataError}
          expandedItems={Array.from(expandedNodes)}
          focusedItem={focusedItemId || undefined}
          hasData={treeData.length > 0}
          loading={loading}
          loadingMessage={loadingMessage}
          noDataMessage={noDataMessage}
          selectedItems={null}
          onFocusedItemChange={handleTreeFocusedItemChange}
          onNodeToggle={handleNodeToggle}>
          {renderTreeNodes(treeData)}
        </TreeContent>
      </TreeDropdown>
    </Box>
  );
};

export default memo(MUIAsyncTreeSelect);
