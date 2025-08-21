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
import { RightOutlined } from '@ant-design/icons';
import { Select, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import {
  DEBOUNCE_TIMEOUT,
  INITIAL_NODE_ITEMS_LENGTH,
  NODE_ITEMS_PAGE_SIZE,
  ZOOM_TRANSITION_DURATION,
} from '../../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { Column } from '../../../../generated/entity/data/table';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';

const LineageSearchSelect = () => {
  const { t } = useTranslation();
  const {
    nodes,
    zoomValue,
    reactFlowInstance,
    onNodeClick,
    onColumnClick,
    isPlatformLineage,
    platformView,
  } = useLineageProvider();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [allOptions, setAllOptions] = useState<DefaultOptionType[]>([]);
  const [renderedOptions, setRenderedOptions] = useState<DefaultOptionType[]>(
    []
  );
  const [searchValue, setSearchValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const generateNodeOptions = useCallback(() => {
    const options: DefaultOptionType[] = [];

    nodes.forEach((nodeObj) => {
      const { node } = nodeObj.data;
      if (!node) {
        return;
      }

      const nodeOption = {
        label: (
          <Space data-testid={`option-${node.fullyQualifiedName}`} size={0}>
            <img
              alt={node.serviceType}
              className="m-r-xss"
              height="16px"
              src={serviceUtilClassBase.getServiceTypeLogo(node)}
              width="16px"
            />
            <Typography.Text>{getEntityName(node)}</Typography.Text>
          </Space>
        ),
        value: node.fullyQualifiedName,
        dataLabel: getEntityName(node),
      };
      options.push(nodeOption);

      const { childrenFlatten = [] } = getEntityChildrenAndLabel(node);

      childrenFlatten.forEach((column: Column) => {
        const columnOption = {
          label: (
            <div
              className="d-flex items-center gap-1"
              data-testid={`option-${column.fullyQualifiedName}`}>
              <div className="d-flex items-center gap-1">
                <img
                  alt={node.serviceType}
                  height="16px"
                  src={serviceUtilClassBase.getServiceTypeLogo(node)}
                  width="16px"
                />
                <Typography.Text className="text-grey-muted text-xs">
                  {getEntityName(node)}
                </Typography.Text>
                <RightOutlined className="text-grey-muted text-xss" />
              </div>
              <div className="d-flex items-center gap-1 ">
                <div className="flex-center w-4 h-4 text-base-color">
                  {searchClassBase.getEntityIcon(node.entityType ?? '')}
                </div>
                <Typography.Text>{getEntityName(column)}</Typography.Text>
              </div>
            </div>
          ),
          value: column.fullyQualifiedName,
          dataLabel: getEntityName(column),
        };
        options.push(columnOption);
      });
    });

    return options;
  }, [nodes]);

  useEffect(() => {
    if (isDropdownOpen && allOptions.length === 0) {
      setIsLoading(true);
      const options = generateNodeOptions();
      setAllOptions(options);
      setRenderedOptions(options.slice(0, INITIAL_NODE_ITEMS_LENGTH));
      setIsLoading(false);
    }
  }, [isDropdownOpen, allOptions.length, generateNodeOptions]);

  useEffect(() => {
    setAllOptions([]);
    setRenderedOptions([]);
    setSearchValue('');
  }, [nodes]);

  const filterOptions = useCallback(
    (value: string) => {
      if (value) {
        const filteredOptions = allOptions.filter((option) =>
          option.dataLabel
            ?.toString()
            .toLowerCase()
            .includes(value.toLowerCase())
        );
        setRenderedOptions(filteredOptions);
      } else {
        setRenderedOptions(allOptions.slice(0, INITIAL_NODE_ITEMS_LENGTH));
      }
    },
    [allOptions]
  );

  // Create a debounced version of the filter function
  const debouncedFilterOptions = useMemo(
    () => debounce(filterOptions, DEBOUNCE_TIMEOUT),
    [filterOptions]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedFilterOptions.cancel();
    };
  }, [debouncedFilterOptions]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    debouncedFilterOptions(value);
  };

  const loadMoreData = () => {
    if (searchValue) {
      // If searching, just use the filtered options from allOptions
      filterOptions(searchValue);
    } else {
      const nextLength = Math.min(
        renderedOptions.length + NODE_ITEMS_PAGE_SIZE,
        allOptions.length
      );
      setRenderedOptions(allOptions.slice(0, nextLength));
    }
  };

  const handleDropdownVisibleChange = useCallback(
    (open: boolean) => {
      setIsDropdownOpen(open);
      if (!open) {
        setSearchValue('');
        setRenderedOptions(allOptions.slice(0, INITIAL_NODE_ITEMS_LENGTH));
        debouncedFilterOptions.cancel();
      }
    },
    [allOptions, debouncedFilterOptions]
  );

  const handlePopupScroll = (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      loadMoreData();
    }
  };

  const onOptionSelect = useCallback(
    (value?: string) => {
      const selectedNode = nodes.find(
        (node: Node) => node.data.node.fullyQualifiedName === value
      );
      if (selectedNode) {
        const { position } = selectedNode;
        onNodeClick(selectedNode);
        reactFlowInstance?.setCenter(position.x, position.y, {
          duration: ZOOM_TRANSITION_DURATION,
          zoom: zoomValue,
        });
      } else {
        onColumnClick(value ?? '');
      }
    },
    [onNodeClick, reactFlowInstance, onColumnClick, nodes, zoomValue]
  );

  if (isPlatformLineage || platformView !== LineagePlatformView.None) {
    return null;
  }

  return (
    <Select
      allowClear
      showSearch
      className="custom-control-search-box"
      data-testid="lineage-search"
      dropdownMatchSelectWidth={false}
      listHeight={300}
      loading={isLoading}
      optionFilterProp="dataLabel"
      optionLabelProp="dataLabel"
      options={renderedOptions}
      placeholder={t('label.search-entity', {
        entity: t('label.lineage'),
      })}
      popupClassName="lineage-search-options-list"
      searchValue={searchValue}
      onChange={onOptionSelect}
      onDropdownVisibleChange={handleDropdownVisibleChange}
      onPopupScroll={handlePopupScroll}
      onSearch={handleSearch}
    />
  );
};

export default LineageSearchSelect;
