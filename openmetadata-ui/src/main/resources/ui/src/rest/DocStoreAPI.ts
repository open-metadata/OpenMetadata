/*
 *  Copyright 2023 Collate.
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
import axiosClient from '.';
import { CreateDocument } from '../generated/api/docStore/createDocument';
import { Document } from '../generated/entity/docStore/document';

const BASE_URL = 'docStore';

export const getAllKnowledgePanels = async (params: { fqnPrefix: string }) => {
  const response = await axiosClient.get<PagingResponse<Document[]>>(
    `${BASE_URL}`,
    {
      params,
    }
  );

  return response.data;
};

export const getDocumentByFQN = async (fqn: string) => {
  const response = await axiosClient.get<Document>(`${BASE_URL}/name/${fqn}`);

  return response.data;
};

export const createDocument = async (data: CreateDocument) => {
  const response = await axiosClient.post<
    CreateDocument,
    AxiosResponse<Document>
  >(BASE_URL, data);

  return response.data;
};

export const updateDocument = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };
  const response = await axiosClient.patch<
    Operation[],
    AxiosResponse<Document>
  >(`${BASE_URL}/${id}`, data, configOptions);

  return response.data;
};
