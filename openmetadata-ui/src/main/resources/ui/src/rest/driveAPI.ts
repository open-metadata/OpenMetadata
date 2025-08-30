/*
 *  Copyright 2024 Collate.
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
import { PagingResponse, RestoreRequestType } from 'Models';
import { QueryVote } from '../components/Database/TableQueries/TableQueries.interface';
import { Directory } from '../generated/entity/data/directory';
import { File } from '../generated/entity/data/file';
import { Spreadsheet } from '../generated/entity/data/spreadsheet';
import { Worksheet } from '../generated/entity/data/worksheet';
import { EntityReference } from '../generated/type/entityReference';
import {
  GetDirectoriesParams,
  GetFilesParams,
  GetSpreadsheetParams,
  GetWorksheetsParams,
} from './driveAPI.interface';
import APIClient from './index';

const BASE_URL = '/drives';

export const getFiles = async (params: GetFilesParams) => {
  const { paging, ...restParams } = params;
  const response = await APIClient.get<PagingResponse<File[]>>(
    `${BASE_URL}/files`,
    {
      params: {
        ...restParams,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getDirectories = async (params: GetDirectoriesParams) => {
  const { paging, ...restParams } = params;
  const response = await APIClient.get<PagingResponse<Directory[]>>(
    `${BASE_URL}/directories`,
    {
      params: {
        ...restParams,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getSpreadsheets = async (params: GetSpreadsheetParams) => {
  const { paging, ...restParams } = params;
  const response = await APIClient.get<PagingResponse<Spreadsheet[]>>(
    `${BASE_URL}/spreadsheets`,
    {
      params: {
        ...restParams,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getWorksheets = async (params: GetWorksheetsParams) => {
  const { paging, ...restParams } = params;
  const response = await APIClient.get<PagingResponse<Worksheet[]>>(
    `${BASE_URL}/worksheets`,
    {
      params: {
        ...restParams,
        ...paging,
      },
    }
  );

  return response.data;
};

export const getDirectoryByFqn = async (
  fqn: string,
  fields?: string | string[],
  include?: string
) => {
  const fieldsStr = Array.isArray(fields) ? fields.join(',') : fields;
  const response = await APIClient.get<Directory>(
    `${BASE_URL}/directories/name/${encodeURIComponent(fqn)}`,
    {
      params: {
        ...(fieldsStr && { fields: fieldsStr }),
        ...(include && { include }),
      },
    }
  );

  return response.data;
};

export const patchDirectoryDetails = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Directory>>(
    `${BASE_URL}/directories/${id}`,
    data
  );

  return response.data;
};

export const addFollower = async (id: string, userId: string) => {
  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`${BASE_URL}/directories/${id}/followers`, userId, {
    headers: { 'Content-Type': 'application/json' },
  });

  return response.data;
};

export const removeFollower = async (id: string, userId: string) => {
  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: {
        fieldsDeleted: { oldValue: EntityReference[] }[];
      };
    }>
  >(`${BASE_URL}/directories/${id}/followers/${userId}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  return response.data;
};

export const restoreDirectory = async (id: string) => {
  const response = await APIClient.put<
    RestoreRequestType,
    AxiosResponse<Directory>
  >(`${BASE_URL}/restore`, { id });

  return response.data;
};

export const updateDirectoryVotes = async (id: string, data: QueryVote) => {
  const response = await APIClient.put<QueryVote, AxiosResponse<Directory>>(
    `${BASE_URL}/directories/${id}/vote`,
    data
  );

  return response.data;
};
