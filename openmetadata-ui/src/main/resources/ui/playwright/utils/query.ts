/*
 *  Copyright 2024 Collate.
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
import { APIRequestContext } from '@playwright/test';

export const createQueryByTableName = async (data: {
  apiContext: APIRequestContext;
  tableResponseData: unknown;
}) => {
  const { apiContext, tableResponseData } = data;
  const queryResponse = await apiContext
    .post('/api/v1/queries', {
      data: {
        query: 'SELECT * FROM SALES',
        description: 'this is query description',
        queryUsedIn: [
          {
            id: tableResponseData?.['id'],
            type: 'table',
          },
        ],
        duration: 6199,
        queryDate: 1700225667191,
        service: tableResponseData?.['service']?.['name'],
      },
    })
    .then((response) => response.json());

  return await queryResponse;
};
