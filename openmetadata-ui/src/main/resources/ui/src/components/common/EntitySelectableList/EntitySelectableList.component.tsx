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
import { Popover } from 'antd';
import { useState } from 'react';
import { ADD_USER_CONTAINER_HEIGHT } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { FocusTrapWithContainer } from '../FocusTrap/FocusTrapWithContainer';
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

  const handleUpdate = async (updateItems: EntityReference[]) => {
    const convertedItems = config.fromEntityReference(updateItems);
    await onUpdate(convertedItems);
    setPopupVisible(false);
  };

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <FocusTrapWithContainer active={popoverProps?.open || popupVisible}>
          <SelectableList
            customTagRenderer={config.customTagRenderer}
            fetchOptions={config.fetchOptions}
            height={listHeight}
            multiSelect={multiSelect}
            searchBarDataTestId={config.searchBarDataTestId}
            searchPlaceholder={config.searchPlaceholder}
            selectedItems={config.toEntityReference(selectedItems)}
            onCancel={onCancel}
            onUpdate={handleUpdate}
          />
        </FocusTrapWithContainer>
      }
      open={popupVisible}
      overlayClassName={`${config.overlayClassName} ${
        popoverProps?.overlayClassName ?? ''
      }`}
      placement="top"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children}
    </Popover>
  );
};
