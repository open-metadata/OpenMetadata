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
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { REDIRECT_PATHNAME } from '../../constants/router.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import { setUrlPathnameExpiryAfterRoute } from '../../utils/AuthProvider.util';
import {
  getOperationPermissions,
  getUIPermission,
} from '../../utils/PermissionsUtils';
import {
  EntityPermissionMap,
  PermissionContextType,
  PermissionProviderProps,
  ResourceEntity,
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
  const cookieStorage = new CookieStorage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [entitiesPermission, setEntitiesPermission] =
    useState<EntityPermissionMap>({} as EntityPermissionMap);

  const [resourcesPermission, setResourcesPermission] = useState<UIPermission>(
    {} as UIPermission
  );

  /*
   * Inflight-Promise caches. The settled values live in React state
   * ({@code entitiesPermission} / {@code resourcesPermission}) so renders
   * re-evaluate when permissions resolve, but state writes are deferred to
   * the next render — meaning two components calling
   * {@code getEntityPermissionByFqn(table, fqn)} on the SAME mount commit
   * both see {@code entitiesPermission[fqn]} as undefined and both fire the
   * network call. With these refs, the second caller picks up the Promise
   * the first caller stored synchronously and {@code await}s the same
   * response — one network round-trip instead of N.
   *
   * Keyed by entityId / entityFqn / ResourceEntity — same keys the React
   * state uses. Entries are cleared in the Promise's then/catch so a
   * subsequent call after settlement reads from React state (fast path)
   * and doesn't keep the Promise hanging around forever.
   */
  const entityPermissionByIdInflight = useRef<
    Map<string, Promise<ReturnType<typeof getOperationPermissions>>>
  >(new Map());
  const entityPermissionByFqnInflight = useRef<
    Map<string, Promise<ReturnType<typeof getOperationPermissions>>>
  >(new Map());
  const resourcePermissionInflight = useRef<
    Map<ResourceEntity, Promise<ReturnType<typeof getOperationPermissions>>>
  >(new Map());

  const redirectToStoredPath = useCallback(() => {
    const urlPathname = cookieStorage.getItem(REDIRECT_PATHNAME);
    if (urlPathname) {
      setUrlPathnameExpiryAfterRoute(urlPathname);
      navigate(urlPathname);
    }
  }, [history]);

  /**
   * Fetch permission for logged in user
   */
  const fetchLoggedInUserPermissions = useCallback(async () => {
    try {
      const response = await getLoggedInUserPermissions();
      setPermissions(getUIPermission(response.data || []));
      redirectToStoredPath();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [redirectToStoredPath]);

  const fetchEntityPermission = useCallback(
    async (resource: ResourceEntity, entityId: string) => {
      const entityPermission = entitiesPermission[entityId];
      if (entityPermission) {
        return entityPermission;
      }
      const inflight = entityPermissionByIdInflight.current.get(entityId);
      if (inflight) {
        return inflight;
      }
      const promise = getEntityPermissionById(resource, entityId)
        .then((response) => {
          const operationPermission = getOperationPermissions(response);
          setEntitiesPermission((prev) => ({
            ...prev,
            [entityId]: operationPermission,
          }));
          entityPermissionByIdInflight.current.delete(entityId);

          return operationPermission;
        })
        .catch((err) => {
          entityPermissionByIdInflight.current.delete(entityId);

          throw err;
        });
      entityPermissionByIdInflight.current.set(entityId, promise);

      return promise;
    },
    [entitiesPermission, setEntitiesPermission]
  );

  const fetchEntityPermissionByFqn = useCallback(
    async (resource: ResourceEntity, entityFqn: string) => {
      const entityPermission = entitiesPermission[entityFqn];
      if (entityPermission) {
        return entityPermission;
      }
      const inflight = entityPermissionByFqnInflight.current.get(entityFqn);
      if (inflight) {
        return inflight;
      }
      const promise = getEntityPermissionByFqn(resource, entityFqn)
        .then((response) => {
          const operationPermission = getOperationPermissions(response);
          setEntitiesPermission((prev) => ({
            ...prev,
            [entityFqn]: operationPermission,
          }));
          entityPermissionByFqnInflight.current.delete(entityFqn);

          return operationPermission;
        })
        .catch((err) => {
          entityPermissionByFqnInflight.current.delete(entityFqn);

          throw err;
        });
      entityPermissionByFqnInflight.current.set(entityFqn, promise);

      return promise;
    },
    [entitiesPermission, setEntitiesPermission]
  );

  const fetchResourcePermission = useCallback(
    async (resource: ResourceEntity) => {
      const resourcePermission = resourcesPermission[resource];
      if (resourcePermission) {
        return resourcePermission;
      }
      const inflight = resourcePermissionInflight.current.get(resource);
      if (inflight) {
        return inflight;
      }
      const promise = getResourcePermission(resource)
        .then((response) => {
          const operationPermission = getOperationPermissions(response);
          setResourcesPermission((prev) => ({
            ...prev,
            [resource]: operationPermission,
          }));
          resourcePermissionInflight.current.delete(resource);

          return operationPermission;
        })
        .catch((err) => {
          resourcePermissionInflight.current.delete(resource);

          throw err;
        });
      resourcePermissionInflight.current.set(resource, promise);

      return promise;
    },
    [resourcesPermission, setResourcesPermission]
  );

  const resetPermissions = useCallback(() => {
    setEntitiesPermission({} as EntityPermissionMap);
    setPermissions({} as UIPermission);
    setResourcesPermission({} as UIPermission);
    // Drop any unresolved Promises too — after a logout/login boundary the
    // old principal's inflight calls would resolve into a cache that another
    // user can read, which is wrong. Clearing the refs here ensures the
    // next caller fires a fresh request scoped to the new session.
    entityPermissionByIdInflight.current.clear();
    entityPermissionByFqnInflight.current.clear();
    resourcePermissionInflight.current.clear();
  }, [setEntitiesPermission, setPermissions, setResourcesPermission]);

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
