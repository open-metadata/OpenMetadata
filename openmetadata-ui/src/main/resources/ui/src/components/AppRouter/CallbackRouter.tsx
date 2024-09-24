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
import { LoginCallback } from '@okta/okta-react';
import React, { useMemo } from 'react';
import { Route, Switch } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { AuthProvider } from '../../generated/configuration/authenticationConfiguration';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import SamlCallback from '../../pages/SamlCallback';
import Auth0Callback from '../Auth/AppCallbacks/Auth0Callback/Auth0Callback';

const CallbackRouter = () => {
  const { authConfig } = useApplicationStore();
  const callbackComponent = useMemo(() => {
    switch (authConfig?.provider) {
      case AuthProvider.Okta: {
        return LoginCallback;
      }
      case AuthProvider.Auth0: {
        return Auth0Callback;
      }
      default: {
        return null;
      }
    }
  }, [authConfig?.provider]);

  return (
    <Switch>
      {callbackComponent && (
        <Route component={callbackComponent} path={ROUTES.CALLBACK} />
      )}
      <Route
        component={SamlCallback}
        path={[ROUTES.SAML_CALLBACK, ROUTES.AUTH_CALLBACK]}
      />
    </Switch>
  );
};

export default CallbackRouter;
