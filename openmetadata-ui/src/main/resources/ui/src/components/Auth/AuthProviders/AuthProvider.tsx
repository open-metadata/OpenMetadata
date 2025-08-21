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

import { removeSession } from '@analytics/session-utils';
import { Auth0Provider } from '@auth0/auth0-react';

import {
  Configuration,
  IPublicClientApplication,
  PublicClientApplication,
} from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import {
  AxiosError,
  AxiosRequestHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import { CookieStorage } from 'cookie-storage';
import { isEmpty, isNil, isNumber } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import Qs from 'qs';
import {
  ComponentType,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UN_AUTHORIZED_EXCLUDED_PATHS } from '../../../constants/Auth.constants';
import {
  DEFAULT_DOMAIN_VALUE,
  ES_MAX_PAGE_SIZE,
  REDIRECT_PATHNAME,
  ROUTES,
} from '../../../constants/constants';
import { ClientErrors } from '../../../enums/Axios.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  AuthenticationConfiguration,
  ClientType,
} from '../../../generated/configuration/authenticationConfiguration';
import { User } from '../../../generated/entity/teams/user';
import { AuthProvider as AuthProviderEnum } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../../hooks/useDomainStore';
import axiosClient from '../../../rest';
import { getDomainList } from '../../../rest/domainAPI';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import { getLoggedInUser } from '../../../rest/userAPI';
import applicationRoutesClass from '../../../utils/ApplicationRoutesClassBase';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import {
  extractDetailsFromToken,
  getAuthConfig,
  getUrlPathnameExpiry,
  getUserManagerConfig,
  prepareUserProfileFromClaims,
  validateAuthFields,
} from '../../../utils/AuthProvider.util';
import {
  getOidcToken,
  getRefreshToken,
  setOidcToken,
  setRefreshToken,
} from '../../../utils/LocalStorageUtils';
import { getPathNameFromWindowLocation } from '../../../utils/RouterUtils';
import { escapeESReservedCharacters } from '../../../utils/StringsUtils';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import { checkIfUpdateRequired } from '../../../utils/UserDataUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';
import Loader from '../../common/Loader/Loader';
import Auth0Authenticator from '../AppAuthenticators/Auth0Authenticator';
import BasicAuthAuthenticator from '../AppAuthenticators/BasicAuthAuthenticator';
import { GenericAuthenticator } from '../AppAuthenticators/GenericAuthenticator';
import MsalAuthenticator from '../AppAuthenticators/MsalAuthenticator';
import OidcAuthenticator from '../AppAuthenticators/OidcAuthenticator';
import OktaAuthenticator from '../AppAuthenticators/OktaAuthenticator';
import SamlAuthenticator from '../AppAuthenticators/SamlAuthenticator';
import { AuthenticatorRef, OidcUser } from './AuthProvider.interface';
import BasicAuthProvider from './BasicAuthProvider';
import OktaAuthProvider from './OktaAuthProvider';

interface AuthProviderProps {
  childComponentType: ComponentType;
  children: ReactNode;
}

const cookieStorage = new CookieStorage();

const userAPIQueryFields = [
  TabSpecificField.PROFILE,
  TabSpecificField.TEAMS,
  TabSpecificField.ROLES,
  TabSpecificField.PERSONAS,
  TabSpecificField.DEFAULT_PERSONA,
  TabSpecificField.DOMAINS,
];

const isEmailVerifyField = 'isEmailVerified';

let requestInterceptor: number | null = null;
let responseInterceptor: number | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingRequests: any[] = [];

