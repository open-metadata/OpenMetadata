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
import { ResourceEntity } from '../../../enums/permissions.enum';
import { User } from '../../../generated/entity/teams/user';
import { useEntityPermissions } from '../../useEntityPermissions/useEntityPermissions';

export const useUserCustomPropertyAccess = (user?: User) => {
  const { canViewCustomFields, canEditCustomFields, isLoading } =
    useEntityPermissions(ResourceEntity.USER, user?.name ?? '', {
      deleted: user?.deleted,
      enabled: Boolean(user?.name),
    });

  return {
    canView: canViewCustomFields,
    canEdit: canEditCustomFields,
    isLoading: Boolean(user?.name) && isLoading,
  };
};
