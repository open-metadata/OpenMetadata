/*
 *  Copyright 2023 Collate.
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
import { Paging } from 'generated/type/paging';
import { ServicePageData } from 'pages/service';
import { getURLWithQueryFields } from 'utils/APIUtils';
import APIClient from './index';

export const getContainers = async (
  serviceName: string,
  arrQueryFields: string | string[],
  paging?: string
) => {
  const url = `${getURLWithQueryFields(
    `/containers`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  const response = await APIClient.get<{
    data: ServicePageData[];
    paging: Paging;
  }>(url);

  return response.data;
};
