/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

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
