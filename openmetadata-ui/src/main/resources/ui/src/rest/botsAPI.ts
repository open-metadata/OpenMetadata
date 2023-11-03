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

import { AxiosResponse } from 'axios';
import axiosClient from '.';
import { CreateBot } from '../generated/api/createBot';
import { Bot } from '../generated/entity/bot';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';

const BASE_URL = '/bots';

interface GetBotParams {
  limit?: number;
  after?: string;
  before?: string;
  include?: Include;
}

export const getBots = async (params: GetBotParams) => {
  const response = await axiosClient.get<{ data: Bot[]; paging: Paging }>(
    BASE_URL,
    {
      params,
    }
  );

  return response.data;
};

export const createBot = async (data: CreateBot) => {
  const response = await axiosClient.post<CreateBot, AxiosResponse<Bot>>(
    BASE_URL,
    data
  );

  return response.data;
};

export const updateBot = async (data: Bot) => {
  const response = await axiosClient.put<Bot, AxiosResponse<Bot>>(
    BASE_URL,
    data
  );

  return response.data;
};

export const deleteBot = async (id: string, hardDelete?: boolean) => {
  const response = await axiosClient.delete(`${BASE_URL}/${id}`, {
    params: { hardDelete },
  });

  return response.data;
};

export const createBotWithPut = async (data: CreateBot) => {
  const response = await axiosClient.put<CreateBot, AxiosResponse<Bot>>(
    BASE_URL,
    data
  );

  return response.data;
};
