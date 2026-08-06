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
/**
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
import { isEmpty } from 'lodash';
import { lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';

const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../../common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((m) => ({ default: m.UserTeamSelectableList }))
  ),
  null
);
interface OwnerLabelV2Props {
  dataTestId?: string;
  hasPermission?: boolean;
}

export const OwnerLabelV2 = <
  T extends { owners?: EntityReference[]; id: string }
>(
  props: OwnerLabelV2Props
) => {
  const { dataTestId = 'glossary-right-panel-owner-link' } = props;
  const { data, onUpdate, permissions, isVersionView, entityRules } =
    useGenericContext<T>();
  const { t } = useTranslation();
  const handleUpdatedOwner = async (updatedUser?: EntityReference[]) => {
    const updatedEntity = { ...data };
    updatedEntity.owners = updatedUser;
    await onUpdate(updatedEntity);
  };

  const hasPermission = useMemo(() => {
    return (
      props?.hasPermission ?? (permissions?.EditOwners || permissions?.EditAll)
    );
  }, [permissions?.EditOwners, permissions?.EditAll, props?.hasPermission]);
  const headerExtra = useMemo(
    () =>
      !isVersionView && hasPermission ? (
        <UserTeamSelectableList
          hasPermission={hasPermission}
          listHeight={200}
          multiple={{
            user: entityRules.canAddMultipleUserOwners,
            team: entityRules.canAddMultipleTeamOwner,
          }}
          owner={data.owners}
          onUpdate={handleUpdatedOwner}>
          {isEmpty(data.owners) ? (
            <WidgetPlusButton
              data-testid="add-owner"
              title={t('label.add-entity', { entity: t('label.owner-plural') })}
            />
          ) : (
            <WidgetEditButton
              data-testid="edit-owner"
              title={t('label.edit-entity', {
                entity: t('label.owner-plural'),
              })}
            />
          )}
        </UserTeamSelectableList>
      ) : null,
    [data, hasPermission, handleUpdatedOwner, isVersionView, entityRules]
  );

  return (
    <WidgetCard
      dataTestId={dataTestId}
      headerExtra={headerExtra}
      isExpandDisabled={isEmpty(data.owners)}
      title={t('label.owner-plural')}>
      {getOwnerVersionLabel(
        data,
        isVersionView ?? false,
        TabSpecificField.OWNERS,
        hasPermission
      )}
    </WidgetCard>
  );
};
