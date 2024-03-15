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
import Qs from 'qs';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import localState from '../../../../utils/LocalStorageUtils';
import Loader from '../../../common/Loader/Loader';
import { useAuthContext } from '../../AuthProviders/AuthProvider';
import { OidcUser } from '../../AuthProviders/AuthProvider.interface';

export const ConfidentialCallback = () => {
  const location = useLocation();
  const { setIsAuthenticated, handleSuccessfulLogin, handleFailedLogin } =
    useAuthContext();

  useEffect(() => {
    const params = Qs.parse(location.search.split('?')[1]);

    if (params.id_token) {
      const user = {
        id_token: params.id_token as string,
        profile: {
          name: params.name,
          email: params.email,
        },
        scope: params.scope,
      };
      localState.setOidcToken(user.id_token);
      setIsAuthenticated(true);
      handleSuccessfulLogin(user as OidcUser);
    } else {
      handleFailedLogin();
    }
  }, []);

  return <Loader fullScreen />;
};
