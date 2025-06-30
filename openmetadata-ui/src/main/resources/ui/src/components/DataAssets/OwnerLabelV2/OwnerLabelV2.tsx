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
import { Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../common/IconButtons/EditIconButton';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';

interface OwnerLabelV2Props {
  dataTestId?: string;
}

export const OwnerLabelV2 = <
  T extends { owners?: EntityReference[]; id: string }
>(
  props: OwnerLabelV2Props
) => {
  const { dataTestId = 'glossary-right-panel-owner-link' } = props;
  const { data, onUpdate, permissions, isVersionView } = useGenericContext<T>();
  const { t } = useTranslation();
  const handleUpdatedOwner = async (updatedUser?: EntityReference[]) => {
    const updatedEntity = { ...data };
    updatedEntity.owners = updatedUser;
    await onUpdate(updatedEntity);
  };

  const header = useMemo(
    () => (
      <div className="d-flex items-center gap-2">
        <Typography.Text className="text-sm font-medium">
          {t('label.owner-plural')}
        </Typography.Text>
        {!isVersionView && (permissions.EditOwners || permissions.EditAll) && (
          <UserTeamSelectableList
            hasPermission={permissions.EditOwners || permissions.EditAll}
            listHeight={200}
            multiple={{ user: true, team: false }}
            owner={data.owners}
            onUpdate={handleUpdatedOwner}>
            {isEmpty(data.owners) ? (
              <PlusIconButton
                data-testid="add-owner"
                size="small"
                title={t('label.add-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            ) : (
              <EditIconButton
                newLook
                data-testid="edit-owner"
                size="small"
                title={t('label.edit-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            )}
          </UserTeamSelectableList>
        )}
      </div>
    ),
    [data, permissions, handleUpdatedOwner, isVersionView]
  );

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId={dataTestId}
      isExpandDisabled={isEmpty(data.owners)}>
      {getOwnerVersionLabel(
        data,
        isVersionView ?? false,
        TabSpecificField.OWNERS,
        permissions.EditOwners || permissions.EditAll
      )}
    </ExpandableCard>
  );
};
