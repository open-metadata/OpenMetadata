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

import { useQuery } from '@tanstack/react-query';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  Access,
  Operation,
} from '../../../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getResourcePermission } from '../../../../rest/permissionAPI';
import { FEED_DELETE_ACCESS_QUERY_KEY } from '../constants/aiCacheKeys.constants';

/**
 * Preflights the current user's evaluated `feed` resource permission
 * (GET /v1/permissions/feed) and returns the raw {@link Access} for Delete.
 *
 * Deliberately bypasses `usePermissionProvider()`: that path collapses Access
 * to `access === Allow`, losing `ConditionalAllow` — the state that lets an
 * author delete their own post under the default `isOwner()` policy rule.
 *
 * Known limitation: the blanket `/permissions/{resource}` endpoint reports
 * `ConditionalAllow` whenever ANY conditional Delete rule matches the
 * resource — it never evaluates the condition itself (OSS
 * `CompiledRule.getAccess()` checks `condition != null` only), and no
 * per-post evaluation endpoint exists. Consumers treating `ConditionalAllow`
 * as author-only are exact for the default OrganizationPolicy `isOwner()`
 * rule and best-effort for deployments with other conditional rules; the
 * backend re-authorizes on the actual delete either way.
 *
 * Returns `undefined` while loading, on failure, or for admins (who bypass
 * policy evaluation server-side, so the fetch is skipped).
 */
export const useFeedDeleteAccess = (enabled: boolean): Access | undefined => {
  const { currentUser } = useApplicationStore();
  const isAdmin = Boolean(currentUser?.isAdmin);

  const { data } = useQuery({
    queryKey: FEED_DELETE_ACCESS_QUERY_KEY,
    queryFn: async () => {
      const resourcePermission = await getResourcePermission(
        ResourceEntity.FEED
      );

      return (
        resourcePermission.permissions?.find(
          (permission) => permission.operation === Operation.Delete
        )?.access ?? Access.NotAllow
      );
    },
    enabled: enabled && !isAdmin,
    retry: false,
    // Resource permissions are session-stable — one GET per session.
    staleTime: Infinity,
  });

  return data;
};
