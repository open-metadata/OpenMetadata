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
import { useMemo, useState } from 'react';
import { ADD_USER_CONTAINER_HEIGHT } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import AnchoredPopover from '../AnchoredPopover/AnchoredPopover';
import { SelectableList } from '../SelectableList/SelectableList.component';
import { EntitySelectableListProps } from './EntitySelectableList.interface';

export const EntitySelectableList = <T,>({
  selectedItems,
  onUpdate,
  onCancel,
  children,
  popoverProps,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
  config,
  multiSelect = true,
}: EntitySelectableListProps<T>) => {
  const [popupVisible, setPopupVisible] = useState(false);

  const selectedItemsAsEntityReferences = useMemo(
    () => config.toEntityReference(selectedItems),
    [selectedItems, config.toEntityReference]
  );

  const handleUpdate = async (updateItems: EntityReference[]) => {
    const convertedItems = config.fromEntityReference(updateItems);
    await onUpdate(convertedItems);
    setPopupVisible(false);
  };

  const isOpen = popoverProps?.open ?? popupVisible;

  const handleOpenChange = (open: boolean) => {
    setPopupVisible(open);
    popoverProps?.onOpenChange?.(open);
  };

  return (
    <AnchoredPopover
      className={config.overlayClassName}
      containerClassName="tw:px-3 tw:pt-2"
      content={
        <SelectableList
          customTagRenderer={config.customTagRenderer}
          fetchOptions={config.fetchOptions}
          height={listHeight}
          multiSelect={multiSelect}
          searchBarDataTestId={config.searchBarDataTestId}
          searchPlaceholder={config.searchPlaceholder}
          selectedItems={selectedItemsAsEntityReferences}
          onCancel={onCancel}
          onUpdate={handleUpdate}
        />
      }
      isOpen={isOpen}
      placement={popoverProps?.placement ?? 'top'}
      onOpenChange={handleOpenChange}>
      {children}
    </AnchoredPopover>
  );
};
