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
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  APPLICATION_JSON_CONTENT_TYPE_HEADER,
  PAGE_SIZE,
} from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import { CreateDataProduct } from '../generated/api/domains/createDataProduct';
import {
  DataProductPortsView,
  PaginatedEntities,
} from '../generated/api/domains/dataProductPortsView';
import {
  DataProduct,
  EntityReference,
} from '../generated/entity/domains/dataProduct';
import { EntityHistory } from '../generated/type/entityHistory';
import { Paging } from '../generated/type/paging';
import { ListParams } from '../interface/API.interface';
import { formatDataProductResponse } from '../utils/APIUtils';
import { buildDomainFilter } from '../utils/elasticsearchQueryBuilder';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';
import { searchQuery } from './searchAPI';

const BASE_URL = '/dataProducts';

export const addDataProducts = async (data: CreateDataProduct) => {
  const response = await APIClient.post<
    CreateDataProduct,
    AxiosResponse<DataProduct>
  >(BASE_URL, data);

  return response.data;
};

export const patchDataProduct = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<DataProduct>
  >(`${BASE_URL}/${id}`, patch);

  return response.data;
};

export const getDataProductByName = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<DataProduct>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
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
  domainFQNs: string[],
  page: number
): Promise<{
  data: {
    label: string;
    value: DataProduct;
  }[];
  paging: Paging;
}> => {
  // Use the utility function to build the domain filter
  const queryFilter = buildDomainFilter(domainFQNs);

  const res = await searchQuery({
    query: searchText,
    filters: '',
    pageNumber: page,
    pageSize: PAGE_SIZE,
    queryFilter,
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
  >(`/dataProducts/${getEncodedFqn(dataProductFqn)}/assets/add`, data);

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
  >(`/dataProducts/${getEncodedFqn(dataProductFqn)}/assets/remove`, data);

  return response.data;
};

export const addFollower = async (dataProductID: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(
    `${BASE_URL}/${dataProductID}/followers`,
    userId,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const removeFollower = async (dataProductID: string, userId: string) => {
  const response = await APIClient.delete<{
    changeDescription: { fieldsDeleted: { oldValue: EntityReference[] }[] };
  }>(`${BASE_URL}/${dataProductID}/followers/${userId}`);

  return response.data;
};

export const getAllDataProductsWithAssetsCount = async () => {
  const response = await APIClient.get<Record<string, number>>(
    `${BASE_URL}/assets/counts`
  );

  return response.data;
};

export const addInputPortsToDataProduct = async (
  dataProductFqn: string,
  ports: EntityReference[]
) => {
  const data: { assets: EntityReference[] } = {
    assets: ports,
  };

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(`${BASE_URL}/${getEncodedFqn(dataProductFqn)}/inputPorts/add`, data);

  return response.data;
};

export const removeInputPortsFromDataProduct = async (
  dataProductFqn: string,
  ports: EntityReference[]
) => {
  const data: { assets: EntityReference[] } = {
    assets: ports,
  };

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(`${BASE_URL}/${getEncodedFqn(dataProductFqn)}/inputPorts/remove`, data);

  return response.data;
};

export const addOutputPortsToDataProduct = async (
  dataProductFqn: string,
  ports: EntityReference[]
) => {
  const data: { assets: EntityReference[] } = {
    assets: ports,
  };

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(`${BASE_URL}/${getEncodedFqn(dataProductFqn)}/outputPorts/add`, data);

  return response.data;
};

export const removeOutputPortsFromDataProduct = async (
  dataProductFqn: string,
  ports: EntityReference[]
) => {
  const data: { assets: EntityReference[] } = {
    assets: ports,
  };

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(`${BASE_URL}/${getEncodedFqn(dataProductFqn)}/outputPorts/remove`, data);

  return response.data;
};

export const removePortsFromDataProduct = async (
  dataProductFqn: string,
  ports: EntityReference[],
  type:
    | AssetsOfEntity.DATA_PRODUCT_INPUT_PORT
    | AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT
) => {
  const data: { assets: EntityReference[] } = {
    assets: ports,
  };

  const endpoint =
    type === AssetsOfEntity.DATA_PRODUCT_INPUT_PORT
      ? `${BASE_URL}/${getEncodedFqn(dataProductFqn)}/inputPorts/remove`
      : `${BASE_URL}/${getEncodedFqn(dataProductFqn)}/outputPorts/remove`;

  const response = await APIClient.put<
    { assets: EntityReference[] },
    AxiosResponse<DataProduct>
  >(endpoint, data);

  return response.data;
};

export const getDataProductPortsView = async (
  dataProductFqn: string,
  params?: {
    inputLimit?: number;
    inputOffset?: number;
    outputLimit?: number;
    outputOffset?: number;
  }
) => {
  const response = await APIClient.get<DataProductPortsView>(
    `${BASE_URL}/name/${getEncodedFqn(dataProductFqn)}/portsView`,
    { params }
  );

  return response.data;
};

export const getDataProductInputPorts = async (
  dataProductFqn: string,
  params?: { limit?: number; offset?: number; fields?: string }
) => {
  const response = await APIClient.get<PaginatedEntities>(
    `${BASE_URL}/name/${getEncodedFqn(dataProductFqn)}/inputPorts`,
    { params }
  );

  return response.data;
};

export const getDataProductOutputPorts = async (
  dataProductFqn: string,
  params?: { limit?: number; offset?: number; fields?: string }
) => {
  const response = await APIClient.get<PaginatedEntities>(
    `${BASE_URL}/name/${getEncodedFqn(dataProductFqn)}/outputPorts`,
    { params }
  );

  return response.data;
};
