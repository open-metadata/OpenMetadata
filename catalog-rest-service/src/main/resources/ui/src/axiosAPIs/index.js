import axios from 'axios';
import { CookieStorage } from 'cookie-storage';
import { oidcTokenKey } from '../constants/constants';
import { userSignOut } from '../utils/AuthUtils';

const cookieStorage = new CookieStorage();
const UNAUTHORIZED = 401;

const axiosClient = axios.create({
  baseURL: '/api/v1',
});

axiosClient.interceptors.request.use(function (config) {
  const token = cookieStorage.getItem(oidcTokenKey);
  if (token) {
    config.headers['X-Catalog-Source'] = token;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === UNAUTHORIZED) {
        userSignOut();
      }
    }

    throw error;
    // return Promise.reject(error);
  }
);

export default axiosClient;
