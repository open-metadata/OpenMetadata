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
import { REDIRECT_PATHNAME } from '../../constants/constants';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import {
  getOperationPermissions,
  getUIPermission,
} from '../../utils/PermissionsUtils';

import { useApplicationStore } from '../../hooks/useApplicationStore';
import { setUrlPathnameExpiryAfterRoute } from '../../utils/AuthProvider.util';
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
      } else {
        const response = await getEntityPermissionById(resource, entityId);
        const operationPermission = getOperationPermissions(response);
        setEntitiesPermission((prev) => ({
          ...prev,
          [entityId]: operationPermission,
        }));

        return operationPermission;
      }
    },
    [entitiesPermission, setEntitiesPermission]
  );

  const fetchEntityPermissionByFqn = useCallback(
    async (resource: ResourceEntity, entityFqn: string) => {
      const entityPermission = entitiesPermission[entityFqn];
      if (entityPermission) {
        return entityPermission;
      } else {
        const response = await getEntityPermissionByFqn(resource, entityFqn);
        const operationPermission = getOperationPermissions(response);
        setEntitiesPermission((prev) => ({
          ...prev,
          [entityFqn]: operationPermission,
        }));

        return operationPermission;
      }
    },
    [entitiesPermission, setEntitiesPermission]
  );

  const fetchResourcePermission = useCallback(
    async (resource: ResourceEntity) => {
      const resourcePermission = resourcesPermission[resource];
      if (resourcePermission) {
        return resourcePermission;
      } else {
        const response = await getResourcePermission(resource);
        const operationPermission = getOperationPermissions(response);
        /**
         * Store resource permission if it's not exits
         */
        setResourcesPermission((prev) => ({
          ...prev,
          [resource]: operationPermission,
        }));

        return operationPermission;
      }
    },
    [resourcesPermission, setResourcesPermission]
  );

  const resetPermissions = useCallback(() => {
    setEntitiesPermission({} as EntityPermissionMap);
    setPermissions({} as UIPermission);
    setResourcesPermission({} as UIPermission);
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
