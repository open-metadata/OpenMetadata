import { oidcTokenKey, refreshTokenKey } from '../constants/constants';

/* A util that sets and gets the data in/from local storage. 
    @getter
    @setter
*/
const localState = {
  getRefreshToken: () => localStorage.getItem(refreshTokenKey) as string,
  getOidcToken: () => localStorage.getItem(oidcTokenKey) as string,

  setRefreshToken: (token: string) => {
    localStorage.setItem(refreshTokenKey, token);
  },

  setOidcToken: (_oidcTokenKey: string) => {
    localStorage.setItem(oidcTokenKey, _oidcTokenKey);
  },

  removeOidcToken: () => localStorage.removeItem(oidcTokenKey),
};

export default localState;
