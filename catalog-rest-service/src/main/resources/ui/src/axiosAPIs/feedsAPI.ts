import { AxiosResponse } from 'axios';
import APIClient from './index';
import { Feed, FeedById } from 'Models';

export const getAllFeeds: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/feed');
};

export const postFeed: Function = (data: Feed): Promise<AxiosResponse> => {
  return APIClient.post('/feed', data);
};

export const getFeedById: Function = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/feed/${id}`);
};

export const postFeedById: Function = (
  id: string,
  data: FeedById
): Promise<AxiosResponse> => {
  return APIClient.post(`/feed/${id}/posts`, data);
};
