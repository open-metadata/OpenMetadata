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

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { AuthProvider } from '../../../generated/configuration/authenticationConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import {
  setOidcToken,
  setRefreshToken,
} from '../../../utils/LocalStorageUtils';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';
import Loader from '../../common/Loader/Loader';
import { useAuthProvider } from '../AuthProviders/AuthProvider';

const UnifiedAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleSuccessfulLogin, handleFailedLogin } = useAuthProvider();
  const { authConfig } = useApplicationStore();
  const [processingError, setProcessingError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Processing callback with authConfig
        const idToken = searchParams.get('id_token');
        const refreshTokenParam = searchParams.get('refresh_token');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        // Processing params: idToken, refreshToken, error

        // Handle error cases
        if (error) {
          const errorMsg = errorDescription || error;

          // Specific error handling based on error codes
          switch (error) {
            case 'INVALID_CREDENTIALS':
              showErrorToast('Invalid email or password. Please try again.');

              break;
            case 'ACCOUNT_LOCKED':
              showErrorToast(
                'Your account has been locked. Please contact an administrator.'
              );

              break;
            case 'SESSION_EXPIRED':
              showInfoToast('Your session has expired. Please login again.');

              break;
            default:
              showErrorToast(errorMsg);
          }

          handleFailedLogin();
          navigate(ROUTES.SIGNIN);

          return;
        }

        // Validate token presence
        if (!idToken) {
          setProcessingError('No authentication token received');
          showErrorToast('Authentication failed: No token received');
          handleFailedLogin();

          // Add small delay before redirect to show error
          setTimeout(() => navigate(ROUTES.SIGNIN), 1000);

          return;
        }

        // Validate token format
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          setProcessingError('Invalid token format');
          showErrorToast('Authentication failed: Invalid token format');
          handleFailedLogin();
          navigate(ROUTES.SIGNIN);

          return;
        }

        // Check token expiry
        const tokenDetails = extractDetailsFromToken(idToken);
        if (tokenDetails.isExpired) {
          setProcessingError('Token has expired');
          showErrorToast('Authentication failed: Token has expired');
          handleFailedLogin();
          navigate(ROUTES.SIGNIN);

          return;
        }

        // Store tokens
        setOidcToken(idToken);
        if (refreshTokenParam) {
          setRefreshToken(refreshTokenParam);
        }

        // Decode token payload
        let decodedToken;
        try {
          decodedToken = JSON.parse(atob(tokenParts[1]));
        } catch (decodeError) {
          // Failed to decode token
          setProcessingError('Failed to decode authentication token');
          showErrorToast('Authentication failed: Invalid token');
          handleFailedLogin();
          navigate(ROUTES.SIGNIN);

          return;
        }

        // Extract user profile based on auth provider
        const userProfile = {
          email: decodedToken.email || decodedToken.sub || '',
          name:
            decodedToken.name ||
            decodedToken.preferred_username ||
            decodedToken.email?.split('@')[0] ||
            '',
          picture: decodedToken.picture || '',
          sub: decodedToken.sub || decodedToken.email || '',
        };

        // Validate required fields
        if (!userProfile.email && !userProfile.sub) {
          setProcessingError('Invalid user information in token');
          showErrorToast('Authentication failed: Invalid user information');
          handleFailedLogin();
          navigate(ROUTES.SIGNIN);

          return;
        }

        // Complete successful login
        handleSuccessfulLogin({
          id_token: idToken,
          profile: userProfile,
          scope: decodedToken.scope || '',
        });

        resetWebAnalyticSession();

        // Navigate to the app
        const redirectPath =
          sessionStorage.getItem('redirectPath') || ROUTES.MY_DATA;
        sessionStorage.removeItem('redirectPath');
        navigate(redirectPath);
      } catch (error) {
        // Unexpected error processing callback
        setProcessingError('An unexpected error occurred');
        showErrorToast('Authentication failed: Unexpected error');
        handleFailedLogin();

        // Add delay to show error before redirect
        setTimeout(() => navigate(ROUTES.SIGNIN), 1500);
      }
    };

    // Only process callback for Basic/LDAP auth
    // Check auth provider type
    if (
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP
    ) {
      // Processing for Basic/LDAP auth
      processCallback();
    } else {
      // For other auth types, this component shouldn't be reached
      // Called for non-Basic/LDAP auth provider or authConfig not loaded yet
      if (!authConfig) {
        // Waiting for authConfig to load

        // Don't navigate away if authConfig is not loaded yet
        return;
      }
      navigate(ROUTES.SIGNIN);
    }
  }, [
    searchParams,
    navigate,
    handleSuccessfulLogin,
    handleFailedLogin,
    authConfig,
  ]);

  // Show error state if processing failed
  if (processingError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}>
        <h2>{processingError}</h2>
        <p>{processingError}</p>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return <Loader fullScreen />;
};

export default UnifiedAuthCallback;
