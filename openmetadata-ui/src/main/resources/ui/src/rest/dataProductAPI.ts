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
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import { PAGE_SIZE } from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import { CreateDataProduct } from '../generated/api/domains/createDataProduct';
import {
  DataProduct,
  EntityReference,
} from '../generated/entity/domains/dataProduct';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import {
  formatDataProductResponse,
  getURLWithQueryFields,
} from '../utils/APIUtils';
import APIClient from './index';
import { searchQuery } from './searchAPI';

const BASE_URL = '/dataProducts';

type Params = {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
  domain?: string;
};

export const addDataProducts = async (data: CreateDataProduct) => {
  const response = await APIClient.post<
    CreateDataProduct,
    AxiosResponse<DataProduct>
  >(BASE_URL, data);

  return response.data;
};

export const patchDataProduct = async (id: string, patch: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<DataProduct>
  >(`${BASE_URL}/${id}`, patch, configOptions);

  return response.data;
};

export const getDataProductByName = async (
  dataProductName: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `${BASE_URL}/name/${dataProductName}`,
    arrQueryFields
  );

  const response = await APIClient.get<DataProduct>(url);

  return response.data;
};

export const getDataProductList = async (params?: Params) => {
  const response = await APIClient.get<PagingResponse<DataProduct[]>>(
    BASE_URL,
    {
      params,
    }
  );

  return response.data;
};

export const deleteDataProduct = (id: string) => {
  return APIClient.delete(`${BASE_URL}/${id}`);
};

export const getDataProductVersionsList = async (id: string) => {
  const url = `${BASE_URL}/${id}/versions`;
  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getDataProductVersionData = async (
  id: string,
  version: string
) => {
  const url = `${BASE_URL}/${id}/versions/${version}`;
  const response = await APIClient.get<DataProduct>(url);

  return response.data;
};

export const fetchDataProductsElasticSearch = async (
  searchText: string,
  page: number
): Promise<{
  data: {
    label: string;
    value: DataProduct;
  }[];
  paging: Paging;
}> => {
  const res = await searchQuery({
    query: searchText,
    filters: '',
    pageNumber: page,
    pageSize: PAGE_SIZE,
    queryFilter: {},
    searchIndex: SearchIndex.DATA_PRODUCT,
  });

  return {
    data: formatDataProductResponse(res.hits.hits ?? []).map((item) => ({
      label: item.fullyQualifiedName ?? '',
      value: item,
    })),
    paging: {
      total: res.hits.total.value,
    },
  };
};

export const addAssetsToDataProduct = async (
  dataProductFqn: string,
  assets: EntityReference[]
) => {
  const data: { assets: EntityReference[] } = {
    assets: assets,
  };

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(`/dataProducts/${dataProductFqn}/assets/add`, data);

  return response.data;
};

export const removeAssetsFromDataProduct = async (
  dataProductFqn: string,
  assets: EntityReference[]
) => {
  const data = {
    assets: assets,
  };

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(`/dataProducts/${dataProductFqn}/assets/remove`, data);

  return response.data;
};
