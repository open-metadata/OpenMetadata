/*
 *  Copyright 2026 Collate.
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
import { CreateIntakeForm } from '../generated/api/governance/createIntakeForm';
import { IntakeForm } from '../generated/governance/intakeForm';
import { Paging } from '../generated/type/paging';
import APIClient from './index';

const BASE_URL = '/governance/intakeForms';

export interface ListIntakeFormsResponse {
  data: IntakeForm[];
  paging: Paging;
}

export interface ListIntakeFormsParams {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: 'non-deleted' | 'deleted' | 'all';
}

export const listIntakeForms = async (params?: ListIntakeFormsParams) => {
  const response = await APIClient.get<ListIntakeFormsResponse>(BASE_URL, {
    params,
  });

  return response.data;
};

export const getIntakeFormById = async (id: string, fields?: string) => {
  const response = await APIClient.get<IntakeForm>(`${BASE_URL}/${id}`, {
    params: { fields },
  });

  return response.data;
};

export const getIntakeFormByName = async (name: string, fields?: string) => {
  const response = await APIClient.get<IntakeForm>(`${BASE_URL}/name/${name}`, {
    params: { fields },
  });

  return response.data;
};

export const getIntakeFormByEntityType = async (
  entityType: string
): Promise<IntakeForm | null> => {
  try {
    const response = await APIClient.get<IntakeForm>(
      `${BASE_URL}/entityType/${entityType}`
    );

    return response.data;
  } catch (err) {
    const axiosError = err as { response?: { status?: number } };
    if (axiosError?.response?.status === 404) {
      return null;
    }

    throw err;
  }
};

export const createIntakeForm = async (data: CreateIntakeForm) => {
  const response = await APIClient.post<
    CreateIntakeForm,
    AxiosResponse<IntakeForm>
  >(BASE_URL, data);

  return response.data;
};

export const createOrUpdateIntakeForm = async (data: CreateIntakeForm) => {
  const response = await APIClient.put<
    CreateIntakeForm,
    AxiosResponse<IntakeForm>
  >(BASE_URL, data);

  return response.data;
};

export const patchIntakeForm = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<IntakeForm>
  >(`${BASE_URL}/${id}`, patch);

  return response.data;
};

export const deleteIntakeForm = async (id: string, hardDelete = true) => {
  return APIClient.delete(`${BASE_URL}/${id}`, { params: { hardDelete } });
};