type AuthContextType = {
  onLoginHandler: () => void;
  onLogoutHandler: () => void;
  handleSuccessfulLogin: (user: OidcUser) => Promise<void>;
  handleFailedLogin: () => void;
  handleSuccessfulLogout: () => void;
  updateAxiosInterceptors: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({
  childComponentType,
  children,
}: AuthProviderProps) => {
  const {
    setCurrentUser,
    updateNewUser: setNewUserProfile,
    setIsAuthenticated,
    authConfig,
    setAuthConfig,
    setAuthorizerConfig,
    setIsSigningUp,
    authorizerConfig,
    jwtPrincipalClaims,
    jwtPrincipalClaimsMapping,
    setJwtPrincipalClaims,
    setJwtPrincipalClaimsMapping,
    isApplicationLoading,
    setApplicationLoading,
  } = useApplicationStore();
  const { updateDomains, updateDomainLoading } = useDomainStore();
  const tokenService = useRef<TokenService>(TokenService.getInstance());

  const location = useCustomLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [timeoutId, setTimeoutId] = useState<number>();
  const [msalInstance, setMsalInstance] = useState<IPublicClientApplication>();

  const authenticatorRef = useRef<AuthenticatorRef>(null);

  const userConfig = useMemo(
    () =>
      authConfig
        ? getUserManagerConfig(authConfig)
        : ({} as Record<string, string | boolean | WebStorageStateStore>),
    [authConfig]
  );

  const clientType = authConfig?.clientType ?? ClientType.Public;

  const onLoginHandler = () => {
    setApplicationLoading(true);

    authenticatorRef.current?.invokeLogin();

    resetWebAnalyticSession();
  };

  // Handler to perform logout within application
  const onLogoutHandler = useCallback(async () => {
    clearTimeout(timeoutId);

    // Let SSO complete the logout process
    await authenticatorRef.current?.invokeLogout();

    setIsAuthenticated(false);

    // reset the user details on logout
    setCurrentUser({} as User);

    // remove analytics session on logout
    removeSession();

    // remove the refresh token on logout
    setRefreshToken('');

    setApplicationLoading(false);

    // Clear the refresh flag (used after refresh is complete)
    tokenService.current.clearRefreshInProgress();

    // Upon logout, redirect to the login page
    navigate(ROUTES.SIGNIN);
  }, [timeoutId]);

  const fetchDomainList = useCallback(async () => {
    try {
      updateDomainLoading(true);
      const { data } = await getDomainList({
        limit: ES_MAX_PAGE_SIZE,
        fields: 'parent',
      });
      updateDomains(data);
    } catch (error) {
      // silent fail
    } finally {
      updateDomainLoading(false);
    }
  }, []);

  const handledVerifiedUser = () => {
    if (!applicationRoutesClass.isProtectedRoute(location.pathname)) {
      // Check if provider uses OidcAuthenticator which has routing logic
      const usesOidcAuthenticator = [
        AuthProviderEnum.Google,
        AuthProviderEnum.CustomOidc,
        AuthProviderEnum.AwsCognito,
      ].includes(authConfig?.provider as AuthProviderEnum);

      // For providers using OidcAuthenticator, navigate to HOME for routing
      // For all others (Azure, Auth0, SAML, etc.), navigate directly to MY_DATA
      if (usesOidcAuthenticator && clientType !== ClientType.Confidential) {
        navigate(ROUTES.HOME);
      } else {
        navigate(ROUTES.MY_DATA);
      }
    }
  };

  /**
   * Stores redirect URL for successful login
   */
  const storeRedirectPath = useCallback((path?: string) => {
    if (!path) {
      return;
    }
    cookieStorage.setItem(REDIRECT_PATHNAME, path, {
      expires: getUrlPathnameExpiry(),
      path: '/',
    });
  }, []);

  const resetUserDetails = (forceLogout = false) => {
    setCurrentUser({} as User);
    setOidcToken('');
    setRefreshToken('');
    setIsAuthenticated(false);
    setApplicationLoading(false);
    clearTimeout(timeoutId);
    TokenService.getInstance().clearRefreshInProgress();
    if (forceLogout) {
      onLogoutHandler();
      showInfoToast(t('message.session-expired'));
    } else {
      navigate(ROUTES.SIGNIN);
    }
  };

  const getLoggedInUserDetails = async () => {
    setApplicationLoading(true);
    try {
      const res = await getLoggedInUser({ fields: userAPIQueryFields });
      if (res) {
        setCurrentUser(res);
        setIsAuthenticated(true);
        // Fetch domains at the start
        await fetchDomainList();
      } else {
        resetUserDetails();
      }
    } catch (error) {
      const err = error as AxiosError;
      resetUserDetails();
      if (err.response?.status !== 404) {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.logged-in-user-lowercase'),
          })
        );
      }
    } finally {
      setApplicationLoading(false);
    }
  };

  /**
   * It will set an timer for 5 mins before Token will expire
   * If time if less then 5 mins then it will try to SilentSignIn
   * It will also ensure that we have time left for token expiry
   * This method will be call upon successful signIn
   */
  const startTokenExpiryTimer = () => {
    // Extract expiry
    const { isExpired, timeoutExpiry } = extractDetailsFromToken(
      getOidcToken()
    );
    const refreshToken = getRefreshToken();

    // Basic & LDAP renewToken depends on RefreshToken hence adding a check here for the same
    const shouldStartExpiry =
      refreshToken ||
      [AuthProviderEnum.Basic, AuthProviderEnum.LDAP].indexOf(
        authConfig?.provider as AuthProviderEnum
      ) === -1;

    if (!isExpired && isNumber(timeoutExpiry) && shouldStartExpiry) {
      // Have 5m buffer before start trying for silent signIn
      // If token is about to expire then start silentSignIn
      // else just set timer to try for silentSignIn before token expires
      clearTimeout(timeoutId);

      const timerId = setTimeout(() => {
        tokenService.current?.refreshToken();
      }, timeoutExpiry);
      setTimeoutId(Number(timerId));
    }
  };

  useEffect(() => {
    if (authenticatorRef.current?.renewIdToken) {
      tokenService.current.updateRenewToken(
        authenticatorRef.current?.renewIdToken
      );
      // After every refresh success, start timer again
      tokenService.current.updateRefreshSuccessCallback(startTokenExpiryTimer);
    }
  }, [authenticatorRef.current?.renewIdToken]);

  /**
   * Performs cleanup around timers
   * Clean silentSignIn activities if going on
   */
  const cleanup = useCallback(() => {
    clearTimeout(timeoutId);
  }, [timeoutId]);

  const handleFailedLogin = () => {
    setIsSigningUp(false);
    setIsAuthenticated(false);
    setApplicationLoading(false);
    navigate(ROUTES.SIGNIN);
  };

  const handleSuccessfulLogin = useCallback(
    async (user: OidcUser) => {
      setApplicationLoading(true);
      setIsAuthenticated(true);
      const fields =
        authConfig?.provider === AuthProviderEnum.Basic
          ? userAPIQueryFields + ',' + isEmailVerifyField
          : userAPIQueryFields;
      try {
        const newUser = prepareUserProfileFromClaims({
          user,
          jwtPrincipalClaims,
          principalDomain: authorizerConfig?.principalDomain ?? '',
          jwtPrincipalClaimsMapping,
          clientType,
        });

        const res = await getLoggedInUser({ fields });
        if (res) {
          const userDetails = await checkIfUpdateRequired(res, newUser);
          setCurrentUser(userDetails);

          // Fetch domains at the start
          await fetchDomainList();

          handledVerifiedUser();
          // Start expiry timer on successful login
          startTokenExpiryTimer();
        }
      } catch (error) {
        const err = error as AxiosError;
        if (err?.response?.status === 404) {
          if (!authConfig?.enableSelfSignup) {
            resetUserDetails();
            navigate(ROUTES.UNAUTHORISED);
            showErrorToast(err);
          } else {
            setNewUserProfile(user.profile);
            setCurrentUser({} as User);
            setIsSigningUp(true);
            navigate(ROUTES.SIGNUP);
          }
        } else {
          // eslint-disable-next-line no-console
          console.error(err);
          showErrorToast(err);
          resetUserDetails();
          navigate(ROUTES.SIGNIN);
        }
      } finally {
        setApplicationLoading(false);
      }
    },
    [
      authConfig?.enableSelfSignup,
      clientType,
      authorizerConfig?.principalDomain,
      jwtPrincipalClaims,
      jwtPrincipalClaimsMapping,
      setIsSigningUp,
      setIsAuthenticated,
      setApplicationLoading,
      setCurrentUser,
      setNewUserProfile,
    ]
  );

  /**
   * Stores redirect URL for successful login
   */
  const handleStoreProtectedRedirectPath = useCallback(() => {
    if (applicationRoutesClass.isProtectedRoute(location.pathname)) {
      storeRedirectPath(location.pathname);
    }
  }, [location.pathname, storeRedirectPath]);

  const updateAuthInstance = async (
    configJson: AuthenticationConfiguration
  ) => {
    const { provider, ...otherConfigs } = configJson;
    switch (provider) {
      case AuthProviderEnum.Azure:
        {
          const instance = new PublicClientApplication(
            otherConfigs as unknown as Configuration
          );

          // Need to initialize the instance before setting it
          await instance.initialize();

          setMsalInstance(instance);
        }

        break;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withDomainFilter = (config: InternalAxiosRequestConfig<any>) => {
    const isGetRequest = config.method === 'get';
    const activeDomain = useDomainStore.getState().activeDomain;
    const hasActiveDomain = activeDomain !== DEFAULT_DOMAIN_VALUE;
    const currentPath = getPathNameFromWindowLocation();
    const shouldNotIntercept = [
      '/domain',
      '/auth/logout',
      '/auth/refresh',
    ].reduce((prev, curr) => {
      return prev || currentPath.startsWith(curr);
    }, false);

    // Do not intercept requests from domains page or /auth endpoints
    if (shouldNotIntercept) {
      return config;
    }

    if (isGetRequest && hasActiveDomain) {
      // Filter ES Query
      if (config.url?.includes('/search/query')) {
        if (config.params?.index === SearchIndex.TAG) {
          return config;
        }

        // Parse and update the query parameter
        const queryParams = Qs.parse(config.url.split('?')[1]);
        // adding quotes for exact matching
        const domainStatement = `(domains.fullyQualifiedName:"${escapeESReservedCharacters(
          activeDomain
        )}")`;
        queryParams.q = queryParams.q ?? '';
        queryParams.q += isEmpty(queryParams.q)
          ? domainStatement
          : ` AND ${domainStatement}`;

        // Update the URL with the modified query parameter
        config.url = `${config.url.split('?')[0]}?${Qs.stringify(queryParams)}`;
      } else {
        config.params = {
          ...config.params,
          domain: activeDomain,
        };
      }
    }

    return config;
  };

  /**
   * Initialize Axios interceptors to intercept every request and response
   * to handle appropriately. This should be called only when security is enabled.
   */
  const initializeAxiosInterceptors = () => {
    // Axios Request interceptor to add Bearer tokens in Header
    if (requestInterceptor != null) {
      axiosClient.interceptors.request.eject(requestInterceptor);
    }

    if (responseInterceptor != null) {
      axiosClient.interceptors.response.eject(responseInterceptor);
    }

    requestInterceptor = axiosClient.interceptors.request.use(async function (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: InternalAxiosRequestConfig<any>
    ) {
      // Need to read token from local storage as it might have been updated with refresh
      const token: string = getOidcToken() || '';
      if (token) {
        if (config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`;
        } else {
          config.headers = {
            Authorization: `Bearer ${token}`,
          } as AxiosRequestHeaders;
        }
      }

      if (config.method === 'patch' && config.headers) {
        config.headers['Content-type'] = 'application/json-patch+json';
      }

      return withDomainFilter(config);
    });

    // Axios response interceptor for statusCode 401,403
    responseInterceptor = axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status } = error.response;
          if (status === ClientErrors.UNAUTHORIZED) {
            // For login or refresh we don't want to fire another refresh req
            // Hence rejecting it
            if (
              UN_AUTHORIZED_EXCLUDED_PATHS.includes(error.config.url) ||
              (error.config.url === '/users/loggedInUser' &&
                !error.response.data.message.includes('Expired token!'))
            ) {
              return Promise.reject(error);
            }
            handleStoreProtectedRedirectPath();

            // If 401 error and refresh is not in progress, trigger the refresh
            if (!tokenService.current?.isTokenUpdateInProgress()) {
              // Start the refresh process
              return new Promise((resolve, reject) => {
                // Add this request to the pending queue
                pendingRequests.push({
                  resolve,
                  reject,
                  config: error.config,
                });

                // Refresh the token and retry the requests in the queue
                tokenService.current
                  .refreshToken()
                  .then((token) => {
                    if (token) {
                      // Retry the pending requests
                      initializeAxiosInterceptors();
                      pendingRequests.forEach(({ resolve, reject, config }) => {
                        axiosClient.request(config).then(resolve).catch(reject);
                      });

                      // Clear the queue after retrying
                      pendingRequests = [];
                    } else {
                      resetUserDetails(true);
                    }
                  })
                  .catch((error) => {
                    resetUserDetails(true);

                    return Promise.reject(error);
                  });
              });
            } else {
              // If refresh is in progress, queue the request
              return new Promise((resolve, reject) => {
                pendingRequests.push({
                  resolve,
                  reject,
                  config: error.config,
                });
              });
            }
          }
        }

        throw error;
      }
    );
  };

  const fetchAuthConfig = async () => {
    try {
      const [authConfig, authorizerConfig] = await Promise.all([
        fetchAuthenticationConfig(),
        fetchAuthorizerConfig(),
      ]);
      if (!isNil(authConfig)) {
        const provider = authConfig.provider;
        // show an error toast if provider is null or not supported
        if (provider && Object.values(AuthProviderEnum).includes(provider)) {
          const configJson = getAuthConfig(authConfig);
          validateAuthFields(configJson, t);
          setJwtPrincipalClaims(authConfig.jwtPrincipalClaims);
          setJwtPrincipalClaimsMapping(authConfig.jwtPrincipalClaimsMapping);
          setAuthConfig(configJson);
          setAuthorizerConfig(authorizerConfig);
          updateAuthInstance(configJson);
          if (!getOidcToken()) {
            handleStoreProtectedRedirectPath();
            setApplicationLoading(false);
          } else {
            // get the user details if token is present and route is not auth callback and saml callback
            if (
              ![
                ROUTES.AUTH_CALLBACK,
                ROUTES.SAML_CALLBACK,
                ROUTES.SILENT_CALLBACK,
              ].includes(location.pathname)
            ) {
              getLoggedInUserDetails();
            }
          }
        } else {
          // provider is either null or not supported
          setApplicationLoading(false);
          showErrorToast(
            t('message.configured-sso-provider-is-not-supported', {
              provider: authConfig?.provider,
            })
          );
        }
      } else {
        setApplicationLoading(false);
        showErrorToast(t('message.auth-configuration-missing'));
      }
    } catch (error) {
      setApplicationLoading(false);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.auth-config-lowercase-plural'),
        })
      );
    }
  };

  const getProtectedApp = () => {
    // Show loader if application in loading state
    const childElement = isApplicationLoading ? (
      <Loader fullScreen />
    ) : (
      children
    );

    if (clientType === ClientType.Confidential) {
      return (
        <GenericAuthenticator ref={authenticatorRef}>
          {childElement}
        </GenericAuthenticator>
      );
    }
    switch (authConfig?.provider) {
      case AuthProviderEnum.LDAP:
      case AuthProviderEnum.Basic: {
        return (
          <BasicAuthProvider>
            <BasicAuthAuthenticator ref={authenticatorRef}>
              {childElement}
            </BasicAuthAuthenticator>
          </BasicAuthProvider>
        );
      }
      case AuthProviderEnum.Auth0: {
        return (
          <Auth0Provider
            useRefreshTokens
            cacheLocation="localstorage"
            clientId={authConfig.clientId.toString()}
            domain={authConfig.authority.toString()}
            redirectUri={authConfig.callbackUrl.toString()}>
            <Auth0Authenticator ref={authenticatorRef}>
              {childElement}
            </Auth0Authenticator>
          </Auth0Provider>
        );
      }
      case AuthProviderEnum.Saml: {
        return (
          <SamlAuthenticator ref={authenticatorRef}>
            {childElement}
          </SamlAuthenticator>
        );
      }
      case AuthProviderEnum.Okta: {
        return (
          <OktaAuthProvider>
            <OktaAuthenticator ref={authenticatorRef}>
              {childElement}
            </OktaAuthenticator>
          </OktaAuthProvider>
        );
      }
      case AuthProviderEnum.Google:
      case AuthProviderEnum.CustomOidc:
      case AuthProviderEnum.AwsCognito: {
        return (
          <OidcAuthenticator
            childComponentType={childComponentType}
            ref={authenticatorRef}
            userConfig={userConfig}>
            {childElement}
          </OidcAuthenticator>
        );
      }
      case AuthProviderEnum.Azure: {
        return msalInstance ? (
          <MsalProvider instance={msalInstance}>
            <MsalAuthenticator ref={authenticatorRef}>
              {childElement}
            </MsalAuthenticator>
          </MsalProvider>
        ) : (
          <Loader fullScreen />
        );
      }
      default: {
        return null;
      }
    }
  };

  useEffect(() => {
    fetchAuthConfig();
    startTokenExpiryTimer();
    initializeAxiosInterceptors();

    return cleanup;
  }, []);

  const contextValues = useMemo(() => {
    return {
      onLoginHandler,
      onLogoutHandler,
      handleSuccessfulLogin,
      handleFailedLogin,
      handleSuccessfulLogout: resetUserDetails,
      updateAxiosInterceptors: initializeAxiosInterceptors,
    };
  }, [
    onLoginHandler,
    onLogoutHandler,
    handleSuccessfulLogin,
    handleFailedLogin,
    resetUserDetails,
    initializeAxiosInterceptors,
  ]);

  const isConfigLoading =
    !authConfig ||
    (authConfig.provider === AuthProviderEnum.Azure && !msalInstance);

  return (
    <AuthContext.Provider value={contextValues}>
      {isConfigLoading ? <Loader fullScreen /> : getProtectedApp()}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

export const useAuthProvider = () => {
  return useContext(AuthContext);
};
