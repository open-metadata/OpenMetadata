import { CookieStorage } from 'cookie-storage';
import { oidcTokenKey, ROUTES } from '../constants/constants';

const cookieStorage = new CookieStorage();

export const userSignOut = () => {
  cookieStorage.removeItem(oidcTokenKey);
  window.location.href = ROUTES.HOME;
};
