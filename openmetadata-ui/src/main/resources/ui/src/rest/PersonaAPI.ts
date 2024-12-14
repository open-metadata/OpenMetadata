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
import { TabSpecificField } from '../enums/entity.enum';
import { CreatePersona } from '../generated/api/teams/createPersona';
import { Persona } from '../generated/entity/teams/persona';
import { getEncodedFqn } from '../utils/StringsUtils';

const BASE_URL = '/personas';

interface GetPersonasParams {
  fields?: string | string[];
  limit?: number;
  before?: string;
  after?: string;
}

export const getAllPersonas = async (params: GetPersonasParams) => {
  const response = await axiosClient.get<PagingResponse<Persona[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const getPersonaByName = async (fqn: string, fields?: string) => {
  const response = await axiosClient.get<Persona>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        fields: fields ?? TabSpecificField.USERS,
      },
    }
  );

  return response.data;
};

export const createPersona = async (data: CreatePersona) => {
  const response = await axiosClient.post<
    CreatePersona,
    AxiosResponse<Persona>
  >(BASE_URL, data);

  return response.data;
};

export const updatePersona = async (id: string, data: Operation[]) => {
  const response = await axiosClient.patch<Operation[], AxiosResponse<Persona>>(
    `${BASE_URL}/${id}`,
    data
  );

  return response.data;
};
