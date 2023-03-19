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
import { SearchIndex } from 'enums/search.enum';
import { OwnerType } from 'enums/user.enum';
import { EntityReference } from 'generated/entity/data/table';
import { User } from 'generated/entity/teams/user';
import { SearchResponse } from 'interface/search.interface';
import { noop } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchData } from 'rest/miscAPI';
import { getUsers } from 'rest/userAPI';
import { formatUsersResponse } from 'utils/APIUtils';
import { getEntityName } from 'utils/EntityUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
import './user-select-dropdown.less';
import { UserSelectDropdownProps } from './UserSelectableList.interface';

export const UserSelectableList = ({
  hasPermission,
  selectedUsers = [],
  onUpdate = noop,
}: UserSelectDropdownProps) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const getFilterUserData = (data: Array<User>) => {
    return data.map((user) => {
      return {
        displayName: getEntityName(user),
        fqn: user.fullyQualifiedName || '',
        id: user.id,
        type: OwnerType.USER,
        name: user.name,
      };
    });
  };

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

        const data = getFilterUserData(
          formatUsersResponse(
            (res.data as SearchResponse<SearchIndex.USER>).hits.hits
          )
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
        const filterData = getFilterUserData(data);

        return { data: filterData, paging };
      } catch (error) {
        console.error(error);

        return { data: [], paging: { total: 0 } };
      }
    }
  };

  const handleUpdate = useCallback(
    (users: EntityReference[]) => {
      onUpdate(users);
      setPopupVisible(false);
    },
    [onUpdate]
  );

  return (
    <Popover
      content={
        <SelectableList
          multiSelect
          fetchOptions={fetchOptions}
          searchPlaceholder={t('label.search-for-type', {
            type: t('label.user'),
          })}
          selectedItems={selectedUsers}
          onCancel={() => setPopupVisible(false)}
          onUpdate={handleUpdate}
        />
      }
      open={popupVisible}
      overlayClassName="user-team-select-popover card-shadow"
      overlayStyle={{ padding: 0 }}
      placement="bottomLeft"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}>
      <Tooltip
        placement="topRight"
        title={hasPermission ? 'Add Reviewer' : NO_PERMISSION_FOR_ACTION}>
        <Button
          className="p-0 flex-center"
          data-testid="add-new-reviewer"
          disabled={!hasPermission}
          icon={
            <SVGIcons alt="edit" icon={Icons.EDIT} title="Edit" width="16px" />
          }
          size="small"
          type="text"
        />
      </Tooltip>
    </Popover>
  );
};
