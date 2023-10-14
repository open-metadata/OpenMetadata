/*
 *  Copyright 2023 Collate.
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
import { Button, Checkbox, List, Space, Tooltip } from 'antd';
import { cloneDeep, isEmpty } from 'lodash';
import VirtualList from 'rc-virtual-list';
import React, { UIEventHandler, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../components/Loader/Loader';
import {
  ADD_USER_CONTAINER_HEIGHT,
  pagingObject,
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { getEntityName } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import Searchbar from '../searchbar/Searchbar';
import '../UserSelectableList/user-select-dropdown.less';
import { UserTag } from '../UserTag/UserTag.component';
import { SelectableListProps } from './SelectableList.interface';

export const SelectableList = ({
  fetchOptions,
  multiSelect,
  selectedItems,
  onUpdate,
  onCancel,
  searchPlaceholder,
  customTagRenderer,
  searchBarDataTestId,
  removeIconTooltipLabel,
}: SelectableListProps) => {
  const [uniqueOptions, setUniqueOptions] = useState<EntityReference[]>([]);
  const [searchText, setSearchText] = useState('');
  const { t } = useTranslation();
  const [pagingInfo, setPagingInfo] = useState<Paging>(pagingObject);

  const [selectedItemsInternal, setSelectedItemInternal] = useState<
    Map<string, EntityReference>
  >(() => {
    const selectedItemMap = new Map();

    selectedItems.forEach((item) => selectedItemMap.set(item.id, item));

    return selectedItemMap;
  });

  const [fetching, setFetching] = useState(false);
  const [fetchOptionFailed, setFetchOptionFailed] = useState(false);

  useEffect(() => {
    setSelectedItemInternal(() => {
      const selectedItemMap = new Map();

      selectedItems.forEach((item) => selectedItemMap.set(item.id, item));

      return selectedItemMap;
    });
  }, [setSelectedItemInternal, selectedItems]);

  const sortUniqueListFromSelectedList = useCallback(
    (items: Map<string, EntityReference>, listOptions: EntityReference[]) => {
      if (!items.size) {
        return listOptions;
      }

      return [
        ...items.values(),
        ...listOptions.filter((option) => !items.has(option.id)),
      ];
    },
    [selectedItemsInternal]
  );

  const fetchListOptions = useCallback(async () => {
    setFetching(true);
    try {
      const { data, paging } = await fetchOptions('');

      setUniqueOptions(
        sortUniqueListFromSelectedList(selectedItemsInternal, data)
      );
      setPagingInfo(paging);
      fetchOptionFailed && setFetchOptionFailed(false);
    } catch (error) {
      setFetchOptionFailed(true);
    } finally {
      setFetching(false);
    }
  }, [selectedItemsInternal, sortUniqueListFromSelectedList]);

  useEffect(() => {
    fetchListOptions();
  }, []);

  const handleSearch = useCallback(
    async (search: string) => {
      const { data, paging } = await fetchOptions(search);

      setUniqueOptions(
        isEmpty(search)
          ? sortUniqueListFromSelectedList(selectedItemsInternal, data)
          : data
      );

      setPagingInfo(paging);
      setSearchText(search);
    },
    [selectedItemsInternal]
  );

  const onScroll: UIEventHandler<HTMLElement> = useCallback(
    async (e) => {
      if (
        // If user reachs to end of container fetch more options
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
          ADD_USER_CONTAINER_HEIGHT &&
        // If there are other options available which can be determine form the cursor value
        pagingInfo.after &&
        // If we have all the options already we don't need to fetch more
        uniqueOptions.length < pagingInfo.total
      ) {
        const { data, paging } = await fetchOptions(
          searchText,
          pagingInfo.after
        );

        setUniqueOptions((prevData) => [...prevData, ...data]);
        setPagingInfo(paging);
      }
    },
    [pagingInfo, uniqueOptions, searchText]
  );

  const selectionHandler = (item: EntityReference) => {
    if (multiSelect) {
      setSelectedItemInternal((itemsMap) => {
        const id = item.id;
        const newItemsMap = cloneDeep(itemsMap);
        if (newItemsMap.has(id)) {
          newItemsMap?.delete(id);
        } else {
          newItemsMap?.set(id, item);
        }

        return newItemsMap;
      });
    } else {
      onUpdate(selectedItemsInternal.has(item.id) ? [] : [item]);
    }
  };

  const handleUpdateClick = () => {
    onUpdate([...selectedItemsInternal.values()]);
  };

  const handleRemoveClick = () => {
    onUpdate([]);
  };

  const handleClearAllClick = () => {
    setSelectedItemInternal(new Map());
  };

  return (
    <List
      data-testid="selectable-list"
      footer={
        multiSelect && (
          <div className="d-flex justify-between">
            <Button
              color="primary"
              data-testid="clear-all-button"
              size="small"
              type="text"
              onClick={handleClearAllClick}>
              {t('label.clear-entity', { entity: t('label.all-lowercase') })}
            </Button>
            <Space className="m-l-auto text-right">
              <Button
                color="primary"
                data-testid="cancel-button"
                size="small"
                onClick={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="selectable-list-update-btn"
                size="small"
                type="primary"
                onClick={handleUpdateClick}>
                {t('label.update')}
              </Button>
            </Space>
          </div>
        )
      }
      header={
        <Searchbar
          removeMargin
          placeholder={searchPlaceholder ?? t('label.search')}
          searchBarDataTestId={searchBarDataTestId}
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearch}
        />
      }
      itemLayout="vertical"
      loading={{ spinning: fetching, indicator: <Loader /> }}
      size="small">
      <VirtualList
        data={uniqueOptions}
        height={ADD_USER_CONTAINER_HEIGHT}
        itemKey="id"
        onScroll={onScroll}>
        {(item) => (
          <List.Item
            className="selectable-list-item cursor-pointer"
            extra={
              multiSelect ? (
                <Checkbox checked={selectedItemsInternal.has(item.id)} />
              ) : (
                selectedItemsInternal.has(item.id) && (
                  <RemoveIcon
                    removeIconTooltipLabel={removeIconTooltipLabel}
                    removeOwner={handleRemoveClick}
                  />
                )
              )
            }
            key={item.id}
            title={getEntityName(item)}
            onClick={() => selectionHandler(item)}>
            {customTagRenderer ? (
              customTagRenderer(item)
            ) : (
              <UserTag id={item.id} name={getEntityName(item)} />
            )}
          </List.Item>
        )}
      </VirtualList>
    </List>
  );
};

const RemoveIcon = ({
  removeOwner,
  removeIconTooltipLabel,
}: {
  removeOwner?: () => void;
  removeIconTooltipLabel?: string;
}) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      title={
        removeIconTooltipLabel ??
        t('label.remove-entity', {
          entity: t('label.owner-lowercase'),
        })
      }>
      <SVGIcons
        data-testid="remove-owner"
        icon={Icons.ICON_REMOVE_COLORED}
        onClick={(e) => {
          e.stopPropagation();
          removeOwner && removeOwner();
        }}
      />
    </Tooltip>
  );
};
