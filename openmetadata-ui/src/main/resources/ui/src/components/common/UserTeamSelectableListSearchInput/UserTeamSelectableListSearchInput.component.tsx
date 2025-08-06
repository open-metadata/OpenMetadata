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
import { Select } from 'antd';
import { noop } from 'lodash';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EntityReference } from '../../../generated/entity/teams/user';
import { UserTag } from '../UserTag/UserTag.component';
import { UserTagSize } from '../UserTag/UserTag.interface';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import { UserSelectDropdownProps } from '../UserTeamSelectableList/UserTeamSelectableList.interface';
import './user-team-selectable-list-search-input.less';

interface UserTeamSelectableListSearchProps extends UserSelectDropdownProps {
  disabled?: boolean;
}

const UserTeamSelectableListSearchInput: React.FC<UserTeamSelectableListSearchProps> =
  ({
    disabled,
    hasPermission,
    owner,
    onUpdate = noop,
    onClose,
    multiple,
    label,
    previewSelected = false,
    listHeight,
    tooltipText,
  }) => {
    const [popoverVisible, setPopoverVisible] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<EntityReference[]>([]);

    const handleFocus = useCallback(() => {
      setPopoverVisible(true);
    }, []);

    const handleClose = () => {
      setPopoverVisible(false);
      if (onClose) {
        onClose();
      }
    };

    const handlePopoverVisibleChange = (visible: boolean) => {
      setPopoverVisible(visible);
      if (!visible && onClose) {
        onClose();
      }
    };

    const handleUpdate = async (updatedUser?: EntityReference[]) => {
      if (onUpdate) {
        setSelectedUsers(updatedUser ?? []);
        handleClose();
        onUpdate(updatedUser);
      }
    };

    const handleOnChangeSelect = (value: string[]) => {
      if (onUpdate) {
        const updatedUser = selectedUsers.filter((item) =>
          value.includes(item.name ?? '')
        );

        setSelectedUsers(updatedUser ?? []);
        handleClose();
        onUpdate(updatedUser);
      }
    };

    const selectedValues = useMemo(
      () =>
        selectedUsers
          .map((user) => user.name)
          .filter((name): name is string => Boolean(name)),
      [selectedUsers]
    );

    const customTagRender = (props: CustomTagProps) => {
      const { value, closable, onClose } = props;

      const selectedAssignee = selectedUsers?.find(
        (option) => option.name === value
      );

      const tagProps = {
        id: selectedAssignee?.name ?? value,
        name: selectedAssignee?.name ?? value,
        closable: closable,
        onRemove: onClose,
        size: UserTagSize.small,
        isTeam: selectedAssignee?.type === 'team',
        className: 'assignee-tag',
      };

      return <UserTag {...tagProps} />;
    };

    useEffect(() => {
      setSelectedUsers(owner ?? []);
    }, [owner]);

    return (
      <UserTeamSelectableList
        hasPermission={hasPermission}
        label={label}
        listHeight={listHeight}
        multiple={multiple}
        overlayClassName="user-team-selectable-list-search-input-popover"
        owner={selectedUsers}
        popoverProps={{
          open: popoverVisible,
          onOpenChange: handlePopoverVisibleChange,
          trigger: 'click',
          placement: 'bottomLeft',
        }}
        previewSelected={previewSelected}
        tooltipText={tooltipText}
        onClose={handleClose}
        onUpdate={handleUpdate}>
        <Select
          showSearch
          className="ant-select-custom select-owners"
          data-testid="select-owners"
          defaultActiveFirstOption={false}
          disabled={disabled}
          filterOption={false}
          mode="multiple"
          notFoundContent={null}
          suffixIcon={null}
          tagRender={customTagRender}
          value={selectedValues}
          onChange={handleOnChangeSelect}
          onFocus={handleFocus}
        />
      </UserTeamSelectableList>
    );
  };

export default UserTeamSelectableListSearchInput;
