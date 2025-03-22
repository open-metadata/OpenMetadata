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

import React, { useEffect } from 'react';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import TokenService from '../../utils/Auth/TokenService/TokenServiceUtil';
import {
  extractDetailsFromToken,
  isProtectedRoute,
  isTourRoute,
} from '../../utils/AuthProvider.util';
import { getOidcToken } from '../../utils/LocalStorageUtils';
import NavBar from '../NavBar/NavBar';
import './app-bar.style.less';

const Appbar: React.FC = (): JSX.Element => {
  const location = useCustomLocation();

  const { isAuthenticated } = useApplicationStore();

  useEffect(() => {
    const handleDocumentVisibilityChange = () => {
      if (
        isProtectedRoute(location.pathname) &&
        isTourRoute(location.pathname)
      ) {
        return;
      }
      const { isExpired } = extractDetailsFromToken(getOidcToken());
      if (!document.hidden && isExpired) {
        // force logout
        TokenService.getInstance().refreshToken();
      }
    };

    addEventListener('focus', handleDocumentVisibilityChange);

    return () => {
      removeEventListener('focus', handleDocumentVisibilityChange);
    };
  }, []);

  return (
    <>
      {isProtectedRoute(location.pathname) && isAuthenticated ? (
        <NavBar />
      ) : null}
    </>
  );
};

export default Appbar;
