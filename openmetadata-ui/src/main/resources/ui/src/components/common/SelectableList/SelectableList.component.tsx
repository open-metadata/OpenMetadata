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
import { Affix, Button, Checkbox, List, Tooltip } from 'antd';
import { ADD_USER_CONTAINER_HEIGHT, pagingObject } from 'constants/constants';
import { EntityReference } from 'generated/entity/data/table';
import { Paging } from 'generated/type/paging';
import { cloneDeep } from 'lodash';
import VirtualList from 'rc-virtual-list';
import React, { UIEventHandler, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import Searchbar from '../searchbar/Searchbar';
import '../UserSelectableList/user-select-dropdown.less';
import { UserTag } from '../UserTag/UserTag.component';

interface PaginatedResponse {
  data: EntityReference[];
  paging: Paging;
}

interface Props {
  fetchOptions: (
    searchText: string,
    after?: string
  ) => Promise<PaginatedResponse>;
  multiSelect?: boolean;
  selectedItems: EntityReference[];
  onCancel: () => void;
  onUpdate: (updatedItems: EntityReference[]) => void;
  searchPlaceholder?: string;
}

export const SelectableList = ({
  fetchOptions,
  multiSelect,
  selectedItems,
  onUpdate,
  onCancel,
  searchPlaceholder,
}: Props) => {
  const [uniqueOptions, setUniqueOptions] = useState<EntityReference[]>([]);
  const [searchText, setSearchText] = useState('');
  const { t } = useTranslation();
  const [pagingInfo, setPagingInfo] = useState<Paging>(pagingObject);

  const [selectedItemsInternal, setSelectedItemInternal] = useState<
    Map<string, EntityReference>
  >(new Map());

  useEffect(() => {
    setSelectedItemInternal(() => {
      const selectedItemMap = new Map();

      selectedItems.map((item) => selectedItemMap.set(item.id, item));

      return selectedItemMap;
    });
  }, [setSelectedItemInternal, selectedItems]);

  const fetchListOptions = async () => {
    const { data, paging } = await fetchOptions('');

    setUniqueOptions(data);
    setPagingInfo(paging);
  };

  useEffect(() => {
    fetchListOptions();
  }, []);

  const handleSearch = async (search: string) => {
    const { data, paging } = await fetchOptions(search);

    setUniqueOptions(data);
    setPagingInfo(paging);
    setSearchText(search);
  };

  const onScroll: UIEventHandler<HTMLElement> = async (e) => {
    if (
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
        ADD_USER_CONTAINER_HEIGHT &&
      pagingInfo.after
    ) {
      const { data, paging } = await fetchOptions(searchText, pagingInfo.after);

      setUniqueOptions((prevData) => [...prevData, ...data]);
      setPagingInfo(paging);
    }
  };

  const selectionHandler = (item: EntityReference) => {
    multiSelect
      ? setSelectedItemInternal((itemsMap) => {
          const id = item.id;
          const newItemsMap = cloneDeep(itemsMap);
          if (newItemsMap.has(id)) {
            newItemsMap?.delete(id);
          } else {
            newItemsMap?.set(id, item);
          }

          return newItemsMap;
        })
      : onUpdate(selectedItemsInternal.has(item.id) ? [] : [item]);
  };

  const handleUpdateClick = () => {
    onUpdate([...selectedItemsInternal.values()]);
  };

  return (
    <div>
      <Searchbar
        removeMargin
        placeholder={searchPlaceholder ?? t('label.search')}
        searchValue={searchText}
        typingInterval={500}
        onSearch={handleSearch}
      />
      <List size="small">
        <VirtualList
          className="user-list"
          data={uniqueOptions}
          height={ADD_USER_CONTAINER_HEIGHT}
          itemKey="id"
          onScroll={onScroll}>
          {(item) => (
            <List.Item
              className="cursor-pointer"
              extra={
                multiSelect ? (
                  <Checkbox checked={selectedItemsInternal.has(item.id)} />
                ) : (
                  selectedItemsInternal.has(item.id) && <RemoveIcon />
                )
              }
              key={item.id}
              onClick={() => selectionHandler(item)}>
              <UserTag
                id={item.fullyQualifiedName ?? ''}
                name={item.displayName ?? ''}
              />
            </List.Item>
          )}
        </VirtualList>
      </List>
      {!multiSelect && (
        <Affix className="dropdown-control-bar" offsetBottom={0}>
          <Button
            className="update-btn"
            size="small"
            type="default"
            onClick={handleUpdateClick}>
            {t('label.update')}
          </Button>
          <Button color="primary" size="small" type="text" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        </Affix>
      )}
    </div>
  );
};

const RemoveIcon = ({ removeOwner }: { removeOwner?: () => void }) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      title={t('label.remove-entity', {
        entity: t('label.owner-lowercase'),
      })}>
      <button
        className="cursor-pointer"
        data-testid="remove-owner"
        onClick={(e) => {
          e.stopPropagation();
          removeOwner && removeOwner();
        }}>
        <SVGIcons
          alt={t('label.remove-entity', {
            entity: t('label.owner-lowercase'),
          })}
          icon={Icons.ICON_REMOVE}
          title={t('label.remove-entity', {
            entity: t('label.owner-lowercase'),
          })}
          width="16px"
        />
      </button>
    </Tooltip>
  );
};
