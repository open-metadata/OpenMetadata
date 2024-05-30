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
import { Button, Popover, Tooltip } from 'antd';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { searchData } from '../../../rest/miscAPI';

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SelectableList } from '../SelectableList/SelectableList.component';
// import './user-select-dropdown.less';
import { EntityType } from '../../../enums/entity.enum';
import { getEntityName } from '../../../utils/EntityUtils';
import { getUserTeamEntityRefListFromSourceData } from '../../../utils/UserDataUtils';
import { UserTag } from '../UserTag/UserTag.component';
import { TeamListItemRenderer } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import { UserTeamSelectableListV1Props } from './UserTeamSelectableListV1.interface';

export const UserTeamListItemRenderer = (props: EntityReference) => {
  if (props.type === EntityType.TEAM) {
    return TeamListItemRenderer(props);
  } else {
    return <UserTag id={props.name ?? ''} name={getEntityName(props)} />;
  }
};

export const UserTeamSelectableListV1 = ({
  hasPermission,
  selectedUsers = [],
  onUpdate,
  children,
  popoverProps,
  multiSelect = true,
  filterCurrentUser = false,
}: UserTeamSelectableListV1Props) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const fetchOptions = async (searchText: string) => {
    try {
      const res = await searchData(
        searchText,
        1,
        PAGE_SIZE_MEDIUM,
        'isBot:false',
        '',
        '',
        [SearchIndex.USER, SearchIndex.TEAM]
      );

      const data = getUserTeamEntityRefListFromSourceData(res.data.hits.hits);

      if (filterCurrentUser) {
        const user = data.find((user) => user.id === currentUser?.id);
        if (user) {
          data.splice(data.indexOf(user), 1);
        }
      }

      return { data, paging: { total: res.data.hits.total.value } };
    } catch (error) {
      return { data: [], paging: { total: 0 } };
    }
  };

  const handleUpdate = useCallback(
    async (users: EntityReference[]) => {
      if (multiSelect) {
        await (onUpdate as (users: EntityReference[]) => Promise<void>)(users);
      } else {
        await (onUpdate as (users: EntityReference) => Promise<void>)(users[0]);
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
          customTagRenderer={UserTeamListItemRenderer}
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
      overlayClassName="user-select-popover user-select-kh p-0"
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
