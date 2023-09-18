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

import axios from 'axios';
import {
  ACTIVE_DOMAIN_STORAGE_KEY,
  DEFAULT_DOMAIN_VALUE,
} from 'constants/constants';
import { isEmpty } from 'lodash';
import Qs from 'qs';

let requestInterceptor: number | null = null;

const axiosClient = axios.create({
  baseURL: '/api/v1',
  paramsSerializer: (params) => Qs.stringify(params, { arrayFormat: 'comma' }),
});

export const initializeAxiosInterceptors = async () => {
  const activeDomain =
    localStorage.getItem(ACTIVE_DOMAIN_STORAGE_KEY) ?? DEFAULT_DOMAIN_VALUE;

  if (requestInterceptor != null) {
    axiosClient.interceptors.request.eject(requestInterceptor);
  }

  requestInterceptor = axiosClient.interceptors.request.use(
    (config) => {
      const isGetRequest = config.method === 'get';
      const hasActiveDomain = activeDomain !== DEFAULT_DOMAIN_VALUE;

      if (isGetRequest && hasActiveDomain) {
        // Filter ES Query
        if (config.url?.includes('/search/query')) {
          // Parse and update the query parameter
          const queryParams = Qs.parse(config.url.split('?')[1]);
          const domainStatement = `(domain.fullyQualifiedName:${activeDomain})`;
          queryParams.q = queryParams.q || '';
          queryParams.q += isEmpty(queryParams.q)
            ? domainStatement
            : ` AND ${domainStatement}`;

          // Update the URL with the modified query parameter
          config.url = `${config.url.split('?')[0]}?${Qs.stringify(
            queryParams
          )}`;
        } else {
          config.params = {
            ...config.params,
            domain: activeDomain,
          };
        }
      }

      return config;
    },

    (error) => {
      return Promise.reject(error);
    }
  );
};

initializeAxiosInterceptors();

export default axiosClient;
