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

import {
    Button,
    CheckboxBase,
    Tooltip,
    TooltipTrigger
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { cloneDeep, isEmpty } from 'lodash';
import VirtualList from 'rc-virtual-list';
import { UIEventHandler, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconRemoveColored } from '../../../assets/svg/ic-remove-colored.svg';
import {
    ADD_USER_CONTAINER_HEIGHT,
    pagingObject
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { useRovingFocus } from '../../../hooks/useRovingFocus';
import { getEntityName } from '../../../utils/EntityNameUtils';
import Loader from '../Loader/Loader';
import Searchbar from '../SearchBarComponent/SearchBar.component';
import { UserTag } from '../UserTag/UserTag.component';
import { SelectableListProps } from './SelectableList.interface';

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
      <TooltipTrigger>
        <button
          className="tw:flex tw:items-center tw:justify-center tw:bg-transparent tw:border-0 tw:p-0 tw:cursor-pointer tw:text-tertiary hover:tw:text-primary"
          data-testid="remove-owner"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeOwner?.();
          }}>
          <IconRemoveColored aria-hidden className="tw:size-4" />
        </button>
      </TooltipTrigger>
    </Tooltip>
  );
};

export const SelectableList = ({
  fetchOptions,
  multiSelect,
  selectedItems,
  onUpdate,
  onCancel,
  onChange,
  searchPlaceholder,
  customTagRenderer,
  searchBarDataTestId,
  removeIconTooltipLabel,
  emptyPlaceholderText,
  height = ADD_USER_CONTAINER_HEIGHT,
}: SelectableListProps) => {
  const [listOptions, setListOptions] = useState<EntityReference[]>([]);
  const [uniqueOptions, setUniqueOptions] = useState<EntityReference[]>([]);
  const [searchText, setSearchText] = useState('');
  const { t } = useTranslation();
  const [pagingInfo, setPagingInfo] = useState<Paging>(pagingObject);

  const [selectedItemsInternal, setSelectedItemsInternal] = useState<
    Map<string, EntityReference>
  >(() => {
    const selectedItemMap = new Map();

    selectedItems.forEach((item) => selectedItemMap.set(item.id, item));

    return selectedItemMap;
  });

  const [fetching, setFetching] = useState(false);
  const [fetchOptionFailed, setFetchOptionFailed] = useState(false);
  const [updating, setUpdating] = useState(false);

  const checkActiveSelectedItem = (item: EntityReference) => {
    return (
      selectedItemsInternal.has(item.id) ||
      selectedItemsInternal.has(item.name ?? '')
    );
  };

  useEffect(() => {
    setSelectedItemsInternal(() => {
      const selectedItemMap = new Map();

      selectedItems.forEach((item) => selectedItemMap.set(item.id, item));

      return selectedItemMap;
    });
  }, [selectedItems]);

  const sortUniqueListFromSelectedList = useCallback(
    (items: Map<string, EntityReference>, listOptions: EntityReference[]) => {
      if (!items.size) {
        return listOptions;
      }

      return [
        ...items.values(),
        ...listOptions.filter((option) => !checkActiveSelectedItem(option)),
      ];
    },
    [selectedItemsInternal]
  );

  const fetchListOptions = useCallback(async () => {
    setFetching(true);
    try {
      const { data, paging } = await fetchOptions('');

      setListOptions(data);
      setPagingInfo(paging);
      fetchOptionFailed && setFetchOptionFailed(false);
    } catch {
      setFetchOptionFailed(true);
    } finally {
      setFetching(false);
    }
  }, [selectedItemsInternal, sortUniqueListFromSelectedList]);

  useEffect(() => {
    fetchListOptions();
  }, []);

  useEffect(() => {
    setUniqueOptions(
      sortUniqueListFromSelectedList(selectedItemsInternal, listOptions)
    );
  }, [listOptions]);

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
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop === height &&
        pagingInfo.after &&
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

  const handleUpdate = useCallback(
    async (updateItems: EntityReference[]) => {
      setUpdating(true);
      try {
        await onUpdate?.(updateItems);
      } finally {
        setUpdating(false);
      }
    },
    [setUpdating, onUpdate]
  );

  const selectionHandler = (item: EntityReference) => {
    if (multiSelect) {
      setSelectedItemsInternal((itemsMap) => {
        const id = item.id;
        const newItemsMap = cloneDeep(itemsMap);
        if (newItemsMap.has(id)) {
          newItemsMap?.delete(id);
        } else {
          newItemsMap?.set(id, item);
        }

        const newSelectedItems = [...newItemsMap.values()];
        onChange?.(newSelectedItems);

        return newItemsMap;
      });
    } else {
      handleUpdate(selectedItemsInternal.has(item.id) ? [] : [item]);
    }
  };

  const { containerRef, getItemProps } = useRovingFocus({
    totalItems: uniqueOptions.length,
    onSelect: (index) => selectionHandler(uniqueOptions[index]),
  });

  const handleUpdateClick = async () => {
    handleUpdate([...selectedItemsInternal.values()]);
  };

  const handleRemoveClick = useCallback(async () => {
    handleUpdate([]);
  }, [handleUpdate]);

  const handleClearAllClick = () => {
    setSelectedItemsInternal(new Map());
    onChange?.([]);
  };

  return (
    <div data-testid="selectable-list">
      {/* Header — search bar */}
      <div className="tw:px-3 tw:pt-2 tw:pb-1">
        <Searchbar
          removeMargin
          placeholder={searchPlaceholder ?? t('label.search')}
          searchBarDataTestId={searchBarDataTestId}
          typingInterval={500}
          onSearch={handleSearch}
        />
      </div>

      {/* List body */}
      <div className="tw:relative">
        {(fetching || updating) && (
          <div className="tw:flex tw:items-center tw:justify-center tw:py-4">
            <Loader size="small" />
          </div>
        )}
        {!fetching && uniqueOptions.length === 0 && (
          <div className="tw:px-3 tw:py-4 tw:text-sm tw:text-tertiary">
            {emptyPlaceholderText ?? t('message.no-data-available')}
          </div>
        )}
        {uniqueOptions.length > 0 && (
          <div ref={containerRef}>
            <VirtualList
              className="selectable-list-virtual-list tw:px-2 tw:pb-2"
              data={uniqueOptions}
              height={height}
              itemHeight={40}
              itemKey="id"
              onScroll={onScroll}>
              {(item, index) => (
                <button
                  className={classNames(
                    'selectable-list-item',
                    'tw:flex tw:w-full tw:items-center tw:justify-between tw:px-2 tw:py-2 tw:rounded-md tw:cursor-pointer tw:select-none tw:bg-transparent tw:border-0 tw:text-left',
                    'hover:tw:bg-secondary',
                    'focus-visible:tw:outline-2 focus-visible:tw:outline-brand-500',
                    {
                      'tw:bg-brand-50 active': checkActiveSelectedItem(item),
                    }
                  )}
                  data-testid="owner-option"
                  key={item.id}
                  type="button"
                  {...getItemProps(index)}
                  title={getEntityName(item)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectionHandler(item);
                  }}>
                  <div className="tw:flex tw:items-center tw:min-w-0 tw:flex-1">
                    {customTagRenderer ? (
                      customTagRenderer(item)
                    ) : (
                      <UserTag
                        avatarType="outlined"
                        id={item.name ?? ''}
                        name={getEntityName(item)}
                      />
                    )}
                  </div>
                  <div className="tw:flex tw:items-center tw:shrink-0 tw:ml-2">
                    {multiSelect ? (
                      <CheckboxBase
                        isSelected={checkActiveSelectedItem(item)}
                        size="sm"
                      />
                    ) : (
                      checkActiveSelectedItem(item) && (
                        <RemoveIcon
                          removeIconTooltipLabel={removeIconTooltipLabel}
                          removeOwner={handleRemoveClick}
                        />
                      )
                    )}
                  </div>
                </button>
              )}
            </VirtualList>
          </div>
        )}
      </div>

      {/* Footer — multiselect controls */}
      {multiSelect && (
        <div className="tw:flex tw:items-center tw:justify-between tw:px-3 tw:py-3 tw:border-t tw:border-primary">
          <Button
            color="link-gray"
            data-testid="clear-all-button"
            size="sm"
            onPress={handleClearAllClick}>
            {t('label.clear-entity', { entity: t('label.all-lowercase') })}
          </Button>
          <div className="tw:flex tw:items-center tw:gap-2">
            <Button
              color="secondary"
              data-testid="cancel-button"
              size="sm"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="selectable-list-update-btn"
              isLoading={updating}
              size="sm"
              onPress={handleUpdateClick}>
              {t('label.update')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
