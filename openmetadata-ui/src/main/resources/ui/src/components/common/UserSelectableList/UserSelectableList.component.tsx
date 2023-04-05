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
import { PAGE_SIZE_MEDIUM } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { EntityReference } from 'generated/entity/data/table';
import { noop } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchData } from 'rest/miscAPI';
import { getUsers } from 'rest/userAPI';
import { formatUsersResponse } from 'utils/APIUtils';
import { getEntityReferenceListFromEntities } from 'utils/EntityUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
import './user-select-dropdown.less';
import { UserSelectableListProps } from './UserSelectableList.interface';

export const UserSelectableList = ({
  hasPermission,
  selectedUsers = [],
  onUpdate = noop,
  children,
  popoverProps,
  multiSelect = true,
}: UserSelectableListProps) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();

  const fetchOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const res = await searchData(
          searchText,
          1,
          PAGE_SIZE_MEDIUM,
          '',
          '',
          '',
          SearchIndex.USER
        );

        const data = getEntityReferenceListFromEntities(
          formatUsersResponse(res.data.hits.hits),
          EntityType.USER
        );

        return { data, paging: { total: res.data.hits.total.value } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        const { data, paging } = await getUsers(
          '',
          PAGE_SIZE_MEDIUM,
          after
            ? {
                after,
              }
            : undefined
        );
        const filterData = getEntityReferenceListFromEntities(
          data,
          EntityType.USER
        );

        return { data: filterData, paging };
      } catch (error) {
        console.error(error);

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
            type: t('label.user'),
          })}
          selectedItems={selectedUsers}
          onCancel={() => setPopupVisible(false)}
          onUpdate={handleUpdate}
        />
      }
      open={popupVisible}
      overlayClassName="user-select-popover card-shadow"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children ? (
        children
      ) : (
        <Tooltip
          placement="topRight"
          title={hasPermission ? '' : NO_PERMISSION_FOR_ACTION}>
          <Button
            className="p-0 flex-center"
            data-testid="add-user"
            disabled={!hasPermission}
            icon={
              <SVGIcons
                alt="edit"
                icon={Icons.EDIT}
                title="Edit"
                width="16px"
              />
            }
            size="small"
            type="text"
          />
        </Tooltip>
      )}
    </Popover>
  );
};
