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

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const SilentAuthCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const processCallback = () => {
      const idToken = searchParams.get('id_token');
      const refreshToken = searchParams.get('refresh_token');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Processing callback in iframe

      if (error) {
        // Error in callback
        // Send error message to parent window
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'auth_refresh_error',
              error: errorDescription || error,
            },
            window.location.origin
          );
        }

        return;
      }

      if (idToken) {
        // Sending tokens to parent window
        // Send tokens to parent window
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'auth_refresh_success',
              accessToken: idToken,
              refreshToken: refreshToken || '',
              email: '',
            },
            window.location.origin
          );
        }
      } else {
        // No token received in callback
        // No token received
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'auth_refresh_error',
              error: 'No token received',
            },
            window.location.origin
          );
        }
      }
    };

    processCallback();
  }, [searchParams]);

  // Return empty div since this is in an iframe
  return <div />;
};

export default SilentAuthCallback;
