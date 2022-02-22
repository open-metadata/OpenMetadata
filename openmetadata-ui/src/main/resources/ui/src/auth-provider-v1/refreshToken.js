import { oidcTokenKey } from '../constants/constants';

export const refreshTokenSetup = (res) => {
  // Timing to renew access token
  let refreshTiming = (res.tokenObj.expires_in || 3600 - 1 * 60) * 1000;

  const refreshToken = async () => {
    try {
      const newAuthRes = await res.reloadAuthResponse();
      refreshTiming = (newAuthRes.expires_in || 3600 - 1 * 60) * 1000;
      // eslint-disable-next-line no-console
      console.log('newAuthRes:', newAuthRes);
      // saveUserToken(newAuthRes.access_token);  <-- save new token
      localStorage.setItem(oidcTokenKey, newAuthRes.id_token);

      // Setup the other timer after the first one
      setTimeout(refreshToken, refreshTiming);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('Logout ACK');
    }
  };

  // Setup first refresh timer
  setTimeout(refreshToken, refreshTiming);
};
