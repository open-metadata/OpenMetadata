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

import { LoginCallback } from '@okta/okta-react';
import { useEffect } from 'react';
import {
  getAuthErrorCode,
  isInteractionRequiredCode,
} from '../../../../utils/Auth/AuthCoordinator/ReauthRequiredError';
import { useAuthProvider } from '../../AuthProviders/AuthProvider';

// A silent re-authentication (prompt=none) comes back with login_required
// once the Okta session itself has ended; that is a sign-in, not an error
// page. Anything else keeps LoginCallback's default rendering.
export const OktaCallbackError = ({ error }: { error: Error }) => {
  const { handleFailedLogin } = useAuthProvider();
  const isSessionEnded = isInteractionRequiredCode(getAuthErrorCode(error));

  useEffect(() => {
    if (isSessionEnded) {
      handleFailedLogin();
    }
  }, [isSessionEnded]);

  return isSessionEnded ? null : <p>{`${error.name}: ${error.message}`}</p>;
};

const OktaCallback = () => <LoginCallback errorComponent={OktaCallbackError} />;

export default OktaCallback;
