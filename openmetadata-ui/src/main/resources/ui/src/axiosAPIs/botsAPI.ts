import { AxiosResponse } from 'axios';
import axiosClient from '.';
import { Bot } from '../generated/entity/bot';
import { Paging } from '../generated/type/paging';

export const getBots = async () => {
  const response = await axiosClient.get<{ data: Bot[]; paging: Paging }>(
    `/bots`
  );

  return response.data;
};

export const createBot = async (data: Bot) => {
  const response = await axiosClient.post<Bot, AxiosResponse<Bot>>(
    `/bot`,
    data
  );

  return response.data;
};
