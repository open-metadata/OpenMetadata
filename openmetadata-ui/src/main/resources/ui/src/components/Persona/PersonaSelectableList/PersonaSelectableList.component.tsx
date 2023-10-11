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
import { Button, Popover, Tooltip } from 'antd';
import { noop } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR, PAGE_SIZE_LARGE } from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getAllPersonas } from '../../../rest/PersonaAPI';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityUtils';
import { SelectableList } from '../../common/SelectableList/SelectableList.component';
import { PersonaSelectableListProps } from './PersonaSelectableList.interface';

export const PersonaSelectableList = ({
  hasPermission,
  selectedPersonas = [],
  onUpdate = noop,
  children,
  popoverProps,
  multiSelect = false,
  personaList,
}: PersonaSelectableListProps) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const [allPersona, setAllPersona] = useState<EntityReference[]>(
    personaList ?? []
  );

  const fetchOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const filteredData = allPersona.filter(
          (persona) =>
            persona.displayName?.includes(searchText) ||
            persona.name?.includes(searchText) ||
            persona.description?.includes(searchText)
        );

        return { data: filteredData, paging: { total: filteredData.length } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        if (personaList) {
          return { data: personaList, paging: { total: personaList.length } };
        }
        const { data, paging } = await getAllPersonas({
          limit: PAGE_SIZE_LARGE,
          after: after ?? undefined,
        });
        const filterData = getEntityReferenceListFromEntities(
          data,
          EntityType.PERSONA
        );

        setAllPersona(filterData);

        return { data: filterData, paging };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    }
  };

  const handleUpdate = useCallback(
    (users: EntityReference[]) => {
      if (multiSelect) {
        (onUpdate as (users: EntityReference[]) => void)(users);
      } else {
        (onUpdate as (users: EntityReference) => void)(users[0]);
      }

      setPopupVisible(false);
    },
    [onUpdate]
  );

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <SelectableList
          fetchOptions={fetchOptions}
          multiSelect={multiSelect}
          searchPlaceholder={t('label.search-for-type', {
            type: t('label.persona'),
          })}
          selectedItems={selectedPersonas}
          onCancel={() => setPopupVisible(false)}
          onUpdate={handleUpdate}
        />
      }
      open={popupVisible}
      overlayClassName="user-select-popover p-0"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children ?? (
        <Tooltip
          placement="topRight"
          title={hasPermission ? '' : NO_PERMISSION_FOR_ACTION}>
          <Button
            className="p-0 flex-center"
            data-testid="add-user"
            disabled={!hasPermission}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
            size="small"
            type="text"
          />
        </Tooltip>
      )}
    </Popover>
  );
};
