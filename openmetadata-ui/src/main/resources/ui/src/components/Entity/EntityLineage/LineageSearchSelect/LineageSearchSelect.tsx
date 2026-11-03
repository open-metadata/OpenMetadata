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
import {
  Box,
  Select,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronRight } from '@openmetadata/ui-core-components/icons';
import { debounce } from 'lodash';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Collection, Key, ListBoxLoadMoreItem } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import {
  DEBOUNCE_TIMEOUT,
  INITIAL_NODE_ITEMS_LENGTH,
  NODE_ITEMS_PAGE_SIZE,
  ZOOM_TRANSITION_DURATION,
} from '../../../../constants/Lineage.constants';
import { LineagePlatformView } from '../../../../hooks/lineage/types';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { EntityIconSize } from '../../../../utils/EntityIconUtils';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageNodeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import { useLineageHandlers } from '../../../Lineage/Lineage/LineageHandlersContext';
import { getVisibleOptions } from './LineageSearchSelect.utils';

type LineageSearchOption = SelectItemType & {
  label: string;
  content: ReactNode;
};

const LineageSearchSelect = () => {
  const { t } = useTranslation();
  const { onNodeClick } = useLineageHandlers();
  // `nodes` itself is read when needed, not subscribed to: it changes every
  // drag frame. The id key changes only when nodes are added or removed.
  const nodeIdsKey = useLineageStore((s) =>
    s.nodes.map((node) => node.id).join('|')
  );
  const {
    reactFlowInstance,
    zoomValue,
    isPlatformLineage,
    platformView,
    setSelectedColumn,
  } = useLineageStore(
    useShallow((s) => ({
      reactFlowInstance: s.reactFlowInstance,
      zoomValue: s.zoomValue,
      isPlatformLineage: s.isPlatformLineage,
      platformView: s.platformView,
      setSelectedColumn: s.setSelectedColumn,
    }))
  );
  const [allOptions, setAllOptions] = useState<LineageSearchOption[]>([]);
  const [renderedOptions, setRenderedOptions] = useState<LineageSearchOption[]>(
    []
  );
  const [searchValue, setSearchValue] = useState<string>('');
  const searchValueRef = useRef(searchValue);
  searchValueRef.current = searchValue;
  const isOpenRef = useRef(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedOption, setSelectedOption] =
    useState<LineageSearchOption | null>(null);

  const generateNodeOptions = useCallback(() => {
    const optionsMap: Map<string, LineageSearchOption> = new Map();

    useLineageStore.getState().nodes.forEach((nodeObj) => {
      const { node } = nodeObj.data;
      if (!node) {
        return;
      }

      const nodeOption: LineageSearchOption = {
        id: node.fullyQualifiedName,
        label: getEntityName(node),
        content: (
          <Box
            align="center"
            data-testid={`option-${node.fullyQualifiedName}`}
            gap={1}>
            <img
              alt={node.serviceType}
              height="16px"
              src={serviceUtilClassBase.getServiceTypeLogo(node)}
              width="16px"
            />
            <Typography ellipsis size="text-sm">
              {getEntityName(node)}
            </Typography>
          </Box>
        ),
      };
      optionsMap.set(nodeOption.id, nodeOption);

      const { children: childrenFlatten } = getEntityChildrenAndLabel(node);

      childrenFlatten.forEach((column) => {
        // A metric is its own column-lineage endpoint, so its only child is the
        // node itself. Both options key on FQN, so without this the child would
        // overwrite the node option added above and render the node with the
        // column-style label.
        if (column.fullyQualifiedName === node.fullyQualifiedName) {
          return;
        }

        const columnOption: LineageSearchOption = {
          id: column.fullyQualifiedName ?? '',
          label: getEntityName(column),
          content: (
            <Box
              align="center"
              data-testid={`option-${column.fullyQualifiedName}`}
              gap={1}>
              <Box align="center" gap={1}>
                <img
                  alt={node.serviceType}
                  height="16px"
                  src={serviceUtilClassBase.getServiceTypeLogo(node)}
                  width="16px"
                />
                <Typography className="tw:text-tertiary" size="text-xs">
                  {getEntityName(node)}
                </Typography>
                <ChevronRight
                  aria-hidden="true"
                  className="tw:size-3 tw:text-fg-quaternary"
                />
              </Box>
              <Box align="center" gap={1}>
                {searchClassBase.getEntityIconWithBg(
                  node.entityType ?? '',
                  EntityIconSize.Size14
                )}
                <Typography ellipsis size="text-sm">
                  {getEntityName(column)}
                </Typography>
              </Box>
            </Box>
          ),
        };
        optionsMap.set(columnOption.id, columnOption);
      });
    });

    return Array.from(optionsMap.values());
  }, []);

  const filterOptions = useCallback(
    (value: string) => setRenderedOptions(getVisibleOptions(allOptions, value)),
    [allOptions]
  );

  const debouncedFilterOptions = useMemo(
    () => debounce(filterOptions, DEBOUNCE_TIMEOUT),
    [filterOptions]
  );

  useEffect(() => {
    return () => {
      debouncedFilterOptions.cancel();
    };
  }, [debouncedFilterOptions]);

  const loadMoreData = () => {
    if (searchValue || renderedOptions.length >= allOptions.length) {
      return;
    }
    setRenderedOptions(
      allOptions.slice(0, renderedOptions.length + NODE_ITEMS_PAGE_SIZE)
    );
  };

  // Rebuilding replaces `allOptions`, which cancels a queued filter (typing
  // into the focused input reopens the menu after queueing one), so the
  // current text is applied here.
  const refreshOptions = useCallback(() => {
    const options = generateNodeOptions();
    setAllOptions(options);
    setRenderedOptions(getVisibleOptions(options, searchValueRef.current));
  }, [generateNodeOptions]);

  // While open, follow nodes being added or removed, but not drag updates.
  useEffect(() => {
    if (isOpenRef.current) {
      refreshOptions();
    }
  }, [nodeIdsKey, refreshOptions]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      isOpenRef.current = open;
      if (open) {
        refreshOptions();

        return;
      }
      setSearchValue('');
      setRenderedOptions(allOptions.slice(0, INITIAL_NODE_ITEMS_LENGTH));
      debouncedFilterOptions.cancel();
    },
    [allOptions, debouncedFilterOptions, refreshOptions]
  );

  const onOptionSelect = useCallback(
    (value?: string) => {
      const selectedNode = useLineageStore
        .getState()
        .nodes.find(
          (node: Node) => node.data.node.fullyQualifiedName === value
        );
      if (selectedNode) {
        onNodeClick(selectedNode);

        // Centre on what is actually drawn. LineageMap keeps the laid-out nodes
        // in its own state and feeds them to React Flow; the array reached here
        // through the provider is a different one, whose nodes are seeded at the
        // origin and never carry the ELK coordinates. Centring on those puts the
        // viewport at (0,0), and since the canvas renders with
        // onlyRenderVisibleElements, the node just picked is never drawn -- the
        // drawer opens on it while the graph sits somewhere else entirely.
        // Matching on fullyQualifiedName, the same key the lookup above uses,
        // avoids depending on the two arrays sharing node ids.
        const renderedPosition = reactFlowInstance
          ?.getNodes()
          .find(
            (node) => node.data?.node?.fullyQualifiedName === value
          )?.position;
        const { x, y } = renderedPosition ?? selectedNode.position;

        reactFlowInstance?.setCenter(x, y, {
          duration: ZOOM_TRANSITION_DURATION,
          zoom: zoomValue,
        });
      } else {
        setSelectedColumn(value ?? '');
      }
    },
    [onNodeClick, reactFlowInstance, setSelectedColumn, zoomValue]
  );

  // Both inputValue and value are controlled, so react-aria never
  // rewrites the input itself: it re-emits the current key on blur/close to
  // ask for the text to be synced back, and leaves clearing to us.
  const handleSelectionChange = (key: Key | null) => {
    const id = key === null ? null : String(key);
    if (id === (selectedOption?.id ?? null)) {
      setInputValue(selectedOption?.label ?? '');

      return;
    }
    const option = allOptions.find((opt) => opt.id === id) ?? null;
    setSelectedOption(option);
    setInputValue(option?.label ?? '');
    onOptionSelect(id ?? undefined);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setSearchValue(value);
    debouncedFilterOptions(value);
    if (!value && selectedOption) {
      setSelectedOption(null);
      onOptionSelect();
    }
  };

  if (isPlatformLineage || platformView !== LineagePlatformView.None) {
    return null;
  }

  return (
    <Select.ComboBox
      allowsEmptyCollection
      aria-label={t('label.search-entity', {
        entity: t('label.lineage'),
      })}
      className="tw:w-80"
      data-testid="lineage-search"
      emptyState={t('label.no-data-found')}
      fontSize="sm"
      inputValue={inputValue}
      items={renderedOptions}
      placeholder={t('label.search-entity', {
        entity: t('label.lineage'),
      })}
      shortcut={false}
      size="md"
      value={selectedOption?.id ?? null}
      onChange={handleSelectionChange}
      onInputChange={handleInputChange}
      onOpenChange={handleOpenChange}>
      <Collection items={renderedOptions}>
        {(option) => (
          <Select.Item id={option.id} textValue={option.label}>
            {option.content}
          </Select.Item>
        )}
      </Collection>
      <ListBoxLoadMoreItem onLoadMore={loadMoreData} />
    </Select.ComboBox>
  );
};

export default React.memo(LineageSearchSelect);
