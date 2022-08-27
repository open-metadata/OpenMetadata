/*
 *  Copyright 2021 Collate
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

import { AxiosError } from 'axios';
import { observer } from 'mobx-react';
import React, {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AppState from '../../AppState';
import { getLoggedInUserPermissions } from '../../axiosAPIs/miscAPI';
import { getUIPermission } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { UIPermission } from './PermissionProvider.interface';

/**
 * Permission Context
 * Returns ResourcePermission List for loggedIn User
 * @returns PermissionMap
 */
export const PermissionContext = createContext<{
  permissions: UIPermission;
}>({ permissions: {} as UIPermission });

interface PermissionProviderProps {
  children: ReactNode;
}

/**
 *
 * @param children:ReactNode
 * @returns JSX
 */
const PermissionProvider: FC<PermissionProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<UIPermission>(
    {} as UIPermission
  );

  // Update current user details of AppState change
  const currentUser = useMemo(() => {
    return AppState.getCurrentUserDetails();
  }, [AppState.userDetails, AppState.nonSecureUserDetails]);

  /**
   * Fetch permission for logged in user
   */
  const fetchLoggedInUserPermissions = async () => {
    try {
      const response = await getLoggedInUserPermissions();
      setPermissions(getUIPermission(response.data || []));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    /**
     * Only fetch permission if user is logged In
     */
    if (currentUser && currentUser.id) {
      fetchLoggedInUserPermissions();
    }
  }, [currentUser]);

  return (
    <PermissionContext.Provider value={{ permissions }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissionProvider = () => useContext(PermissionContext);

export default observer(PermissionProvider);
