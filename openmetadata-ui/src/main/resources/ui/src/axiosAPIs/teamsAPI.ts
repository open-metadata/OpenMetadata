import { AxiosResponse } from 'axios';
import { Team } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTeams: Function = (
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/teams', arrQueryFields);

  return APIClient.get(`${url}&limit=1000000`);
};

export const getTeamByName: Function = (
  name: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/teams/name/${name}`, arrQueryFields);

  return APIClient.get(url);
};

export const createTeam: Function = (data: Team) => {
  return APIClient.post('/teams', data);
};

export const patchTeamDetail: Function = (id: string, data: Team) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/teams/${id}`, data, configOptions);
};
