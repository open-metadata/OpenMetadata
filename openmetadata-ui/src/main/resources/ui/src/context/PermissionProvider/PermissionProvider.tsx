/*
 *  Copyright 2022 Collate.
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

import { CookieStorage } from 'cookie-storage';
import { isEmpty } from 'lodash';
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { REDIRECT_PATHNAME } from '../../constants/router.constants';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  permissionQueryKeys,
  PERMISSION_STALE_TIME,
} from '../../hooks/useEntityPermissions/permissionQueryKeys';
import { queryClient } from '../../queryClient';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import { setUrlPathnameExpiryAfterRoute } from '../../utils/AuthProvider.util';
import { PERMISSION_POLICY } from '../../utils/permissionPolicy';
import {
  getOperationPermissions,
  getUIPermission,
} from '../../utils/PermissionsUtils';
import {
  PermissionContextType,
  PermissionProviderProps,
  UIPermission,
} from './PermissionProvider.interface';

/**
 * Permission Context
 * Returns ResourcePermission List for loggedIn User
 * @returns PermissionMap
 */
export const PermissionContext = createContext<PermissionContextType>(
  {} as PermissionContextType
);

// Single seam for the resource-level conditional-access policy (see
// permissionPolicy.ts for the full rationale and blast radius). Permits a
// resource-level conditionalAllow/conditionalDeny only for the View-class
// operations the policy allow-lists (the fix for OpenMetadata#31783, #33834
// and #33356) — every other operation stays denied, matching entity-level
// gating byte-for-byte.
const RESOURCE_ALLOW_CONDITIONAL = (operation: Operation): boolean =>
  PERMISSION_POLICY.resourceLevelConditionalOperations.has(operation);

/**
 *
 * @param children:ReactNode
 * @returns JSX
 */
const PermissionProvider: FC<PermissionProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<UIPermission>(
    {} as UIPermission
  );
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const redirectToStoredPath = useCallback(() => {
    const urlPathname = new CookieStorage().getItem(REDIRECT_PATHNAME);
    if (urlPathname) {
      setUrlPathnameExpiryAfterRoute(urlPathname);
      if (urlPathname !== window.location.pathname) {
        navigate(urlPathname);
      }
    }
    // `navigate` is the actual dependency this callback reads (the router's
    // navigate function) — `history` was never declared in this file and
    // wasn't the global `window.history` either; it was a stale reference
    // left over from the pre-react-router-v6 API.
  }, [navigate]);

  /**
   * Fetch permission for logged in user
   */
  const fetchLoggedInUserPermissions = useCallback(async () => {
    try {
      const response = await getLoggedInUserPermissions();
      // Fix for OpenMetadata#31783/#33834/#33356: a resource-level conditionalAllow or
      // conditionalDeny counts as permitted only for the View-class
      // operations allow-listed in permissionPolicy.ts — see
      // RESOURCE_ALLOW_CONDITIONAL above.
      setPermissions(
        getUIPermission(response.data || [], RESOURCE_ALLOW_CONDITIONAL)
      );
      redirectToStoredPath();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [redirectToStoredPath]);

  /**
   * All three fetchers are backed by the singleton {@code queryClient} under
   * {@code permissionQueryKeys} — the SAME cache and key namespace
   * {@code useEntityPermissions}/{@code useBulkEntityPermissions} use.
   * {@code fetchQuery} returns cached-fresh data without a request, dedupes
   * concurrent identical calls, and respects {@code PERMISSION_STALE_TIME} —
   * everything the old hand-rolled state maps + inflight-Promise refs did,
   * plus cross-cache invalidation (#27591).
   */
  const fetchEntityPermission = useCallback(
    (resource: ResourceEntity, entityId: string) =>
      queryClient.fetchQuery({
        queryKey: permissionQueryKeys.entityById(resource, entityId),
        queryFn: async () =>
          getOperationPermissions(
            await getEntityPermissionById(resource, entityId)
          ),
        staleTime: PERMISSION_STALE_TIME,
      }),
    []
  );

  const fetchEntityPermissionByFqn = useCallback(
    (resource: ResourceEntity, entityFqn: string) =>
      queryClient.fetchQuery({
        queryKey: permissionQueryKeys.entity(resource, entityFqn),
        queryFn: async () =>
          getOperationPermissions(
            await getEntityPermissionByFqn(resource, entityFqn)
          ),
        staleTime: PERMISSION_STALE_TIME,
      }),
    []
  );

  const fetchResourcePermission = useCallback(
    (resource: ResourceEntity) =>
      queryClient.fetchQuery({
        queryKey: permissionQueryKeys.resource(resource),
        queryFn: async () =>
          // Fix for OpenMetadata#31783/#33834/#33356 — see RESOURCE_ALLOW_CONDITIONAL above.
          getOperationPermissions(
            await getResourcePermission(resource),
            RESOURCE_ALLOW_CONDITIONAL
          ),
        staleTime: PERMISSION_STALE_TIME,
      }),
    []
  );

  const resetPermissions = useCallback(() => {
    setPermissions({} as UIPermission);
    // Drop every cached permission (entity, entityById, resource) too —
    // after a logout/login boundary the old principal's cached values would
    // otherwise resolve into a cache the new user can read, which is wrong.
    // This reaches BOTH the legacy provider path and the hook path since
    // they share the same queryClient + key namespace.
    queryClient.removeQueries({ queryKey: permissionQueryKeys.all });
  }, [setPermissions]);

  useEffect(() => {
    /**
     * Only fetch permissions if current user is present
     */
    if (!isEmpty(currentUser)) {
      fetchLoggedInUserPermissions();
    } else {
      setLoading(false);
    }
    if (isEmpty(currentUser)) {
      resetPermissions();
    }
  }, [currentUser?.teams, currentUser?.roles]);

  const contextValues = useMemo(
    () => ({
      permissions,
      getEntityPermission: fetchEntityPermission,
      getResourcePermission: fetchResourcePermission,
      getEntityPermissionByFqn: fetchEntityPermissionByFqn,
    }),
    [
      permissions,
      fetchEntityPermission,
      fetchResourcePermission,
      fetchEntityPermissionByFqn,
    ]
  );

  return (
    <PermissionContext.Provider value={contextValues}>
      {loading ? <Loader fullScreen /> : children}
    </PermissionContext.Provider>
  );
};

export const usePermissionProvider = () => useContext(PermissionContext);

export default PermissionProvider;
