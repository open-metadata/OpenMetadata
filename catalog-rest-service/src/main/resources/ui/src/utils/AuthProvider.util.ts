import { CookieStorage } from 'cookie-storage';
import { isNil } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import { isDev } from '../utils/EnvironmentUtils';

const cookieStorage = new CookieStorage();

export const getOidcExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 24 * 1000);
};

export const getUserManagerConfig = (
  authClient: Record<string, string> = {}
): Record<string, string | WebStorageStateStore> => {
  const { authority, clientId, callbackUrl } = authClient;

  return {
    authority,
    // eslint-disable-next-line @typescript-eslint/camelcase
    client_id: clientId,
    // eslint-disable-next-line @typescript-eslint/camelcase
    response_type: 'id_token',
    // eslint-disable-next-line @typescript-eslint/camelcase
    redirect_uri: isDev()
      ? 'http://localhost:3000/callback'
      : !isNil(callbackUrl)
      ? callbackUrl
      : `${window.location.origin}/callback`,
    scope: 'openid email profile',
    userStore: new WebStorageStateStore({ store: cookieStorage }),
  };
};

export const getNameFromEmail = (email: string) => {
  if (email?.match(/^\S+@\S+\.\S+$/)) {
    return email.split('@')[0];
  } else {
    return '';
  }
};
