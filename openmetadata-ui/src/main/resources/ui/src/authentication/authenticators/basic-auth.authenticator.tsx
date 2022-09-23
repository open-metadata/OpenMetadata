import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { getAccessTokenOnExpiry } from '../../axiosAPIs/auth-API';
import { AuthTypes } from '../../enums/signin.enum';
import localState from '../../utils/LocalStorageUtils';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { useBasicAuth } from '../auth-provider/basic-auth.provider';

interface BasicAuthenticatorInterface {
  children: ReactNode;
}

const BasicAuthenticator = forwardRef(
  ({ children }: BasicAuthenticatorInterface, ref) => {
    const { handleLogout } = useBasicAuth();
    const { setIsAuthenticated, authConfig } = useAuthContext();
    useImperativeHandle(ref, () => ({
      invokeLogout() {
        handleLogout();
        setIsAuthenticated(false);
      },
      renewIdToken() {
        let idToken = '';
        const refreshToken = localState.getRefreshToken();
        if (authConfig && authConfig.provider !== undefined) {
          return new Promise((resolve, reject) => {
            const { provider } = authConfig;
            if (provider === AuthTypes.BASIC) {
              getAccessTokenOnExpiry({
                refreshToken: refreshToken as string,
              })
                .then((res) => {
                  idToken = res.accessToken;
                  localState.setOidcToken(res.accessToken);
                  resolve(idToken);
                })
                .catch((err) => {
                  reject(
                    `Error while renewing id token from Basic Auth: ${err.message}`
                  );
                });
            } else {
              reject(
                `Auth Provider ${provider} not supported for renewing tokens.`
              );
            }
          });
        } else {
          return Promise.reject(
            'Cannot renew id token. Authentication Provider is not present.'
          );
        }
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

export default BasicAuthenticator;
