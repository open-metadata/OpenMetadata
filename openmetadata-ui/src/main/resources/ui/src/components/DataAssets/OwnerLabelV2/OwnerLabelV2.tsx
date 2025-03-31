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
import { Button, Card, Space, Tooltip, Typography } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import TagButton from '../../common/TagButton/TagButton.component';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';

export const OwnerLabelV2 = <
  T extends { owners?: EntityReference[]; id: string }
>() => {
  const { data, onUpdate, permissions, isVersionView } = useGenericContext<T>();

  const handleUpdatedOwner = async (updatedUser?: EntityReference[]) => {
    const updatedEntity = { ...data };
    updatedEntity.owners = updatedUser;
    await onUpdate(updatedEntity);
  };

  return (
    <Card
      className="new-header-border-card"
      data-testid="glossary-right-panel-owner-link"
      title={
        <div className="d-flex items-center ">
          <Typography.Text className="text-sm font-medium">
            {t('label.owner-plural')}
          </Typography.Text>
          {(permissions.EditOwners || permissions.EditAll) &&
            data.owners &&
            data.owners.length > 0 && (
              <UserTeamSelectableList
                hasPermission={permissions.EditOwners || permissions.EditAll}
                listHeight={200}
                multiple={{ user: true, team: false }}
                owner={data.owners}
                onUpdate={handleUpdatedOwner}>
                <Tooltip
                  title={t('label.edit-entity', {
                    entity: t('label.owner-plural'),
                  })}>
                  <Button
                    className="cursor-pointer flex-center m-l-xss"
                    data-testid="edit-owner"
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
                  />
                </Tooltip>
              </UserTeamSelectableList>
            )}
        </div>
      }>
      <Space className="m-r-xss" size={4}>
        {getOwnerVersionLabel(
          data,
          isVersionView ?? false,
          TabSpecificField.OWNERS,
          permissions.EditOwners || permissions.EditAll
        )}
      </Space>
      {data.owners?.length === 0 &&
        (permissions.EditOwners || permissions.EditAll) && (
          <UserTeamSelectableList
            hasPermission={permissions.EditOwners || permissions.EditAll}
            listHeight={200}
            multiple={{ user: true, team: false }}
            owner={data.owners}
            onUpdate={(updatedUser) => handleUpdatedOwner(updatedUser)}>
            <TagButton
              className="text-primary cursor-pointer"
              dataTestId="add-owner"
              icon={<PlusIcon height={16} name="plus" width={16} />}
              label={t('label.add')}
              tooltip=""
            />
          </UserTeamSelectableList>
        )}
    </Card>
  );
};
