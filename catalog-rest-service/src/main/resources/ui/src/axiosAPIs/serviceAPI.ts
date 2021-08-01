import { AxiosResponse } from 'axios';
import { ServiceOption } from 'Models';
import APIClient from './index';

export const getServiceDetails: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/services/');
};

export const getServices: Function = (
  serviceName: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/services/${serviceName}`);
};

export const getServiceById: Function = (
  serviceName: string,
  id: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/services/${serviceName}/${id}`);
};

export const getServiceByFQN: Function = (
  serviceName: string,
  fqn: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/services/${serviceName}/name/${fqn}`);
};

export const postService: Function = (
  serviceName: string,
  options: ServiceOption
): Promise<AxiosResponse> => {
  return APIClient.post(`/services/${serviceName}`, options);
};

export const updateService: Function = (
  serviceName: string,
  id: string,
  options: ServiceOption
): Promise<AxiosResponse> => {
  return APIClient.put(`/services/${serviceName}/${id}`, options);
};

export const deleteService: Function = (
  serviceName: string,
  id: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/services/${serviceName}/${id}`);
};
