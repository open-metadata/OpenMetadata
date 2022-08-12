import { AxiosResponse } from 'axios';
import axiosClient from '.';
import { CreateBot } from '../generated/api/createBot';
import { Bot } from '../generated/entity/bot';
import { Paging } from '../generated/type/paging';

const BASE_URL = '/bots';

export type GetInclude = 'all' | 'deleted' | 'non-deleted';

interface GetBotParams {
  limit?: number;
  after?: string;
  before?: string;
  include?: GetInclude;
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
