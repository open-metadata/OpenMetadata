/*
 *  Copyright 2021 Collate
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
import jsonData from '../jsons/en';
import { showErrorToast } from '../utils/ToastUtils';

const baseURL = '/api/v1';

const axiosClient = axios.create({
  baseURL,
});

export const AxiosClientWithError = axios.create({
  baseURL,
});

AxiosClientWithError.interceptors.response.use(
  (response) => {
    if (response.data) {
      return Promise.resolve(response);
    } else {
      throw null;
    }
  },
  (error) => {
    showErrorToast(
      error,
      jsonData['api-error-messages']['unexpected-server-response']
    );
  }
);

export default axiosClient;
