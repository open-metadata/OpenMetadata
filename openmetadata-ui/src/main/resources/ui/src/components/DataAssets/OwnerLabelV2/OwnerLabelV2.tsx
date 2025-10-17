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
  hasPermission?: boolean;
  fieldType?: 'owners' | 'experts';
}

export const OwnerLabelV2 = <
  T extends {
    owners?: EntityReference[];
    experts?: EntityReference[];
    id: string;
  }
>(
  props: OwnerLabelV2Props
) => {
  const {
    dataTestId = 'glossary-right-panel-owner-link',
    fieldType = 'owners',
  } = props;
  const { data, onUpdate, permissions, isVersionView } = useGenericContext<T>();
  const { t } = useTranslation();

  const isExpertsField = fieldType === 'experts';
  const fieldData = isExpertsField ? data.experts : data.owners;
  const fieldLabel = isExpertsField ? 'expert-plural' : 'owner-plural';
  const tabSpecificField = isExpertsField
    ? TabSpecificField.EXPERTS
    : TabSpecificField.OWNERS;

  const handleUpdatedOwner = async (updatedUser?: EntityReference[]) => {
    const updatedEntity = { ...data };
    if (isExpertsField) {
      updatedEntity.experts = updatedUser;
    } else {
      updatedEntity.owners = updatedUser;
    }
    await onUpdate(updatedEntity);
  };

  const hasPermission = useMemo(() => {
    return (
      props?.hasPermission ?? (permissions?.EditOwners || permissions?.EditAll)
    );
  }, [permissions?.EditOwners, permissions?.EditAll, props?.hasPermission]);

  const header = useMemo(
    () => (
      <div className="d-flex items-center gap-2">
        <Typography.Text className="text-sm font-medium">
          {t(`label.${fieldLabel}`)}
        </Typography.Text>
        {!isVersionView && hasPermission && (
          <UserTeamSelectableList
            hasPermission={hasPermission}
            listHeight={200}
            multiple={{ user: true, team: false }}
            owner={fieldData}
            onUpdate={handleUpdatedOwner}>
            {isEmpty(fieldData) ? (
              <PlusIconButton
                data-testid={`add-${fieldType}`}
                size="small"
                title={t('label.add-entity', {
                  entity: t(`label.${fieldLabel}`),
                })}
              />
            ) : (
              <EditIconButton
                newLook
                data-testid={`edit-${fieldType}`}
                size="small"
                title={t('label.edit-entity', {
                  entity: t(`label.${fieldLabel}`),
                })}
              />
            )}
          </UserTeamSelectableList>
        )}
      </div>
    ),
    [
      data,
      hasPermission,
      handleUpdatedOwner,
      isVersionView,
      fieldType,
      fieldLabel,
      fieldData,
    ]
  );

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId={dataTestId}
      isExpandDisabled={isEmpty(fieldData)}>
      {getOwnerVersionLabel(
        data,
        isVersionView ?? false,
        tabSpecificField,
        hasPermission
      )}
    </ExpandableCard>
  );
};
