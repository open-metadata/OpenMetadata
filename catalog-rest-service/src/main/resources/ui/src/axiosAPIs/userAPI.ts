import { AxiosResponse } from 'axios';
import { UserProfile } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getUsers = (arrQueryFields?: string): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/users', arrQueryFields);

  return APIClient.get(url);
};
export const getUserByName = (
  name: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/users/name/' + name, arrQueryFields);

  return APIClient.get(url);
};

export const getLoggedInUser = (arrQueryFields?: string) => {
  const url = getURLWithQueryFields('/users/loggedInUser', arrQueryFields);

  return APIClient.get(url);
};

export const getUserDetails: Function = (
  id: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/users/${id}`);
};

export const getTeams = (): Promise<AxiosResponse> => {
  return APIClient.get('/teams');
};

export const getRoles: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/roles');
};

export const updateUserRole: Function = (
  id: string,
  options: Array<string>
): Promise<AxiosResponse> => {
  return APIClient.post(`/users/${id}/roles`, options);
};

export const updateUserTeam: Function = (
  id: string,
  options: Array<string>
): Promise<AxiosResponse> => {
  return APIClient.post(`/users/${id}/teams`, options);
};

export const getUserById: Function = (id: string): Promise<AxiosResponse> => {
  return APIClient.get(`/users/${id}`);
};

export const createUser = (userDetails: {
  [name: string]: string | Array<string> | UserProfile;
}) => {
  return APIClient.post(`/users`, userDetails);
};
