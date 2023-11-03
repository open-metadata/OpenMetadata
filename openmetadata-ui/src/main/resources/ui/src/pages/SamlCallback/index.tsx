/*
 *  Copyright 2023 Collate.
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

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Redirect, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../components/authentication/auth-provider/AuthProvider';
import { OidcUser } from '../../components/authentication/auth-provider/AuthProvider.interface';
import { oidcTokenKey, ROUTES } from '../../constants/constants';

const SamlCallback = () => {
  const { handleSuccessfulLogin } = useAuthContext();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    // get #id_token from hash params in the URL
    const params = new URLSearchParams(location.search);
    const idToken = params.get('id_token');
    const name = params.get('name');
    const email = params.get('email');
    if (idToken) {
      localStorage.setItem(oidcTokenKey, idToken);
      const oidcUser: OidcUser = {
        id_token: idToken,
        scope: '',
        profile: {
          email: email || '',
          name: name || '',
          picture: '',
          locale: '',
          sub: '',
        },
      };
      handleSuccessfulLogin(oidcUser);
    }
  }, [location]);

  return (
    <>
      <div data-testid="redirect-message">{t('message.redirect-message')}</div>
      <Redirect to={ROUTES.HOME} />
    </>
  );
};

export default SamlCallback;
