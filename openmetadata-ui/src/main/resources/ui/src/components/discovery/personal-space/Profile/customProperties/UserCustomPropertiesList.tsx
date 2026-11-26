/*
 *  Copyright 2026 Collate.
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
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { useUserCustomPropertyAccess } from '../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess';
import CustomPropertiesList from './CustomPropertiesList';
import { UserCustomPropertiesProps } from './UserCustomProperties.types';

/** The user detail's Custom Properties tab: the shared list, gated on the user's own access rules. */
const UserCustomPropertiesList = ({
  user,
  onUpdate,
  isProfileLoading,
}: UserCustomPropertiesProps) => {
  const { t } = useTranslation();
  const access = useUserCustomPropertyAccess(user);
  const saveExtension = useCallback(
    (extension: Record<string, unknown> | undefined) =>
      onUpdate({ extension }, 'extension'),
    [onUpdate]
  );

  return (
    <CustomPropertiesList
      canEdit={access.canEdit}
      canView={access.canView}
      emptyDescription={t('message.define-user-custom-properties-hint')}
      emptyTitle={t('message.no-custom-properties-for-users')}
      entityType={EntityType.USER}
      extension={user.extension as Record<string, unknown> | undefined}
      isLoading={access.isLoading || isProfileLoading}
      onUpdate={saveExtension}
    />
  );
};

export default UserCustomPropertiesList;
