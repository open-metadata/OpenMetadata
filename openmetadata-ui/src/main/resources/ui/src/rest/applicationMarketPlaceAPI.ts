import { PagingResponse } from 'Models';
import { AppMarketPlaceDefinition } from '../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { ListParams } from '../interface/API.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

const BASE_URL = '/apps/marketplace';

export const getMarketPlaceApplicationList = async (params?: ListParams) => {
  const response = await APIClient.get<
    PagingResponse<AppMarketPlaceDefinition[]>
  >(BASE_URL, {
    params,
  });

  return response.data;
};

export const getMarketPlaceApplicationByName = async (
  appName: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `/apps/marketplace/name/${appName}`,
    arrQueryFields
  );

  const response = await APIClient.get<AppMarketPlaceDefinition>(url);

  return response.data;
};
