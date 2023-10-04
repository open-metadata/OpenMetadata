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

import axiosClient from '.';
import { EntityType } from '../enums/entity.enum';
import { Page, PageType } from '../generated/system/ui/page';

const BASE_URL = '/page';

export const createPage = async (data: Page) => {
  const response = await axiosClient.post(BASE_URL, data);

  return response.data;
};

export const getPageDetails = async (persona: string, pageType: PageType) => {
  const params = {
    fqnPrefix: `${EntityType.PERSONA}.${persona}.${EntityType.PAGE}.${pageType}`,
  };

  const response = await axiosClient.get<Page>(BASE_URL, { params });

  return response.data;
};
